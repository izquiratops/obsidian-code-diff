import { FileSystemAdapter, Plugin } from 'obsidian';

import { CodeDiffBlock, type BlockContext } from './block.ts';
import { CodeDiffSettingTab, DEFAULT_SETTINGS, type CodeDiffSettings } from './settings.ts';

export const BLOCK_LANGUAGE = 'code-diff';

export default class CodeDiffPlugin extends Plugin {
	override settings: CodeDiffSettings = { ...DEFAULT_SETTINGS };

	override async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new CodeDiffSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor(BLOCK_LANGUAGE, (source, el, ctx) => {
			ctx.addChild(new CodeDiffBlock(el, source, ctx, this.blockContext()));
		});
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<CodeDiffSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private blockContext(): BlockContext {
		return {
			app: this.app,
			settings: this.settings,
			vaultPath: this.vaultPath(),
		};
	}

	/**
	 * TODO: What?
	 * Absolute on-disk path of the vault, used as the base for relative `repo`
	 * paths. Null for vaults that are not backed by the local filesystem.
	 */
	private vaultPath(): string | null {
		const adapter = this.app.vault.adapter;
		return adapter instanceof FileSystemAdapter ? adapter.getBasePath() : null;
	}
}
