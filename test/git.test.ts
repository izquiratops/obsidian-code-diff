import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

import { isRemoteRepo, resolveRepoLocation } from '../src/git/location.ts';
import { EMPTY_TREE, LocalRepository } from '../src/git/repository.ts';
import { runGit } from '../src/git/runner.ts';
import { DiffError } from '../src/errors.ts';

describe('repo location', () => {
	test('recognises remote URLs', () => {
		assert.ok(isRemoteRepo('https://github.com/user/project.git'));
		assert.ok(isRemoteRepo('ssh://git@gitlab.com/user/project.git'));
		assert.ok(isRemoteRepo('git@github.com:user/project.git'));
		assert.ok(isRemoteRepo('git://example.com/p.git'));
	});

	test('treats paths as local, including ones with colons or dashes', () => {
		assert.ok(!isRemoteRepo('.'));
		assert.ok(!isRemoteRepo('../project'));
		assert.ok(!isRemoteRepo('~/Projects/project'));
		assert.ok(!isRemoteRepo('/abs/path'));
		assert.ok(!isRemoteRepo('C:/Users/me/project'));
	});

	test('resolves relative paths against the given base', async () => {
		const location = await resolveRepoLocation('../project', '/vault/notes');
		assert.deepEqual(location, { kind: 'local', path: '/vault/project', input: '../project' });
	});

	test('leaves absolute paths untouched', async () => {
		const location = await resolveRepoLocation('/srv/repo', '/vault');
		assert.equal(location.kind === 'local' && location.path, '/srv/repo');
	});
});

describe('local repository', () => {
	let dir: string;
	let repo: LocalRepository;
	let firstSha: string;
	let secondSha: string;

	before(async () => {
		dir = await mkdtemp(join(tmpdir(), 'code-diff-test-'));
		repo = new LocalRepository(dir);

		const git = (args: string[]) => runGit(args, { cwd: dir });
		await git(['init', '--initial-branch=main']);
		await git(['config', 'user.email', 'test@example.com']);
		await git(['config', 'user.name', 'Test']);
		await git(['config', 'commit.gpgsign', 'false']);

		await writeFile(join(dir, 'foo.ts'), 'const foo = 1;\n');
		await git(['add', '.']);
		await git(['commit', '-m', 'first']);
		firstSha = (await git(['rev-parse', 'HEAD'])).stdout.trim();

		await writeFile(join(dir, 'foo.ts'), 'const foo = 2;\n');
		await git(['commit', '-am', 'second']);
		secondSha = (await git(['rev-parse', 'HEAD'])).stdout.trim();

		await git(['tag', 'v1']);
		await git(['checkout', '-b', 'feature/foo', '--quiet']);
	});

	after(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	test('accepts a valid repository', async () => {
		await repo.assertValid({});
	});

	test('rejects a directory that is not a repository', async () => {
		const plain = await mkdtemp(join(tmpdir(), 'code-diff-plain-'));
		try {
			await assert.rejects(() => new LocalRepository(plain).assertValid({}), (error: unknown) => {
				assert.ok(error instanceof DiffError);
				assert.equal(error.message, 'Invalid Git repository');
				return true;
			});
		} finally {
			await rm(plain, { recursive: true, force: true });
		}
	});

	test('reports a missing repository', async () => {
		await assert.rejects(
			() => new LocalRepository(join(tmpdir(), 'code-diff-does-not-exist')).assertValid({}),
			(error: unknown) => {
				assert.ok(error instanceof DiffError);
				assert.equal(error.message, 'Repository not found');
				return true;
			},
		);
	});

	test('resolves branches, tags and shas to object ids', async () => {
		assert.equal(await repo.resolveRevision('main', {}), secondSha);
		assert.equal(await repo.resolveRevision('v1', {}), secondSha);
		assert.equal(await repo.resolveRevision(firstSha, {}), firstSha);
	});

	test('rejects an unknown revision as "Diff not found"', async () => {
		await assert.rejects(() => repo.resolveRevision('no-such-branch', {}), (error: unknown) => {
			assert.ok(error instanceof DiffError);
			assert.equal(error.message, 'Diff not found');
			return true;
		});
	});

	test('diffs two revisions and reports the resolved shas', async () => {
		const result = await repo.diff({ from: firstSha, to: 'main' }, {});
		assert.equal(result.from, firstSha);
		assert.equal(result.to, secondSha);
		assert.match(result.patch, /^diff --git a\/foo\.ts b\/foo\.ts$/m);
		assert.match(result.patch, /^-const foo = 1;$/m);
		assert.match(result.patch, /^\+const foo = 2;$/m);
	});

	test('identical revisions produce an empty patch', async () => {
		const result = await repo.diff({ from: 'main', to: 'feature/foo' }, {});
		assert.equal(result.patch.trim(), '');
	});

	test('the commit shorthand shows what that commit changed', async () => {
		const result = await repo.diff({ commit: secondSha }, {});
		assert.equal(result.to, secondSha);
		assert.equal(result.from, firstSha);
		assert.match(result.patch, /^\+const foo = 2;$/m);
	});

	test('the commit shorthand handles a root commit', async () => {
		const result = await repo.diff({ commit: firstSha }, {});
		assert.equal(result.from, EMPTY_TREE);
		assert.match(result.patch, /new file mode/);
	});

	test('the context option reaches Git', async () => {
		const wide = await repo.diff({ from: firstSha, to: 'main', context: 0 }, {});
		assert.match(wide.patch, /@@ -1 \+1 @@/);
	});

	test('pathspecs restrict the diff', async () => {
		const result = await repo.diff({ from: firstSha, to: 'main', paths: ['does-not-exist.ts'] }, {});
		assert.equal(result.patch.trim(), '');
	});
});
