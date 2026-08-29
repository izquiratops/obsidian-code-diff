import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sanitizeDiff } from '../src/sources/sanitize.ts';
import { parsePatch } from '../src/render/patch.ts';

// Built from an array, not a template literal, so the blank context line
// below is unambiguously a single space -- not an empty line that would be
// indistinguishable from the corruption these tests are guarding against.
const GIT_DIFF = [
	'diff --git a/foo.ts b/foo.ts',
	'index 1234567..89abcde 100644',
	'--- a/foo.ts',
	'+++ b/foo.ts',
	'@@ -1,3 +1,3 @@',
	' const foo = 1;',
	' ',
	'-const bar = 1;',
	'+const bar = 2;',
	'',
].join('\n');

test('leaves a well-formed diff untouched', () => {
	assert.equal(sanitizeDiff(GIT_DIFF), GIT_DIFF);
});

test('strips a uniform indent added by a list or callout', () => {
	const indented = GIT_DIFF.split('\n')
		.map((line) => `    ${line}`)
		.join('\n');

	assert.equal(sanitizeDiff(indented), GIT_DIFF);
});

test('restores the leading space on a blank context line trimmed by an editor', () => {
	const trimmed = GIT_DIFF.replace('\n \n', '\n\n');
	assert.notEqual(trimmed, GIT_DIFF);
	assert.equal(sanitizeDiff(trimmed), GIT_DIFF);
});

test('normalizes CRLF line endings', () => {
	const crlf = GIT_DIFF.replace(/\n/g, '\r\n');
	assert.equal(sanitizeDiff(crlf), GIT_DIFF);
});

test('leaves trailing blank filler between hunks alone', () => {
	const twoHunks = [
		'diff --git a/foo.ts b/foo.ts',
		'index 1234567..89abcde 100644',
		'--- a/foo.ts',
		'+++ b/foo.ts',
		'@@ -1 +1 @@',
		'-const foo = 1;',
		'+const foo = 2;',
		'',
		'@@ -10 +10 @@',
		'-const baz = 1;',
		'+const baz = 2;',
		'',
	].join('\n');

	assert.equal(sanitizeDiff(twoHunks), twoHunks);
});

test('a diff with a restored blank context line still parses', () => {
	const trimmed = GIT_DIFF.replace('\n \n', '\n\n');
	const files = parsePatch(sanitizeDiff(trimmed));
	assert.equal(files.length, 1);
});
