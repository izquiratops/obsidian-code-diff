// Matches diff hunk headers like @@ -1,3 +2,4 @@, optionally with trailing text
const HUNK_HEADER_LINE = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@.*$/;

/**
 * Sanitize a raw diff string by normalizing line endings, removing
 * common indentation, and restoring blank context lines.
 *
 * @example
 *   sanitizeDiff('  @@ -1 +1 @@\n  -old\n  +new')
 *   // => '@@ -1 +1 @@\n -old\n +new'
 */
export function sanitizeDiff(text: string): string {
	// Normalize CRLF / CR to LF
	const normalized = text.replace(/\r\n?/g, '\n');
	return restoreBlankContextLines(dedent(normalized));
}

/**
 * Strip the common leading whitespace from all non-empty lines.
 * Lines that are already shorter than the common indent are left as-is.
 *
 * @example
 *   dedent('    foo\n    bar')
 *   // => 'foo\nbar'
 *
 *   dedent('  foo\n    bar')
 *   // => 'foo\n  bar'  (only 2 spaces removed from each line)
 */
function dedent(text: string): string {
	const lines = text.split('\n');

	// Collect leading whitespace of every non-empty line
	const indents = lines
		.filter((line) => line.trim() !== '')
		.map((line) => /^[ \t]*/.exec(line)![0]);

	const [first, ...rest] = indents;
	if (first === undefined) {
		return text;
	}

	// Find the longest common prefix across all indents
	let common = first;
	for (const indent of rest) {
		let i = 0;
		while (i < common.length && i < indent.length && common[i] === indent[i]) i++;
		common = common.slice(0, i);
		if (common === '') break;
	}

	// No common indentation → return unchanged
	if (common === '') {
		return text;
	}

	// Strip the common prefix from every line (empty lines remain empty)
	return lines.map((line) => (line.startsWith(common) ? line.slice(common.length) : line)).join('\n');
}

/**
 * Replace fully empty lines inside diff hunks with a single space so that
 * they are preserved as blank context lines instead of being collapsed.
 * Trailing blank lines after the last hunk line are left untouched.
 *
 * @example
 *   restoreBlankContextLines('@@ -1,3 +1,3 @@\n\ncontext\n-more')
 *   // => '@@ -1,3 +1,3 @@\n \ncontext\n-more'
 *   //    (empty context line becomes " ", a blank context line in diff output)
 */
function restoreBlankContextLines(text: string): string {
	const lines = text.split('\n');

	// Locate every hunk header
	const headerIndexes: number[] = [];
	lines.forEach((line, index) => {
		if (HUNK_HEADER_LINE.test(line)) headerIndexes.push(index);
	});

	if (headerIndexes.length === 0) {
		return text;
	}

	headerIndexes.forEach((headerIndex, position) => {
		// Determine the range: from the line after the header up to the next
		// header (or end of file), excluding trailing blank lines.
		const nextHeaderIndex = headerIndexes[position + 1] ?? lines.length;
		let end = nextHeaderIndex;
		while (end > headerIndex + 1 && lines[end - 1] === '') end--;

		// Turn empty lines into a single space so they stay visible
		for (let i = headerIndex + 1; i < end; i++) {
			if (lines[i] === '') lines[i] = ' ';
		}
	});

	return lines.join('\n');
}
