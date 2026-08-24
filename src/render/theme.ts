import { DEFAULT_THEMES } from '@pierre/diffs';
import type { DiffConfig } from '../config/schema.ts';

export type ResolvedThemeType = 'light' | 'dark';

/** Reads Obsidian's current appearance. */
export function detectObsidianTheme(doc: Document = document): ResolvedThemeType {
	return doc.body.classList.contains('theme-dark') ? 'dark' : 'light';
}

/**
 * Chooses the theme type to render with.
 * - `auto` follows Obsidian; 
 * - An explicit `light`/`dark` pins the diff regardless of the app appearance.
 */
export function resolveThemeType(config: DiffConfig, obsidianTheme: ResolvedThemeType): ResolvedThemeType {
	return config.theme === 'auto' ? obsidianTheme : config.theme;
}

export function resolveThemePair(config: DiffConfig): { light: string; dark: string } {
	return {
		light: config.lightTheme ?? DEFAULT_THEMES.light,
		dark: config.darkTheme ?? DEFAULT_THEMES.dark,
	};
}
