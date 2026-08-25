// FileDiff renders into a <diffs-container> custom element, which is registered
// by the package's `dist/components/web-components.js` module. We deliberately do
// not import that path ourselves: it is not listed in the package's `exports` map,
// so both TypeScript and esbuild refuse to resolve it. It is not needed anyway —
// FileDiff.js imports it internally, so importing FileDiff registers the element.
import { FileDiff, processPatch, type FileDiffOptions, type ParsedPatch, type FileDiffMetadata } from '@pierre/diffs';

import type { DiffConfig } from '../config/schema.ts';
import { DiffError } from '../errors.ts';
import { resolveThemePair, type ResolvedThemeType } from './theme.ts';

const HIGHLIGHT_MAP = {
	word: 'word-alt',
	char: 'char',
	none: 'none',
} as const;

/** Renders a raw diff into a host element using `@pierre/diffs`. */
export class DiffRenderer {
	private instances: FileDiff[] = [];
	private themeType: ResolvedThemeType;

	constructor(
		private readonly host: HTMLElement,
		private readonly config: DiffConfig,
		themeType: ResolvedThemeType,
	) {
		this.themeType = themeType;
	}

	/** Renders the patch. Returns the number of files rendered. */
	render(patch: string): number {
		const parsed = this.parse(patch);

		this.destroy();
		this.host.empty();

		for (const file of parsed) {
			const container = this.host.createEl('diffs-container' as keyof HTMLElementTagNameMap, {
				cls: 'code-diff-file',
			});
			if (this.config.fontFamily) {
				container.style.setProperty('--diffs-font-family', this.config.fontFamily);
			}
			const instance = new FileDiff(this.buildOptions());
			instance.render({ fileDiff: file, fileContainer: container });
			this.instances.push(instance);
		}

		return parsed.length;
	}

	/** Re-renders with a new theme type without re-parsing the diff. */
	setThemeType(themeType: ResolvedThemeType): void {
		if (themeType === this.themeType) return;
		this.themeType = themeType;
		for (const instance of this.instances) {
			instance.setOptions(this.buildOptions());
			instance.rerender();
		}
	}

	destroy(): void {
		for (const instance of this.instances) instance.cleanUp();
		this.instances = [];
	}

	private parse(patch: string): FileDiffMetadata[] {
		let files: FileDiffMetadata[];

		try {
			const parsed: ParsedPatch = processPatch(patch, undefined, true);
			files = parsed.files;
		} catch (error) {
			throw new DiffError('Invalid diff', error instanceof Error ? error.message : String(error));
		}

		if (files.length === 0) {
			throw new DiffError('Invalid diff', 'No file changes could be parsed out of the diff.');
		}

		return files;
	}

	private buildOptions(): FileDiffOptions<undefined> {
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
		};
	}
}
