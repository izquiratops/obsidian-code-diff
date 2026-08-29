import { fileURLToPath } from 'node:url';

import { BUNDLED_LANGUAGES, BUNDLED_THEMES } from '../src/render/languages.ts';

/**
 * esbuild plugin that keeps Shiki's grammars and themes out of the bundle.
 *
 * `@pierre/diffs` reaches every grammar through `bundledLanguages` (a map of
 * ~260 `() => import('@shikijs/langs/<id>')` thunks) and every theme through
 * `@pierre/theming` (the same shape over `@shikijs/themes/*` and
 * `@pierre/theme/*`). A single-file CommonJS bundle has nowhere to defer those
 * imports to, so esbuild inlines all of them: ~9.4 MB of an 10.9 MB bundle.
 *
 * Rather than rewrite the map — which would mean shimming the whole bare `shiki`
 * entry and keeping `createHighlighter` working — this replaces the *contents* of
 * the modules nobody asked for. Every loader still exists and still resolves, so
 * `resolveLanguage` never hits its "not found in bundled or custom languages"
 * path; it just gets a grammar with no patterns.
 *
 * Only `kind: 'dynamic-import'` is intercepted. Grammars pull their embedded
 * languages in with static imports (`vue` imports `css`, `javascript`, `html`…),
 * and those have to stay real or the parent grammar breaks.
 */

const LANGS = '@shikijs/langs/';
const SHIKI_THEMES = '@shikijs/themes/';
const PIERRE_THEMES = '@pierre/theme/';

const LANG_STUB = 'shiki-lang-stub';
const THEME_STUB = 'shiki-theme-stub';
const WASM_STUB = 'shiki-wasm-stub';

/**
 * What the stubs do at runtime lives in the plugin's own source, so it is typed,
 * tested and readable. Every stub is one line that calls into it, and esbuild
 * bundles it once.
 */
const STUBS = 'code-diff-shiki-stubs';
const STUBS_PATH = fileURLToPath(new URL('../src/render/shiki-stubs.ts', import.meta.url));

export function shikiSubset({ quiet = false } = {}) {
	const languages = new Set(BUNDLED_LANGUAGES);
	const themes = new Set(BUNDLED_THEMES);

	return {
		name: 'shiki-subset',
		setup(build) {
			const stubbed = { languages: new Set(), themes: new Set() };

			const dynamic = (args) => args.kind === 'dynamic-import';

			build.onResolve({ filter: /^@shikijs\/langs\// }, (args) => {
				if (!dynamic(args)) return null;
				const id = args.path.slice(LANGS.length);
				if (languages.has(id)) return null;
				stubbed.languages.add(id);
				return { path: id, namespace: LANG_STUB };
			});

			build.onResolve({ filter: /^(@shikijs\/themes|@pierre\/theme)\// }, (args) => {
				if (!dynamic(args)) return null;
				const prefix = args.path.startsWith(PIERRE_THEMES) ? PIERRE_THEMES : SHIKI_THEMES;
				const name = args.path.slice(prefix.length);
				if (themes.has(name)) return null;
				stubbed.themes.add(name);
				return { path: name, namespace: THEME_STUB };
			});

			// The WASM regex engine is never selected: `preferredHighlighter`
			// defaults to `shiki-js`, and WASM under Obsidian's CSP is a fight
			// worth avoiding. The import is still in the graph, and the binary is
			// 0.6 MB of base64 once inlined.
			build.onResolve({ filter: /^shiki\/wasm$/ }, (args) =>
				dynamic(args) ? { path: 'wasm', namespace: WASM_STUB } : null,
			);

			build.onResolve({ filter: new RegExp(`^${STUBS}$`) }, () => ({ path: STUBS_PATH }));

			build.onLoad({ filter: /.*/, namespace: LANG_STUB }, (args) => ({
				contents: stub('plainTextGrammar', args.path, true),
				loader: 'js',
			}));

			build.onLoad({ filter: /.*/, namespace: THEME_STUB }, (args) => ({
				contents: stub('missingTheme', args.path),
				loader: 'js',
			}));

			build.onLoad({ filter: /.*/, namespace: WASM_STUB }, () => ({
				contents: stub('missingWasm'),
				loader: 'js',
			}));

			build.onEnd(() => {
				if (quiet) return;
				console.log(
					`  shiki-subset: bundled ${languages.size} languages (${stubbed.languages.size} stubbed) ` +
						`and ${themes.size} themes (${stubbed.themes.size} stubbed)`,
				);
			});
		},
	};
}

/**
 * One line per stubbed module, calling into `src/render/shiki-stubs.ts`.
 * A language stub exports the placeholder grammar; a theme or WASM stub throws
 * as its module body runs, which rejects the dynamic import that asked for it.
 */
function stub(fn, name, isDefaultExport = false) {
	const call = `${fn}(${name === undefined ? '' : JSON.stringify(name)})`;
	return `import { ${fn} } from '${STUBS}';\n${isDefaultExport ? `export default ${call};` : `${call};`}\n`;
}
