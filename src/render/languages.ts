import { getFiletypeFromFileName, type FileDiffMetadata } from '@pierre/diffs';

/**
 * The Shiki grammars and themes this plugin ships.
 *
 * Obsidian plugins are a single CommonJS `main.js`, so every grammar reachable
 * from the import graph is inlined into the bundle: Shiki's full set is ~8 MB of
 * TextMate grammars and ~1.3 MB of themes. `scripts/shiki-subset.mjs` reads the
 * two lists below at build time and replaces everything else with a placeholder,
 * which is the difference between a 11 MB bundle and a ~3 MB one.
 *
 * Editing either list changes the bundle on the next `npm run build`:
 * - an unlisted language renders as plain text and adds a block warning;
 * - an unlisted theme is an error if a note asks for it by name.
 *
 * Language ids must be the ones `@pierre/diffs` derives from a file name
 * (`EXTENSION_TO_FILE_FORMAT`), and must exist as `@shikijs/langs/<id>`; the
 * `bundle` test checks both.
 */
export const BUNDLED_LANGUAGES = [
	// Diff/VCS plumbing and other things that turn up in a notes vault.
	'diff',
	'git-commit',
	'git-rebase',
	'codeowners',
	'log',
	'csv',
	'tsv',
	'http',
	'regexp',
	'mermaid',

	// Data and configuration.
	'json',
	'jsonc',
	'json5',
	'jsonl',
	'yaml',
	'yml',
	'toml',
	'xml',
	'ini',
	'dotenv',
	'properties',
	'hcl',
	'tf',
	'tfvars',
	'cmake',
	'makefile',
	'dockerfile',
	'nginx',
	'systemd',
	'ssh-config',
	'sql',
	'prisma',
	'protobuf',
	'graphql',

	// Markup and styles.
	'markdown',
	'html',
	'css',
	'scss',
	'sass',
	'vue',
	'svelte',
	'astro',

	// Languages.
	'typescript',
	'tsx',
	'javascript',
	'jsx',
	'python',
	'ruby',
	'php',
	'perl',
	'lua',
	'r',
	'go',
	'rust',
	'zig',
	'c',
	'cpp',
	'csharp',
	'java',
	'kotlin',
	'kts',
	'scala',
	'groovy',
	'swift',
	'dart',
	'haskell',
	'elixir',
	'clojure',
	'nix',
	'gherkin',

	// Shells.
	'zsh',
	'fish',
	'powershell',
	'cmd',
] as const;

/**
 * Themes available to `lightTheme` / `darkTheme`.
 *
 * Only Pierre's own family is bundled: it holds the two defaults plus the soft,
 * vibrant and colour-vision variants, and it is what `theme: auto` switches
 * between. Shiki's 65 themes are dropped; adding one back is a matter of
 * listing its name here.
 */
export const BUNDLED_THEMES = [
	'pierre-light',
	'pierre-dark',
	'pierre-light-soft',
	'pierre-dark-soft',
	'pierre-light-vibrant',
	'pierre-dark-vibrant',
	'pierre-light-protanopia-deuteranopia',
	'pierre-dark-protanopia-deuteranopia',
	'pierre-light-tritanopia',
	'pierre-dark-tritanopia',
] as const;

/** Languages Shiki handles without a grammar, so they are never stubbed. */
const GRAMMARLESS = new Set(['text', 'ansi']);

const BUNDLED = new Set<string>(BUNDLED_LANGUAGES);

export function isBundledLanguage(lang: string): boolean {
	return GRAMMARLESS.has(lang) || BUNDLED.has(lang);
}

/**
 * Languages the patch needs but this build has no grammar for, in the order
 * they first appear. Those files still render; they just render uncoloured, and
 * saying so beats leaving someone to wonder why their Fortran diff is grey.
 */
export function unbundledLanguages(files: readonly FileDiffMetadata[]): string[] {
	const missing = new Set<string>();

	for (const file of files) {
		const lang = file.lang ?? getFiletypeFromFileName(file.name);
		if (!isBundledLanguage(lang)) missing.add(lang);
	}

	return [...missing];
}
