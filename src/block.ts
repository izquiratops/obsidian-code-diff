import type { FileDiffMetadata } from '@pierre/diffs';
import { MarkdownRenderChild, type App, type MarkdownPostProcessorContext } from 'obsidian';

import { parseBlock } from './config/block.ts';
import { ConfigError, DEFAULT_CONFIG, normalizeMaxHeight, type DiffConfig } from './config/schema.ts';
import { decideSource } from './config/source.ts';
import { DiffError, toDiffError } from './errors.ts';
import { unbundledLanguages } from './render/languages.ts';
import { DiffRenderer } from './render/renderer.ts';
import { detectObsidianTheme, resolveThemeType, type ResolvedThemeType } from './render/theme.ts';
import type { CodeDiffSettings } from './settings.ts';
import { EmbeddedDiffSource } from './sources/embedded.ts';
import { GitDiffSource } from './sources/git.ts';
import type { DiffSource } from './sources/types.ts';
import { appendDetails, appendWarnings, renderError, renderLoading, renderNotice } from './ui/states.ts';

export interface BlockContext {
	app: App;
	settings: CodeDiffSettings;
	/** Absolute path of the vault on disk, or null when it cannot be determined. */
	vaultPath: string | null;
}

/**
 * One rendered `code-diff` block.
 *
 * Owns the whole pipeline for that block: configuration parsing, source
 * selection, diff acquisition and rendering, plus the lifecycle needed to abort
 * in-flight work and react to Obsidian theme changes.
 */
export class CodeDiffBlock extends MarkdownRenderChild {
	private readonly abort = new AbortController();
	private renderer: DiffRenderer | null = null;
	private config: DiffConfig | null = null;
	private themeType: ResolvedThemeType;

	constructor(
		containerEl: HTMLElement,
		private readonly source: string,
		private readonly ctx: MarkdownPostProcessorContext,
		private readonly blockCtx: BlockContext,
	) {
		super(containerEl);
		this.themeType = detectObsidianTheme();
	}

	override onload(): void {
		this.containerEl.addClass('code-diff-block');

		this.registerEvent(
			this.blockCtx.app.workspace.on('css-change', () => {
				this.handleThemeChange();
			}),
		);

		void this.run();
	}

	override onunload(): void {
		this.abort.abort();
		this.renderer?.destroy();
		this.renderer = null;
	}

	private handleThemeChange(): void {
		const next = detectObsidianTheme();
		if (next === this.themeType) return;
		this.themeType = next;

		if (this.config === null || this.renderer === null) return;
		this.renderer.setThemeType(resolveThemeType(this.config, next));
	}

	private async run(): Promise<void> {
		let warnings: string[] = [];

		try {
			const parsed = this.parseSource();
			warnings = parsed.warnings;
			this.config = parsed.config;

			if (this.config.fontFamily) {
				this.containerEl.style.setProperty('--diffs-font-family', this.config.fontFamily);
			}

			renderLoading(this.containerEl);

			const resolved = await parsed.source.resolve(this.abort.signal);
			if (this.abort.signal.aborted) return;

			if (resolved.patch.trim() === '') {
				renderNotice(this.containerEl, 'No changes', resolved.origin);
				appendWarnings(this.containerEl, warnings);
				return;
			}

			this.containerEl.empty();
			const host = this.containerEl.createDiv({ cls: 'code-diff-surface' });
			this.renderer = new DiffRenderer(
				host,
				parsed.config,
				resolveThemeType(parsed.config, this.themeType),
			);
			const files = this.renderer.render(resolved.patch);
			warnings.push(...highlightWarnings(files));
			appendWarnings(this.containerEl, warnings);
		} catch (error) {
			if (this.abort.signal.aborted || isAbortError(error)) return;

			const diffError =
				error instanceof ConfigError
					? new DiffError('Invalid block configuration', error.message)
					: toDiffError(error, 'Could not render diff');

			renderError(this.containerEl, diffError);
			appendWarnings(this.containerEl, warnings);
		}
	}

	/** Parses the block and decides which source should produce the diff. */
	private parseSource(): { config: DiffConfig; warnings: string[]; source: DiffSource } {
		const { settings } = this.blockCtx;

		const { config, warnings, body } = parseBlock(this.source, {
			view: settings.defaultView,
			theme: settings.defaultTheme,
			lineNumbers: settings.defaultLineNumbers,
			wrap: settings.defaultWrap,
			highlight: settings.defaultHighlight,
			/* Empty fontFamily resolves the value at runtime to match the current Obsidian's monospace font */
			fontFamily: settings.defaultFontFamily || 'var(--font-monospace)',
			maxHeight: defaultMaxHeight(settings.defaultMaxHeight),
		});

		const decision = decideSource(config, body);

		if (decision.kind === 'embedded') {
			if (decision.warning) warnings.push(decision.warning);
			return { config, warnings, source: new EmbeddedDiffSource(body) };
		}

		return {
			config,
			warnings,
			source: new GitDiffSource(
				// decideSource only returns 'git' once `config.repo` is confirmed set.
				config.repo!,
				{
					from: config.from,
					to: config.to,
					commit: config.commit,
					paths: config.paths,
					context: config.context,
				},
				{ base: this.resolveBase() },
			),
		};
	}

	/** Directory that relative `repo` paths are resolved against. */
	private resolveBase(): string {
		const { settings, vaultPath } = this.blockCtx;

		if (vaultPath === null) {
			throw new ConfigError(
				'Relative repository paths need a local vault. Use an absolute path in `repo` instead.',
			);
		}

		if (settings.pathBase === 'note') {
			const folder = this.ctx.sourcePath.split('/').slice(0, -1).join('/');
			return folder === '' ? vaultPath : `${vaultPath}/${folder}`;
		}

		return vaultPath;
	}
}

/**
 * The settings tab validates before saving, so a bad value here can
 * only come from a hand-edited `.obsidian/plugins/code-diff/data.json`.
 */
function defaultMaxHeight(stored: string): string | undefined {
	try {
		return normalizeMaxHeight(stored);
	} catch {
		return DEFAULT_CONFIG.maxHeight;
	}
}

/**
 * The bundle ships a subset of Shiki's grammars (see `render/languages.ts`), so
 * a file in an unlisted language renders uncoloured. Saying which language is
 * missing turns a silently grey diff into something actionable.
 */
function highlightWarnings(files: FileDiffMetadata[]): string[] {
	const missing = unbundledLanguages(files);
	if (missing.length === 0) return [];

	return [
		`No bundled syntax highlighting for ${missing.map((lang) => `\`${lang}\``).join(', ')}; ` +
			'those files render as plain text.',
	];
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError';
}
