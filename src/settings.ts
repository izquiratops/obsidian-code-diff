import { PluginSettingTab, Setting, type App } from 'obsidian';
import type { HighlightMode, ThemeMode, ViewMode } from './config/schema.ts';
import type CodeDiffPlugin from './main.ts';

/** Where relative `repo` paths are resolved from. */
export type PathBase = 'vault' | 'note';

export interface CodeDiffSettings {
	pathBase: PathBase;
	defaultView: ViewMode;
	defaultTheme: ThemeMode;
	defaultLineNumbers: boolean;
	defaultWrap: boolean;
	defaultHighlight: HighlightMode;
	defaultFontFamily: string;
	gitTimeoutSeconds: number;
}

export const DEFAULT_SETTINGS: CodeDiffSettings = {
	pathBase: 'vault',
	defaultView: 'unified',
	defaultTheme: 'auto',
	defaultLineNumbers: true,
	defaultWrap: false,
	defaultHighlight: 'word',
	defaultFontFamily: '',
	gitTimeoutSeconds: 30,
};

export class CodeDiffSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: CodeDiffPlugin,
	) {
		super(app, plugin);
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Repositories').setHeading();

		new Setting(containerEl)
			.setName('Resolve relative paths from')
			.setDesc('Where a relative `repo` path such as `../project` starts from.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('vault', 'Vault folder')
					.addOption('note', 'Folder containing the note')
					.setValue(this.plugin.settings.pathBase)
					.onChange(async (value) => {
						this.plugin.settings.pathBase = value as PathBase;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Git timeout')
			.setDesc('Seconds to wait for a Git command before giving up.')
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.gitTimeoutSeconds))
					.onChange(async (value) => {
						const parsed = Number(value);
						if (!Number.isFinite(parsed) || parsed <= 0) return;
						this.plugin.settings.gitTimeoutSeconds = Math.round(parsed);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName('Rendering').setHeading();

		new Setting(containerEl).setName('View').addDropdown((dropdown) =>
			dropdown
				.addOption('unified', 'Unified')
				.addOption('split', 'Split')
				.setValue(this.plugin.settings.defaultView)
				.onChange(async (value) => {
					this.plugin.settings.defaultView = value as ViewMode;
					await this.plugin.saveSettings();
				}),
		);

		new Setting(containerEl).setName('Theme').addDropdown((dropdown) =>
			dropdown
				.addOption('auto', 'Follow Obsidian')
				.addOption('light', 'Light')
				.addOption('dark', 'Dark')
				.setValue(this.plugin.settings.defaultTheme)
				.onChange(async (value) => {
					this.plugin.settings.defaultTheme = value as ThemeMode;
					await this.plugin.saveSettings();
				}),
		);

		new Setting(containerEl).setName('Line numbers').addToggle((toggle) =>
			toggle.setValue(this.plugin.settings.defaultLineNumbers).onChange(async (value) => {
				this.plugin.settings.defaultLineNumbers = value;
				await this.plugin.saveSettings();
			}),
		);

		new Setting(containerEl)
			.setName('Wrap long lines')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.defaultWrap).onChange(async (value) => {
					this.plugin.settings.defaultWrap = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Intra-line highlighting')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('word', 'Word')
					.addOption('char', 'Character')
					.addOption('none', 'None')
					.setValue(this.plugin.settings.defaultHighlight)
					.onChange(async (value) => {
						this.plugin.settings.defaultHighlight = value as HighlightMode;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Font family')
			.setDesc('CSS font-family used for the diff content. Defaults to the font Obsidian uses for code blocks.')
			.addText((text) =>
				text
					.setPlaceholder('Current Obsidian\'s Monospace font')
					.setValue(this.plugin.settings.defaultFontFamily)
					.onChange(async (value) => {
						this.plugin.settings.defaultFontFamily = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}
}
