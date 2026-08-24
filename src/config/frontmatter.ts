/**
 * Splitting a block into frontmatter and body is pure text handling, kept apart
 * from the Obsidian-dependent parsing so it can be tested on its own.
 */

const FENCE = /^-{3,}\s*$/;

export interface SplitBlock {
	/** YAML text between the fences, or null when the block has no frontmatter. */
	frontmatter: string | null;
	/** Everything after the frontmatter, verbatim apart from leading blank lines. */
	body: string;
}

export function splitBlock(source: string): SplitBlock {
	const normalized = source.replace(/\r\n/g, '\n');
	const lines = normalized.split('\n');

	let start = 0;
	while (start < lines.length && lines[start]!.trim() === '') start++;

	if (start >= lines.length || !FENCE.test(lines[start]!)) {
		return { frontmatter: null, body: normalized };
	}

	for (let i = start + 1; i < lines.length; i++) {
		if (FENCE.test(lines[i]!)) {
			return {
				frontmatter: lines.slice(start + 1, i).join('\n'),
				body: stripLeadingBlankLines(lines.slice(i + 1)).join('\n'),
			};
		}
	}

	// An opening fence with no closing fence: treat the rest as config so the
	// user gets a YAML error rather than a confusing "invalid diff".
	return { frontmatter: lines.slice(start + 1).join('\n'), body: '' };
}

function stripLeadingBlankLines(lines: string[]): string[] {
	let index = 0;
	while (index < lines.length && lines[index]!.trim() === '') index++;
	return lines.slice(index);
}
