import { setIcon } from 'obsidian';
import type { DiffError } from '../errors.ts';

export function renderLoading(host: HTMLElement, label = 'Loading diff…'): void {
	host.empty();
	const el = host.createDiv({ cls: 'code-diff-state code-diff-state-loading' });
	setIcon(el.createSpan({ cls: 'code-diff-state-icon' }), 'loader');
	el.createSpan({ cls: 'code-diff-state-text', text: label });
}

export function renderNotice(host: HTMLElement, message: string, detail?: string): void {
	host.empty();
	const el = host.createDiv({ cls: 'code-diff-state code-diff-state-notice' });
	setIcon(el.createSpan({ cls: 'code-diff-state-icon' }), 'info');
	el.createSpan({ cls: 'code-diff-state-text', text: message });
	if (detail !== undefined) appendDetails(host, detail);
}

export function renderError(host: HTMLElement, error: DiffError): void {
	host.empty();
	const el = host.createDiv({ cls: 'code-diff-state code-diff-state-error' });
	setIcon(el.createSpan({ cls: 'code-diff-state-icon' }), 'alert-triangle');
	el.createSpan({ cls: 'code-diff-state-text', text: error.message });
	if (error.detail !== undefined) appendDetails(host, error.detail);
}

export function appendDetails(host: HTMLElement, detail: string, summary = 'Details'): void {
	const details = host.createEl('details', { cls: 'code-diff-details' });
	details.createEl('summary', { text: summary });
	details.createEl('pre', { cls: 'code-diff-details-body' }).createEl('code', { text: detail });
}

export function appendWarnings(host: HTMLElement, warnings: string[]): void {
	if (warnings.length === 0) return;
	const el = host.createDiv({ cls: 'code-diff-warnings' });
	setIcon(el.createSpan({ cls: 'code-diff-state-icon' }), 'alert-circle');
	const list = el.createEl('ul');
	for (const warning of warnings) list.createEl('li', { text: warning });
}
