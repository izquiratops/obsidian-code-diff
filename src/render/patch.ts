import { processPatch, type FileDiffMetadata, type ParsedPatch } from '@pierre/diffs';

import { DiffError } from '../errors.ts';

/**
 * Turns a unified or Git patch into one entry per file.
 * Kept apart from the renderer so it can be tested without a DOM.
 */
export function parsePatch(patch: string): FileDiffMetadata[] {
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

/**
 * Identity of a file inside one rendered block. `CodeView` needs it to be
 * stable and unique; the index keeps repeated names apart, which a patch can
 * legitimately contain (a rename touching the same path twice, for instance —
 * see "item ids stay unique when a patch repeats a file name" in
 * `test/patch.test.ts`).
 */
export function fileItemId(file: FileDiffMetadata, index: number): string {
	return `${index}:${file.name}`;
}
