# Handover — Code Diff Obsidian plugin

Working state as of the first session. Plan of record: `code-diff-obsidian-plugin-plan.md`.

## Where things stand

Phases 1–3 of the plan's development order are done and installed:

- `code-diff` fenced block, registered as a Markdown code block processor.
- YAML frontmatter parsing into a validated, plugin-level config (not a
  pass-through of the `@pierre/diffs` API).
- Embedded Git/unified diff rendering.
- Local Git repositories: `from`/`to` revisions, the `commit` shorthand,
  `paths`, `context`.
- `theme: auto`, reacting to Obsidian appearance changes at runtime.
- Loading / `No changes` / error states, with raw diagnostics behind a collapsed
  Details section.
- Settings tab for presentation defaults, relative-path base, and Git timeout.
- 37 tests: config/frontmatter parsing, diff sniffing, and Git integration
  against a real temporary repository.

Not started: caching (Phase 4), remote repositories (Phase 5), cache management
(Phase 6). `GitDiffSource` currently returns a clear "not supported yet" error
for remote URLs — the detection and plumbing are already in place.

Installed to `~/Documents/Vault/.obsidian/plugins/code-diff` via
`node scripts/install.mjs "<vault>"`.

## Verified facts (the plan's §21 open questions)

Measured on this machine, not assumed:

| Question | Answer |
|---|---|
| Obsidian version installed | 1.11.5 |
| Runtime it ships | Electron 39.2.6, **Node 22.21.1** |
| `node:sqlite` viable? | Yes on this version — Node ≥ 22.13 has it unflagged. **But** it forces a high `minAppVersion`: Obsidian 1.8.x shipped Node 20, which has no `node:sqlite`. Still needs an in-app confirmation (see below). |
| Cache directory API | No Obsidian API exposes it. Use Electron's `app.getPath('userData')` via `@electron/remote`, or derive from `process.platform`. Must stay outside the vault. |
| Spawning Git | `child_process.execFile` with an argument array — never a shell string. Implemented in `src/git/runner.ts`. |
| Desktop-only? | Yes. `isDesktopOnly: true` is set; Git needs `child_process`. |
| `theme: auto` themes | `pierre-light` / `pierre-dark` (the library's `DEFAULT_THEMES`), overridable per block. |

### Still to confirm in-app

Open Obsidian's developer console and run `require('node:sqlite')`. Electron can
ship without SQLite compiled in, so the Node version alone is not proof.

## The one significant problem: bundle size

`main.js` is **10 MB**. Measured breakdown:

```
  7.68 MB  @shikijs/langs     (260 grammars)
  1.27 MB  @shikijs/themes    (65 themes)
  0.77 MB  other deps
  0.54 MB  @pierre/*
  0.03 MB  shiki core
  0.02 MB  plugin src
```

Cause: `@pierre/diffs` imports `bundledLanguages` from the `shiki` top-level
entry, a map of ~260 dynamic `import()` thunks. Obsidian plugins must ship a
single CommonJS `main.js`, so esbuild inlines every grammar. Tree-shaking and
minification are already on; this is the floor for the current import graph.

It works, but it costs startup time and is poor citizenship for a community
plugin.

Fix, when it becomes worth doing: alias the bare `shiki` specifier to a local
shim module (esbuild `alias`), and have that shim export a curated
`bundledLanguages` containing only the languages worth shipping. The exact
imports `@pierre/diffs` needs from bare `shiki` are:

```
bundledLanguages, codeToHtml, createCssVariablesTheme,
createHighlighter, createJavaScriptRegexEngine, createOnigurumaEngine,
getTokenStyleObject, stringifyTokenStyle
```

Two cautions:

- `createHighlighter` is on the real rendering path (`highlighter/shared_highlighter.js`),
  so the shim must keep it working, not stub it.
- `resolveLanguage` throws for a language it cannot find. A curated subset needs
  a graceful fallback to plain text, or diffs of unlisted file types will break
  rather than degrade.
- Nothing in `@pierre/diffs` imports `bundledThemes` — themes resolve through
  `@pierre/theming`. The 1.27 MB of Shiki themes is dead weight pulled in by the
  bare `shiki` entry, and should drop out for free with the shim.

## Decisions taken that are worth revisiting

1. **Relative `repo` paths resolve from the vault folder** by default, with a
   setting to use the note's folder instead (`pathBase`). The plan preferred
   vault-relative; the note-relative option is there because `../project` reads
   more naturally next to a note.
2. **`commit:` uses `git show --first-parent`.** This handles root commits (no
   `^1`) correctly, and picks the first parent for merge commits rather than
   showing nothing. A merge's full combined diff is not represented.
   `from` is reported as Git's empty-tree sha for a root commit.
3. **A block with both a body and Git options renders the body**, and adds a
   warning rather than failing.
4. **Unknown config keys warn instead of erroring**, so notes written against a
   newer version still render.
5. **Diff rendering is one `CodeView` for the whole patch** (it used to be one
   `FileDiff` per file). CodeView virtualizes per line, so it needs a bounded
   scroll region: hence the `maxHeight` option and `.code-diff-scroll`. With
   `maxHeight: none` nothing is virtualized and the behaviour matches the old
   renderer.
6. **`minAppVersion` is 1.5.0.** Must be raised if the cache adopts `node:sqlite`.

## Gotchas found the hard way

- Diffs render into a `<diffs-container>` custom element whose **shadow root**
  holds the theme CSS. `CodeView` creates and pools those elements itself, so
  the only thing it needs is a scrollable root. `web-components.js` registers
  the element and is reached through `CodeView → VirtualizedFileDiff →
  FileDiff` — do not import that path directly, it is not in the package's
  `exports` map.
- Custom properties inherit through shadow boundaries, which is why
  `--diffs-font-family` can be set once on the scroll root instead of on every
  container.
- `CodeView.setup()` throws if called twice on one instance, and `cleanUp()`
  releases the root. `DiffRenderer.destroy()` therefore always builds a fresh
  instance rather than reusing one.
- `CodeView.setOptions()` re-renders on its own once the viewer holds items, so
  a theme switch needs no explicit `render()`.
- The shipped `CodeView.setup()` assigns `window.__INSTANCE` and
  `window.__TOGGLE` (library dev leftovers). Harmless, but the last block
  rendered wins, so do not rely on them.
- `@pierre/diffs` is ESM-only with a React *peer* dep that only the `/react`
  subpath needs. The vanilla `CodeView` path needs no React.
- `preferredHighlighter` already defaults to `shiki-js`, so no WASM is involved.
  Keep it that way — WASM under Obsidian's CSP is a fight not worth having.
- `spawn ENOENT` from `execFile` means *either* a missing `git` binary *or* a
  missing `cwd`. `src/git/runner.ts` checks the directory to tell them apart;
  without that, a missing repo reports "Git is not available". A test covers it.
- `Plugin` declares an untyped `settings?: unknown`, so a typed `settings` field
  needs `override`.
- Node's built-in TS support is strip-only and rejects constructor parameter
  properties, which the sources use. Tests therefore transform through
  `scripts/ts-loader.mjs` (esbuild). Sources import with explicit `.ts`
  extensions so Node's ESM resolver works without a resolve hook.
- `package.json` is `"type": "module"`; the esbuild output is explicitly CJS.
- A unified diff's blank *context* lines must keep a single leading space —
  that's the line's whole content. Any lossy paste path (Slack, email, a chat
  UI, an editor that trims trailing whitespace on save) strips it, turning a
  valid context line into a truly empty one. `@pierre/diffs`' `processPatch`
  parser then throws `parsePatchContent: invalid hunk line` with no indication
  of which line or why. Confirmed by generating a real `git diff` and diffing
  its bytes (blank context lines had the leading space) against a copy
  round-tripped through a chat client (space gone, empty line). `parsePatch` in
  `src/render/patch.ts` currently passes the raw string straight through with
  no normalization.

## Suggested next steps

1. Try it in the vault and settle the presentation defaults (`view`, `highlight`,
   whether `fileHeader` should be on).
2. Confirm `node:sqlite` in-app, then decide the `minAppVersion` trade-off.
3. Phase 4 — cache foundation. Cache directory outside the vault, SQLite schema,
   diff keyed on resolved object ids (`GitDiffSource` already returns
   `fromSha`/`toSha` for exactly this), `lastAccessedAt`, cleanup, settings UI.
4. Phase 5 — remote repositories: bare clone into the repository cache, fetch
   policy, then reuse `LocalRepository` unchanged. Keep `GIT_TERMINAL_PROMPT=0`
   so a credential prompt can never hang the renderer.
5. Bundle-size shim, once the feature set settles.
6. Harden `parsePatch` (`src/render/patch.ts`) against blank context lines that
   lost their leading space in a lossy paste (see the gotcha above). Normalize
   before handing the string to `processPatch`: within a hunk, a line that is
   empty and not immediately followed by a `diff --git`/`@@` line is almost
   certainly a corrupted context line, not an intentional empty diff line.
   Needs a test with a patch built the same way (real `git diff`, then strip
   trailing whitespace from blank lines) to reproduce it deterministically.

## Layout

```
src/
  main.ts              plugin entry, code block registration
  block.ts             per-block pipeline, lifecycle, theme reaction
  settings.ts          settings tab + defaults
  errors.ts            DiffError (user-facing message + hidden detail)
  config/
    frontmatter.ts     pure frontmatter/body split (tested standalone)
    block.ts           YAML parse (needs Obsidian)
    schema.ts          config validation and defaults
  sources/
    types.ts           DiffSource / ResolvedDiff
    embedded.ts        pasted diffs
    git.ts             Git-generated diffs; rejects remotes for now
  git/
    runner.ts          execFile wrapper, error classification
    location.ts        local vs remote, path resolution
    repository.ts      LocalRepository: validate, resolve revisions, diff
  render/
    renderer.ts        the only module aware of @pierre/diffs
    theme.ts           Obsidian appearance -> theme type
  ui/states.ts         loading / notice / error / details / warnings
test/                  config, embedded, git integration
scripts/
  install.mjs          copy build into a vault
  ts-loader.mjs        esbuild transform for node --test
```
