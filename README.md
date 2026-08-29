# Code Diff — Obsidian plugin

![](docs/example.png)

Show code diffs inside your notes. This plugin uses
[`@pierre/diffs`](https://diffs.com) as the (beautiful) rendering engine.

> ⚠️ Status: early!
> Embedded diffs and local Git repositories work. Remote repositories and caching are not implemented yet.

Repository based diffs (using the repo option) are built with `git`, so
they only run on the Desktop app. On mobile and in browsers, embed the diff
directly in the code block instead.

## Syntax

A diff lives in a fenced code block. The block is tagged `code-diff`.
You can add YAML frontmatter to the block.

### A diff pasted into the note

````markdown
```code-diff
---
view: split
---

diff --git a/foo.ts b/foo.ts
index 1234567..89abcde 100644
--- a/foo.ts
+++ b/foo.ts
@@ -1 +1 @@
-const foo = 1;
+const foo = 2;
```
````

The input format is standard `git diff` output. You do not need to rewrite
it into a custom before/after syntax. Plain unified diffs
(`---`/`+++`/`@@`) also work.

### A diff generated from a local repository

````markdown
```code-diff
repo: ../my-project
from: main
to: feature/foo
```
````

### The changes introduced by one commit

````markdown
```code-diff
repo: ../my-project
commit: abc123
```
````

## Options

| Option | Values | Default | Meaning |
|---|---|---|---|
| `repo` | path | — | The path of a local repository. Relative paths resolve from the vault folder (configurable). The plugin expands `~`. |
| `from` | revision | `HEAD` | The left side of the diff. Use a branch, tag, sha, or any Git revision. |
| `to` | revision | `HEAD` | The right side of the diff. |
| `commit` | revision | — | Shows the changes that one commit introduced. Do not combine it with `from` or `to`. |
| `paths` | string or list | — | Restrict the diff to these paths. |
| `context` | integer | Git default | The lines of context that you ask Git for. |
| `view` | `unified`, `split` | `unified` | Layout of the diff. `inline` and `side-by-side` are accepted aliases. |
| `theme` | `auto`, `light`, `dark` | `auto` | With `auto`, the theme follows Obsidian and changes with it. |
| `lineNumbers` | boolean | `true` | Show line numbers. |
| `wrap` | boolean | `false` | Wrap long lines instead of scrolling. |
| `fileHeader` | boolean | `true` | Show the header of each file. |
| `highlight` | `word`, `char`, `none` | `word` | Highlight the changed part inside a line. |
| `lightTheme` / `darkTheme` | bundled theme name | `pierre-light` / `pierre-dark` | Override the syntax theme. |
| `fontFamily` | CSS `font-family` | Obsidian's monospace font | The font for the diff content. |
| `maxHeight` | CSS length or `none` | `60vh` | The maximum height of the scroll region for the diff. Use `none` to let it grow with the note. |

You can set defaults for the presentation options in the plugin settings.
A block always wins over the setting.

## Install for development

```bash
npm install
npm run build
node scripts/install.mjs "/path/to/Vault"
```

Then reload Obsidian. Enable **Code Diff** under *Settings → Community plugins*.

During development, run `npm run dev`. It rebuilds the plugin on change.
Then run the install script again, or just symlink the folder
