import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DiffError } from '../src/errors.ts';
import { fileItemId, parsePatch } from '../src/render/patch.ts';

const TWO_FILES = `diff --git a/src/one.ts b/src/one.ts
index 1111111..2222222 100644
--- a/src/one.ts
+++ b/src/one.ts
@@ -1 +1 @@
-const one = 1;
+const one = 2;
diff --git a/src/two.ts b/src/two.ts
index 3333333..4444444 100644
--- a/src/two.ts
+++ b/src/two.ts
@@ -1,2 +1,2 @@
 const two = 2;
-const three = 3;
+const three = 4;
`;

/** `git show` prefixes the patch with the commit message. */
const WITH_COMMIT_HEADER = `commit 2ad3dd9504e11b63533d34a0db08355d803fdb46
Author: Someone <someone@example.com>
Date:   Tue Aug 25 10:03:09 2026 +0200

    a change touching two files

${TWO_FILES}`;

const names = (patch: string): string[] => parsePatch(patch).map((file) => file.name);

test('a patch covering several files yields one entry per file, in order', () => {
	assert.deepEqual(names(TWO_FILES), ['src/one.ts', 'src/two.ts']);
});

test('a single-file patch yields one entry', () => {
	const single = TWO_FILES.slice(0, TWO_FILES.indexOf('diff --git a/src/two.ts'));
	assert.deepEqual(names(single), ['src/one.ts']);
});

test('the commit header of `git show` does not hide the files', () => {
	assert.deepEqual(names(WITH_COMMIT_HEADER), ['src/one.ts', 'src/two.ts']);
});

test('additions and deletions keep their change type', () => {
	const files = parsePatch(`diff --git a/gone.ts b/gone.ts
deleted file mode 100644
index 1111111..0000000
--- a/gone.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-one
-two
diff --git a/added.ts b/added.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/added.ts
@@ -0,0 +1,2 @@
+one
+two
`);

	assert.deepEqual(
		files.map((file) => [file.name, file.type]),
		[
			['gone.ts', 'deleted'],
			['added.ts', 'new'],
		],
	);
});

// A patch entry without hunks used to be the obvious way for one bad file to
// take the whole block down, since `processPatch` runs with `throwOnError`.
test('entries without hunks do not drop the files around them', () => {
	const hunkless = `diff --git a/old.ts b/new.ts
similarity index 100%
rename from old.ts
rename to new.ts
diff --git a/img.png b/img.png
index 1111111..2222222 100644
Binary files a/img.png and b/img.png differ
diff --git a/run.sh b/run.sh
old mode 100644
new mode 100755
`;

	assert.deepEqual(names(hunkless + TWO_FILES), [
		'new.ts',
		'img.png',
		'run.sh',
		'src/one.ts',
		'src/two.ts',
	]);
});

test('a patch with no file changes reports "Invalid diff"', () => {
	assert.throws(
		() => parsePatch('not a diff at all\n'),
		(error: unknown) => {
			assert.ok(error instanceof DiffError);
			assert.equal(error.message, 'Invalid diff');
			return true;
		},
	);
});

test('item ids stay unique when a patch repeats a file name', () => {
	const files = parsePatch(TWO_FILES + TWO_FILES);
	const ids = files.map(fileItemId);
	assert.equal(ids.length, 4);
	assert.equal(new Set(ids).size, 4);
});
