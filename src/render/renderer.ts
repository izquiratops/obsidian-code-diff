import { CodeView, type CodeViewItem, type CodeViewOptions, type FileDiffMetadata } from '@pierre/diffs';

import type { DiffConfig } from '../config/schema.ts';
import { fileItemId, parsePatch } from './patch.ts';
import { resolveThemePair, type ResolvedThemeType } from './theme.ts';

const HIGHLIGHT_MAP = {
	word: 'word-alt',
	char: 'char',
	none: 'none',
} as const;

export class DiffRenderer {
	private viewer: CodeView | null = null;
	private themeType: ResolvedThemeType;

	constructor(
		private readonly host: HTMLElement,
		private readonly config: DiffConfig,
		themeType: ResolvedThemeType,
	) {
		this.themeType = themeType;
	}

	/** Renders the patch. Returns the files it rendered, in patch order. */
	render(patch: string): FileDiffMetadata[] {
		const files = parsePatch(patch);

		this.destroy();
		this.host.empty();

		const scroller = this.host.createDiv({ cls: 'code-diff-scroll' });

		if (this.config.maxHeight) {
			scroller.style.setProperty('--code-diff-max-height', this.config.maxHeight);
		}

		const viewer = new CodeView(this.buildOptions());
		viewer.setup(scroller);
		viewer.setItems(
			files.map(
				(fileDiff, index): CodeViewItem => ({
					id: fileItemId(fileDiff, index),
					type: 'diff',
					fileDiff,
				}),
			),
		);
		this.viewer = viewer;

		return files;
	}

	/** Re-renders with a new theme type without re-parsing the diff. */
	setThemeType(themeType: ResolvedThemeType): void {
		if (themeType === this.themeType) return;
		this.themeType = themeType;
		// `setOptions` re-renders on its own once the viewer holds items.
		this.viewer?.setOptions(this.buildOptions());
	}

	destroy(): void {
		this.viewer?.cleanUp();
		this.viewer = null;
	}

	private buildOptions(): CodeViewOptions<undefined> {
		const { config } = this;
		return {
			diffStyle: config.view,
			theme: resolveThemePair(config),
			themeType: this.themeType,
			disableLineNumbers: !config.lineNumbers,
			disableFileHeader: !config.fileHeader,
			overflow: config.wrap ? 'wrap' : 'scroll',
			lineDiffType: HIGHLIGHT_MAP[config.highlight],
			hunkSeparators: 'line-info',
			stickyHeaders: config.fileHeader,
		};
	}
}
