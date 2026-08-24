import { DiffError } from '../errors.ts';
import type { DiffSource, ResolvedDiff } from './types.ts';

// TODO: Show an example of code-diff block for each one of those regexp
const GIT_HEADER = /^diff --git /m;
const UNIFIED_HEADER = /^--- (?:a\/|\/dev\/null|"a\/)/m;
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m;

export function looksLikeDiff(text: string): boolean {
	if (GIT_HEADER.test(text)) return true;
	return UNIFIED_HEADER.test(text) && HUNK_HEADER.test(text);
}

export class EmbeddedDiffSource implements DiffSource {
	readonly id = 'embedded';

	constructor(private readonly patch: string) {}

	async resolve(): Promise<ResolvedDiff> {
		const patch = this.patch;
		if (patch.trim() === '') {
			throw new DiffError('Empty diff', 'The block has no configuration and no diff content.');
		}

		if (!looksLikeDiff(patch)) {
			throw new DiffError(
				'Invalid diff',
				'The block body does not look like a unified or Git diff. Expected a `diff --git` header, or `--- ` / `+++ ` lines followed by an `@@` hunk header.',
			);
		}

		return { patch, origin: 'embedded diff' };
	}
}
