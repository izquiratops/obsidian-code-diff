import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DiffError } from '../src/errors.ts';
import { EmbeddedDiffSource, looksLikeDiff } from '../src/sources/embedded.ts';

const GIT_DIFF = `diff --git a/foo.ts b/foo.ts
index 1234567..89abcde 100644
--- a/foo.ts
+++ b/foo.ts
@@ -1 +1 @@
-const foo = 1;
+const foo = 2;
`;

const PLAIN_UNIFIED = `--- a/foo.ts
+++ b/foo.ts
@@ -1 +1 @@
-const foo = 1;
+const foo = 2;
`;

test('accepts git-style diffs', () => {
	assert.ok(looksLikeDiff(GIT_DIFF));
});

test('accepts plain unified diffs without a git header', () => {
	assert.ok(looksLikeDiff(PLAIN_UNIFIED));
});

test('rejects prose and code that is not a diff', () => {
	assert.ok(!looksLikeDiff('just some notes about a change'));
	assert.ok(!looksLikeDiff('const foo = 1;\nconst bar = 2;\n'));
});

test('rejects a unified header with no hunk', () => {
	assert.ok(!looksLikeDiff('--- a/foo.ts\n+++ b/foo.ts\n'));
});

test('resolves an embedded diff verbatim', async () => {
	const resolved = await new EmbeddedDiffSource(GIT_DIFF).resolve();
	assert.equal(resolved.patch, GIT_DIFF);
	assert.equal(resolved.origin, 'embedded diff');
});

test('an empty body reports "Empty diff"', async () => {
	await assert.rejects(() => new EmbeddedDiffSource('   \n').resolve(), (error: unknown) => {
		assert.ok(error instanceof DiffError);
		assert.equal(error.message, 'Empty diff');
		return true;
	});
});

test('a non-diff body reports "Invalid diff" with guidance', async () => {
	await assert.rejects(() => new EmbeddedDiffSource('hello').resolve(), (error: unknown) => {
		assert.ok(error instanceof DiffError);
		assert.equal(error.message, 'Invalid diff');
		assert.match(error.detail ?? '', /diff --git/);
		return true;
	});
});
