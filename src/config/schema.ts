/**
 * Plugin-level configuration for a `code-diff` block.
 *
 * This is deliberately a plugin abstraction rather than a pass-through of the
 * `@pierre/diffs` option surface, so the Markdown syntax stays stable if the
 * rendering engine changes.
 */

export type ViewMode = 'unified' | 'split';
export type ThemeMode = 'auto' | 'light' | 'dark';
export type HighlightMode = 'word' | 'char' | 'none';

export interface DiffConfig {
	/** Repository location: local path, HTTPS URL or SSH URL. Absent for embedded diffs. */
	repo?: string;
	/** Left-hand revision. */
	from?: string;
	/** Right-hand revision. */
	to?: string;
	/** Shorthand for "the changes introduced by this commit". */
	commit?: string;
	/** Restrict the diff to these pathspecs. */
	paths?: string[];

	view: ViewMode;
	theme: ThemeMode;
	lineNumbers: boolean;
	wrap: boolean;
	fileHeader: boolean;
	highlight: HighlightMode;
	/** Lines of context requested from Git. Only meaningful for generated diffs. */
	context?: number;
	/** Explicit Shiki theme overrides. */
	lightTheme?: string;
	darkTheme?: string;
	/** CSS `font-family` for the diff content. Defaults to Obsidian's monospace font. */
	fontFamily?: string;
	/**
	 * CSS length capping the height of the diff's scroll region. Empty means no cap,
	 * which also switches off the virtualisation.
	 */
	maxHeight?: string;
}

export const DEFAULT_CONFIG: DiffConfig = {
	view: 'unified',
	theme: 'auto',
	lineNumbers: true,
	wrap: false,
	fileHeader: true,
	highlight: 'word',
	maxHeight: '60vh',
};

const VIEW_ALIASES: Record<string, ViewMode> = {
	unified: 'unified',
	inline: 'unified',
	stacked: 'unified',
	split: 'split',
	side: 'split',
	'side-by-side': 'split',
};

export interface ConfigParseResult {
	config: DiffConfig;
	/** Non-fatal problems worth surfacing in diagnostics. */
	warnings: string[];
}

export class ConfigError extends Error {}

const KNOWN_KEYS = new Set([
	'repo',
	'from',
	'to',
	'commit',
	'paths',
	'view',
	'theme',
	'lineNumbers',
	'wrap',
	'fileHeader',
	'highlight',
	'context',
	'lightTheme',
	'darkTheme',
	'fontFamily',
	'maxHeight',
]);

/**
 * Returns true when a parsed YAML value is a mapping that contains at least one
 * known config key. Used to detect implicit frontmatter when no --- fences are
 * present.
 */
export function looksLikeConfig(parsed: unknown): parsed is Record<string, unknown> {
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
	return Object.keys(parsed).some((k) => KNOWN_KEYS.has(k));
}

function asString(value: unknown, key: string): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	throw new ConfigError(`\`${key}\` must be a string.`);
}

function asBoolean(value: unknown, key: string): boolean {
	if (typeof value === 'boolean') return value;
	if (value === 'true') return true;
	if (value === 'false') return false;
	throw new ConfigError(`\`${key}\` must be true or false.`);
}

function asEnum<T extends string>(value: unknown, key: string, allowed: readonly T[]): T {
	const raw = asString(value, key).toLowerCase();
	if ((allowed as readonly string[]).includes(raw)) return raw as T;
	throw new ConfigError(`\`${key}\` must be one of: ${allowed.join(', ')}.`);
}

/** CSS lengths the diff height may be capped at, plus `none` to uncap it. */
const MAX_HEIGHT = /^\d+(?:\.\d+)?(?:px|em|rem|vh|svh|dvh|lvh|%|ch)$/;

/**
 * Accepts a CSS length or `none`. A bare number is read as pixels, which is
 * what someone writing `maxHeight: 400` almost certainly means.
 */
export function normalizeMaxHeight(raw: string): string | undefined {
	const value = raw.trim().toLowerCase();
	if (value === '' || value === 'none' || value === '0') return undefined;
	if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}px`;
	if (MAX_HEIGHT.test(value)) return value;
	throw new ConfigError(
		'`maxHeight` must be a CSS length such as `60vh`, `480px`, or `none` to let the diff grow with the note.',
	);
}

/**
 * Turns the raw YAML mapping from a block's frontmatter into a validated config.
 * Unknown keys are reported as warnings rather than hard errors so that notes
 * written against a newer plugin version still render.
 */
export function normalizeConfig(raw: unknown, defaults: Partial<DiffConfig> = {}): ConfigParseResult {
	const config: DiffConfig = { ...DEFAULT_CONFIG, ...defaults };
	const warnings: string[] = [];

	if (raw == null) {
		return { config, warnings };
	}
	
	if (typeof raw !== 'object' || Array.isArray(raw)) {
		throw new ConfigError('Block configuration must be a YAML mapping.');
	}

	const entries = raw as Record<string, unknown>;

	for (const key of Object.keys(entries)) {
		if (!KNOWN_KEYS.has(key)) warnings.push(`Unknown option \`${key}\` was ignored.`);
	}

	if (entries.repo !== undefined) {
		config.repo = asString(entries.repo, 'repo').trim();
	}

	if (entries.from !== undefined) {
		config.from = asString(entries.from, 'from').trim();
		if (config.from.startsWith('-')) throw new ConfigError(`\`from\` cannot start with \`-\`. Use a branch, tag, or commit id.`);
	}

	if (entries.to !== undefined) {
		config.to = asString(entries.to, 'to').trim();
		if (config.to.startsWith('-')) throw new ConfigError(`\`to\` cannot start with \`-\`. Use a branch, tag, or commit id.`);
	}

	if (entries.commit !== undefined) {
		config.commit = asString(entries.commit, 'commit').trim();
		if (config.commit.startsWith('-')) throw new ConfigError(`\`commit\` cannot start with \`-\`. Use a branch, tag, or commit id.`);
	}

	if (entries.paths !== undefined) {
		const value = entries.paths;
		const list = Array.isArray(value) ? value : [value];
		config.paths = list.map((item, index) => asString(item, `paths[${index}]`).trim()).filter(Boolean);
	}

	if (entries.view !== undefined) {
		const requested = asString(entries.view, 'view').toLowerCase();
		const view = VIEW_ALIASES[requested];
		if (view === undefined) throw new ConfigError('`view` must be one of: unified, split.');
		config.view = view;
	}

	if (entries.theme !== undefined) {
		config.theme = asEnum(entries.theme, 'theme', ['auto', 'light', 'dark'] as const);
	}

	if (entries.highlight !== undefined) {
		config.highlight = asEnum(entries.highlight, 'highlight', ['word', 'char', 'none'] as const);
	}

	if (entries.lineNumbers !== undefined) {
		config.lineNumbers = asBoolean(entries.lineNumbers, 'lineNumbers');
	}

	if (entries.wrap !== undefined) {
		config.wrap = asBoolean(entries.wrap, 'wrap');
	}

	if (entries.fileHeader !== undefined) {
		config.fileHeader = asBoolean(entries.fileHeader, 'fileHeader');
	}

	if (entries.lightTheme !== undefined) {
		config.lightTheme = asString(entries.lightTheme, 'lightTheme').trim();
	}

	if (entries.darkTheme !== undefined) {
		config.darkTheme = asString(entries.darkTheme, 'darkTheme').trim();
	}

	if (entries.fontFamily !== undefined) {
		config.fontFamily = asString(entries.fontFamily, 'fontFamily').trim();
	}

	if (entries.maxHeight !== undefined) {
		config.maxHeight = normalizeMaxHeight(asString(entries.maxHeight, 'maxHeight'));
	}

	if (entries.context !== undefined) {
		const value = Number(asString(entries.context, 'context'));
		if (!Number.isInteger(value) || value < 0) {
			throw new ConfigError('`context` must be a non-negative whole number.');
		}
		config.context = value;
	}

	if (config.commit !== undefined && (config.from !== undefined || config.to !== undefined)) {
		throw new ConfigError('Use either `commit` or `from`/`to`, not both.');
	}

	return { config, warnings };
}
