# Code Diff Obsidian Plugin — Implementation Plan

## 1. Project Goal

Build an Obsidian plugin that renders code diffs using `@pierre/diffs`.

The plugin should support:

1. Rendering a raw `git diff` pasted directly into a Markdown code block.
2. Generating a diff from a local Git repository.
3. Generating a diff from a remote Git repository using HTTPS or SSH URLs.
4. Caching repositories and generated diffs.
5. Automatically adapting the diff theme to Obsidian's light/dark mode.

The architecture should keep **diff acquisition**, **Git/repository handling**, **caching**, and **rendering** independent.

The plugin should not contain provider-specific logic for GitHub, GitLab, Codeberg, etc. Any Git repository URL supported by the user's Git installation should be considered valid.

---

# 2. Markdown Syntax

The main Markdown construct is a fenced code block using `code-diff` as the language identifier:

```markdown
```code-diff
...
```
```

The block optionally starts with YAML frontmatter containing plugin configuration.

## Embedded diff

```markdown
```code-diff
---
view: split
theme: auto
---

diff --git a/src/foo.ts b/src/foo.ts
index 123..456 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1 +1 @@
-const foo = 1;
+const foo = 2;
```
```

The body is interpreted as an already-generated diff.

## Git-generated diff

```markdown
```code-diff
---
repo: .
from: main
to: feature/foo
---
```
```

When the body contains no diff, `repo`, `from`, and `to` define the source.

## Commit shorthand

Support:

```yaml
repo: .
commit: abc123
```

This represents the changes introduced by that commit, conceptually equivalent to comparing `abc123^` with `abc123`.

## General revision comparison

Prefer the general model:

```yaml
repo: <repository>
from: <git revision>
to: <git revision>
```

This should support commits, branches, tags, and other Git revisions understood by Git.

---

# 3. Repository Sources

The `repo` property should accept:

## Local paths

```yaml
repo: .
```

```yaml
repo: ../project
```

```yaml
repo: ~/Projects/project
```

Relative paths should have clearly defined semantics, preferably relative to the Obsidian vault.

## HTTPS repositories

```yaml
repo: https://github.com/user/project.git
```

```yaml
repo: https://gitlab.com/user/project.git
```

No provider-specific handling should be implemented.

## SSH repositories

```yaml
repo: git@github.com:user/project.git
```

```yaml
repo: ssh://git@gitlab.com/user/project.git
```

Authentication should be delegated to Git/SSH. The plugin must not implement its own SSH credential management.

The plugin should pass Git/SSH operations through the user's existing environment, including SSH configuration, SSH agents, and credentials.

---

# 4. Architecture

Use clear separation between the following components:

```text
Markdown code-diff block
        |
        v
Configuration parser
        |
        v
Diff source resolver
   +----+-------------+
   |                  |
Embedded diff       Git repository
                      |
                +-----+-----+
                |           |
              Local       Remote
                |           |
                +-----+-----+
                      |
                      v
                 Git resolver
                      |
                      v
                  Raw diff
                      |
                      v
                 Diff cache
                      |
                      v
                @pierre/diffs
                      |
                      v
                 Obsidian view
```

Suggested conceptual interfaces/classes:

```text
DiffSource
├── EmbeddedDiffSource
└── GitDiffSource

Repository
├── LocalRepository
└── RemoteRepository

DiffResolver
RepositoryCache
DiffCache
DiffRenderer
```

The exact implementation language/classes are up to the agent, but responsibilities should remain separated.

---

# 5. Configuration

Configuration should be defined in YAML frontmatter inside the `code-diff` block.

Example:

```yaml
---
repo: ./project
from: main
to: feature/foo
view: split
theme: auto
lineNumbers: true
context: 10
---
```

Configuration should be designed as a **plugin-level abstraction**, rather than blindly exposing the complete API of `@pierre/diffs`.

This keeps the Markdown format independent from the rendering library and allows the renderer implementation to change later.

The initial configuration should cover only options that are useful and stable.

Potential rendering options include:

- `view`
- `theme`
- `lineNumbers`
- `context`
- other options from `@pierre/diffs` that are clearly useful

Do not attempt to expose every library option automatically.

---

# 6. Theme Handling

The default theme should be:

```yaml
theme: auto
```

`auto` should follow Obsidian's current appearance:

```text
Obsidian light mode -> light diff theme
Obsidian dark mode  -> dark diff theme
```

Users should be able to explicitly select a theme when supported by `@pierre/diffs`.

The plugin should react appropriately if the user changes Obsidian's light/dark mode.

---

# 7. Error and Loading States

Rendering should not fail silently.

The plugin should distinguish at least these situations:

| Situation | UI |
|---|---|
| Diff is loading | `Loading diff…` |
| Git reference does not resolve | `Diff not found` |
| Valid references produce no changes | `No changes` |
| Repository cannot be found/accessed | `Repository not found` / appropriate error |
| Repository is not a valid Git repository | `Invalid Git repository` |
| Git executable is unavailable | `Git is not available` |
| Embedded diff cannot be parsed | `Invalid diff` |
| Remote operation fails | Clear, actionable error |

Errors should be user-friendly while retaining enough information for debugging.

Avoid exposing raw command output as the primary UI, but provide a mechanism for detailed diagnostics.

---

# 8. Caching Architecture

Caching should be used for **both local and remote repositories**.

There should be two separate cache layers:

1. **Repository cache** — stores reusable local clones/checkouts of remote repositories.
2. **Diff cache** — stores generated raw diffs and associated metadata.

SQLite is the preferred implementation for the diff cache and cache metadata.

## 8.1 Cache location

The cache should be stored in the plugin's Obsidian application/plugin data area, **outside the vault**.

Do not store cache data inside the user's vault.

Reasons:

- Avoid polluting the vault.
- Avoid unnecessary Obsidian Sync traffic.
- Avoid exposing disposable cache data as user content.
- Remote repositories may contain private source code.
- Cache data is implementation data, not Markdown content.

Conceptually:

```text
Obsidian plugin data
└── code-diff/
    ├── cache.db
    └── repositories/
        ├── <repository-id>/
        └── <repository-id>/
```

The exact OS-specific path should be obtained through Obsidian/Electron APIs rather than hard-coded.

## 8.2 Repository cache

For remote repositories, maintain a cached local Git repository.

Conceptually:

```text
Repository URL
      |
      v
Cached local Git repository
      |
      v
fetch/update when necessary
```

A single cached repository should be reusable by multiple `code-diff` blocks.

The repository cache should use the filesystem because Git itself already manages repositories efficiently as content-addressed stores.

Do **not** put the actual `.git` repository into SQLite.

## 8.3 Diff cache

Use SQLite for generated raw diffs and metadata.

Conceptual schema:

```sql
CREATE TABLE repositories (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    local_path TEXT NOT NULL,
    last_fetched_at INTEGER,
    last_accessed_at INTEGER,
    size_bytes INTEGER
);

CREATE TABLE diffs (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL,
    from_sha TEXT NOT NULL,
    to_sha TEXT NOT NULL,
    diff TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    FOREIGN KEY (repository_id) REFERENCES repositories(id)
);
```

The exact schema can evolve during implementation.

The SQLite database should contain:

- repository metadata;
- diff metadata;
- raw generated diffs;
- access timestamps;
- cache sizes;
- other information required for cleanup and invalidation.

## 8.4 Cache keys

Generated diffs should be identified by **resolved Git object IDs**, not mutable Git reference names.

For example:

```text
Repository:
  from ref: main
  from SHA: abc123
  to ref: feature/foo
  to SHA: def456
```

The diff identity should conceptually be:

```text
repository + abc123 + def456
```

If `feature/foo` later moves from `def456` to `789abc`, the new diff naturally receives a different cache entry.

This avoids using a short TTL as the primary correctness mechanism.

## 8.5 What not to cache

Do not initially cache the rendered HTML/DOM output of `@pierre/diffs`.

Cache the raw diff:

```text
Git -> raw diff -> cache
```

rather than:

```text
Git -> raw diff -> rendered HTML -> cache
```

The same diff can be rendered with different:

- themes;
- views;
- line-number settings;
- context settings;
- other presentation options.

The raw diff is independent of presentation.

---

# 9. SQLite Runtime Strategy

SQLite is a good fit because the cache has structured metadata, lifecycle information, and cleanup requirements.

Prefer the following implementation order:

1. Use Node's built-in SQLite API (`node:sqlite`) if the supported Obsidian runtime provides a sufficiently recent and stable implementation.
2. If the supported Obsidian runtime cannot reliably provide `node:sqlite`, evaluate a non-native JavaScript/WASM SQLite implementation.
3. Avoid native SQLite npm modules unless necessary, because native modules complicate cross-platform Obsidian plugin distribution.

Before committing to `node:sqlite`, verify the Node/Electron runtime bundled by the minimum supported Obsidian desktop version.

The plugin may need to be desktop-only if SQLite/Git access depends on Node/Electron APIs.

If mobile support is desired later, keep the cache and repository layers abstract enough to permit an alternative implementation.

---

# 10. Cache Expiration and Purging

Do not use a short fixed TTL as the primary cache invalidation mechanism.

Git object IDs provide a more reliable identity for generated diffs.

Each cache entry should track metadata such as:

```text
createdAt
lastAccessedAt
size
lastValidatedAt
```

Use age/LRU-style cleanup.

The user should be able to configure:

- maximum cache size;
- how long unused entries are retained;
- remote refresh behaviour.

Possible defaults:

```text
Cache enabled: yes
Maximum size: reasonable default
Remove unused entries after: 30 days
Remote refresh: automatic
```

Exact defaults should be determined during implementation.

The plugin settings should provide at least:

- **Clear cache**
- **Clear unused cache**

"Clear unused cache" should remove entries that have not been used for the configured period.

Repository cache and diff cache should be managed separately. Removing a diff must not remove its cached repository.

---

# 11. Remote Repository Refresh

Remote repository fetching should be separated from diff caching.

Possible lifecycle:

```text
Open code-diff block
       |
       v
Check repository cache
       |
Repository available?
   +---+---+
   |       |
  yes      no
   |       |
   |     clone
   |       |
   +---+---+
       |
       v
Check whether refresh is needed
       |
       v
Fetch/update
       |
       v
Resolve revisions
       |
       v
Look up diff cache
       |
       v
Calculate diff if necessary
```

The first implementation can use a simple automatic refresh policy.

More advanced policies such as:

```yaml
refresh: always
```

```yaml
refresh: never
```

```yaml
refresh: 1h
```

may be added later, but should not complicate the initial implementation unnecessarily.

---

# 12. Embedded Diff Parsing

The plugin should accept standard Git diff output whenever possible.

Examples include:

```text
diff --git ...
```

and standard unified diff sections:

```text
--- a/file
+++ b/file
@@ ...
```

The plugin should not require users to transform a Git diff into a custom `before`/`after` syntax.

Core design principle:

> If Git already provides a standard diff representation, use it rather than inventing another one.

---

# 13. Rendering

`@pierre/diffs` should be treated as the rendering engine.

The plugin should provide it with a normalized/raw diff representation regardless of where the diff originated.

```text
Embedded Markdown
        |
        +----------------+
                         |
Git local --------------+
                         +--> raw diff --> @pierre/diffs
Git remote -------------+
```

Git acquisition must not leak into rendering code.

---

# 14. Obsidian Integration

Follow standard Obsidian plugin conventions.

The `code-diff` fenced block should render correctly in reading/preview mode.

Consider live preview/editor behaviour separately and avoid over-engineering it in the first iteration unless required by Obsidian's Markdown rendering architecture.

The rendered component should react to Obsidian's theme changes.

If Node/Electron APIs are required for Git and SQLite, explicitly mark the plugin as desktop-only and document the limitation.

---

# 15. Security and User Environment

The plugin may invoke Git commands for local and remote repositories.

Important principles:

- Do not implement custom SSH authentication.
- Do not store SSH credentials.
- Let Git and the user's SSH configuration handle authentication.
- Do not automatically execute arbitrary shell commands from Markdown.
- Treat `repo`, `from`, and `to` as data passed to a controlled Git invocation.
- Avoid shell interpolation where possible; use process APIs that accept argument arrays.
- Clearly communicate when a remote repository operation is being performed.
- Keep cached repositories and diffs local to the user's machine.
- Never upload repository contents or cached diffs to an external service.

Remote repositories may contain private source code, so cache handling must be local and predictable.

---

# 16. Initial Scope

The first implementation should prioritize:

1. `code-diff` fenced block parsing.
2. YAML configuration parsing.
3. Embedded Git diff rendering.
4. Local Git repositories.
5. `from` / `to` revision resolution.
6. Commit shorthand.
7. `@pierre/diffs` rendering.
8. `theme: auto`.
9. Loading and error states.
10. Basic SQLite-backed diff caching.
11. Filesystem-based repository caching.
12. Remote HTTPS/SSH repositories.
13. Cache cleanup controls.

Do not initially implement provider-specific integrations for GitHub, GitLab, Codeberg, etc.

---

# 17. Suggested Development Order

## Phase 1 — Rendering

Build the smallest useful vertical slice:

```text
Markdown code-diff
        |
        v
embedded git diff
        |
        v
@pierre/diffs
        |
        v
Obsidian
```

Verify renderer and Markdown syntax before adding Git repository functionality.

## Phase 2 — Configuration

Add YAML frontmatter and rendering options.

Implement `theme: auto`.

## Phase 3 — Local Git

Add:

```yaml
repo: .
from: main
to: feature/foo
```

and:

```yaml
repo: .
commit: abc123
```

Implement Git error handling.

## Phase 4 — Cache foundation

Introduce:

- cache directory outside the vault;
- SQLite database;
- repository filesystem cache;
- diff cache;
- SHA-based diff keys;
- `lastAccessedAt`;
- basic cleanup;
- cache settings UI.

## Phase 5 — Remote Git

Add HTTPS and SSH repositories.

Reuse the same Git resolver used for local repositories.

Implement repository cloning, updating, and caching.

## Phase 6 — Cache management and polish

Improve:

- automatic remote refresh;
- cache size management;
- unused-entry cleanup;
- repository cleanup;
- loading states;
- diagnostics;
- theme changes;
- performance;
- documentation.

---

# 18. Testing Strategy

Tests should cover independent layers rather than only end-to-end rendering.

## Parser tests

Verify:

- valid `code-diff` blocks;
- frontmatter;
- embedded diffs;
- Git configuration;
- missing configuration;
- malformed YAML;
- empty bodies.

## Git tests

Verify:

- local repository;
- branches;
- tags;
- commits;
- invalid revisions;
- no-change comparisons;
- invalid repositories;
- Git unavailable.

## Remote tests

Verify:

- HTTPS repositories;
- SSH repositories;
- existing cached repositories;
- initial clone;
- refresh;
- inaccessible repositories.

## Cache tests

Verify:

- SQLite initialization;
- cache hit;
- cache miss;
- SHA-based invalidation;
- repository reuse;
- diff reuse across notes;
- LRU/age cleanup;
- maximum cache size;
- clearing the cache;
- clearing unused entries;
- repository cache independent from diff cache.

## Renderer tests

Verify:

- light theme;
- dark theme;
- automatic theme selection;
- rendering options;
- malformed/unsupported diffs.

---

# 19. Design Principles

Keep these principles throughout implementation:

1. **Git is the source format, not something to imitate.**
2. **`code-diff` is a container, not a new diff language.**
3. **Repository acquisition and diff rendering are independent concerns.**
4. **Do not hard-code Git hosting providers.**
5. **Use Git itself for HTTPS/SSH authentication and repository operations.**
6. **Cache repositories separately from generated diffs.**
7. **Use resolved Git object IDs to identify diff results.**
8. **Use age/LRU policies for cache cleanup rather than short TTLs.**
9. **Use SQLite for structured cache metadata and raw diff storage.**
10. **Use the filesystem for actual cached Git repositories.**
11. **Keep cache data outside the Obsidian vault.**
12. **Do not cache rendered HTML/DOM initially.**
13. **Keep rendering configuration independent from the exact `@pierre/diffs` API where practical.**
14. **Prefer simple Markdown syntax that remains readable without the plugin.**
15. **Make failures visible and understandable.**
16. **Keep each subsystem independently testable.**
17. **Do not introduce provider-specific remote integrations when Git itself is sufficient.**

---

# 20. Example Final Syntax

## Embedded diff

```markdown
```code-diff
---
view: split
theme: auto
---

diff --git a/foo.ts b/foo.ts
index 123..456 100644
--- a/foo.ts
+++ b/foo.ts
@@ -1 +1 @@
-const foo = 1;
+const foo = 2;
```
```

## Local repository

```markdown
```code-diff
---
repo: .
from: main
to: feature/foo
view: split
theme: auto
---
```
```

## Remote repository

```markdown
```code-diff
---
repo: git@github.com:user/project.git
from: main
to: feature/foo
theme: auto
---
```
```

## Specific commit

```markdown
```code-diff
---
repo: .
commit: abc123
theme: auto
---
```
```

All four cases should ultimately use the same rendering pipeline. Only the source/resolution stage differs.

---

# 21. Open Technical Decisions for the Implementing Agent

Before implementation, explicitly verify:

1. Which Obsidian desktop versions will be supported.
2. Which Node/Electron runtime those versions provide.
3. Whether `node:sqlite` is available and sufficiently stable across the supported runtime matrix.
4. Which Obsidian API should provide the plugin's application-data/cache directory.
5. How Git processes should be spawned safely and portably.
6. Whether the initial release should declare itself desktop-only.
7. Which `@pierre/diffs` options should be exposed in the first configuration schema.
8. Which light/dark themes should be selected by `theme: auto`.
9. How remote repository refresh should behave by default.
10. Whether repository cache size should be subject to the same global cache limit as diff data or have a separate limit.

These decisions should be documented before locking the implementation architecture.
