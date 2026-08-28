import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ConfigError } from '../src/config/schema.ts';
import { decideSource } from '../src/config/source.ts';
import { normalizeConfig } from '../src/config/schema.ts';

function configFor(raw: Record<string, unknown>) {
	return normalizeConfig(raw).config;
}

test('a body with no Git options is rendered embedded, no warning', () => {
	const decision = decideSource(configFor({}), 'diff --git a/x b/x\n');
	assert.deepEqual(decision, { kind: 'embedded' });
});

test('a body plus `repo` warns and still renders the body', () => {
	const decision = decideSource(configFor({ repo: '.' }), 'diff --git a/x b/x\n');
	assert.equal(decision.kind, 'embedded');
	assert.match(decision.kind === 'embedded' ? (decision.warning ?? '') : '', /both a diff body and Git options/);
});

test('a body plus `commit` warns and still renders the body', () => {
	const decision = decideSource(configFor({ commit: 'abc123' }), 'diff --git a/x b/x\n');
	assert.equal(decision.kind, 'embedded');
	assert.ok(decision.kind === 'embedded' && decision.warning);
});

test('a body plus `from`/`to` warns and still renders the body', () => {
	const decision = decideSource(configFor({ from: 'main', to: 'feature' }), 'diff --git a/x b/x\n');
	assert.equal(decision.kind, 'embedded');
	assert.ok(decision.kind === 'embedded' && decision.warning);
});

test('a body plus only `paths` (no repo/from/to/commit) does not count as Git options', () => {
	const decision = decideSource(configFor({ paths: ['src/a.ts'] }), 'diff --git a/x b/x\n');
	assert.deepEqual(decision, { kind: 'embedded' });
});

test('a body plus only `context` (no repo/from/to/commit) does not count as Git options', () => {
	const decision = decideSource(configFor({ context: 3 }), 'diff --git a/x b/x\n');
	assert.deepEqual(decision, { kind: 'embedded' });
});

test('a whitespace-only body is treated as no body: falls through to Git', () => {
	const decision = decideSource(configFor({ repo: '.', commit: 'abc123' }), '   \n\t\n');
	assert.deepEqual(decision, { kind: 'git' });
});

test('`repo` with `commit` and no body resolves to Git', () => {
	assert.deepEqual(decideSource(configFor({ repo: '.', commit: 'abc123' }), ''), { kind: 'git' });
});

test('`repo` with `from`/`to` and no body resolves to Git', () => {
	assert.deepEqual(decideSource(configFor({ repo: '.', from: 'main', to: 'feature' }), ''), { kind: 'git' });
});

test('`repo` alone (no from/to/commit) and no body resolves to Git', () => {
	assert.deepEqual(decideSource(configFor({ repo: '.' }), ''), { kind: 'git' });
});

test('no body and no Git options reports the block is empty', () => {
	assert.throws(() => decideSource(configFor({}), ''), (error: unknown) => {
		assert.ok(error instanceof ConfigError);
		assert.match((error as ConfigError).message, /block is empty/);
		return true;
	});
});

test('no body, only `paths`/`context` (no repo/from/to/commit) reports the block is empty', () => {
	assert.throws(() => decideSource(configFor({ paths: ['a'] }), ''), (error: unknown) => {
		assert.ok(error instanceof ConfigError);
		assert.match((error as ConfigError).message, /block is empty/);
		return true;
	});
});

test('`from`/`to` without `repo` and no body requires `repo`', () => {
	assert.throws(() => decideSource(configFor({ from: 'main', to: 'feature' }), ''), (error: unknown) => {
		assert.ok(error instanceof ConfigError);
		assert.match((error as ConfigError).message, /`repo` is required/);
		return true;
	});
});

test('`commit` without `repo` and no body requires `repo`', () => {
	assert.throws(() => decideSource(configFor({ commit: 'abc123' }), ''), (error: unknown) => {
		assert.ok(error instanceof ConfigError);
		assert.match((error as ConfigError).message, /`repo` is required/);
		return true;
	});
});
