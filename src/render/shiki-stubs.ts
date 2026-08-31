import { BUNDLED_THEMES } from './languages.ts';

/**
 * Runtime behaviour of the grammars and themes this build leaves out.
 *
 * `scripts/shiki-subset.mjs` points every stubbed `@shikijs/langs/*`,
 * `@shikijs/themes/*` and `@pierre/theme/*` module at these functions, so the
 * placeholder that replaces 9 MB of Shiki still behaves like the real thing:
 * a loader exists, resolves, and returns something Shiki accepts.
 *
 * These are only reached through the built bundle. The dev build stubs the same
 * modules, so what you see in Obsidian matches what ships.
 */

/** A TextMate grammar with no patterns: Shiki tokenises each line as one token. */
export interface PlainTextGrammar {
	name: string;
	scopeName: string;
	patterns: never[];
	/** Empty, but Shiki's `LanguageRegistration` requires it. */
	repository: Record<string, never>;
}

/**
 * Stands in for a grammar that is not bundled. The diff still renders! But every
 * line simply comes out as plain text. `highlightWarnings` coming from `block.ts`
 * surfaces an in-UI warning naming the language.
 */
export function plainTextGrammar(name: string): PlainTextGrammar[] {
	return [{ name, scopeName: `source.${name}`, patterns: [], repository: {} }];
}

/**
 * Stands in for a theme that is not bundled. Unlike a language, a theme cannot
 * degrade: rendering with the wrong colours would be worse than failing. The
 * rejection travels up through the theme loader into the block's error state.
 */
export function missingTheme(name: string): never {
	throw new Error(
		`The theme "${name}" is not bundled in this build. Available themes: ${BUNDLED_THEMES.join(', ')}.`,
	);
}

/**
 * Stands in for `shiki/wasm`. `preferredHighlighter` defaults to `shiki-js` and
 * nothing here changes it, so the 0.6 MB Oniguruma binary is dead weight — but
 * the import is still in `@pierre/diffs`' graph and has to resolve.
 */
export function missingWasm(): never {
	throw new Error(
		'The Shiki WASM engine is not bundled; this build always uses the JavaScript regex engine.',
	);
}
