import { MarkdownRenderChild, type App, type MarkdownPostProcessorContext } from 'obsidian';

import { parseBlock } from './config/block.ts';
import { ConfigError, type DiffConfig } from './config/schema.ts';
import { DiffError, toDiffError } from './errors.ts';
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
			this.renderer.render(resolved.patch);
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
		});

		const hasBody = body.trim() !== '';
		const hasGitConfig =
			config.repo !== undefined ||
			config.from !== undefined ||
			config.to !== undefined ||
			config.commit !== undefined;

		if (hasBody && hasGitConfig) {
			warnings.push('The block has both a diff body and Git options; the embedded diff was used.');
		}

		if (hasBody) {
			return { config, warnings, source: new EmbeddedDiffSource(body) };
		}

		if (!hasGitConfig) {
			throw new ConfigError(
				'The block is empty. Paste a diff into it, or set `repo` together with `from`/`to` or `commit`.',
			);
		}

		if (config.repo === undefined) {
			throw new ConfigError('`repo` is required when generating a diff from Git.');
		}

		return {
			config,
			warnings,
			source: new GitDiffSource(
				config.repo,
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

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError';
}
