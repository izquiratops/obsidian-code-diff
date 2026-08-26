import assert from 'node:assert/strict';
import { test } from 'node:test';

import { splitBlock } from '../src/config/frontmatter.ts';
import { ConfigError, looksLikeConfig, normalizeConfig } from '../src/config/schema.ts';

test('a block with no frontmatter is all body', () => {
	const { frontmatter, body } = splitBlock('diff --git a/x b/x\n');
	assert.equal(frontmatter, null);
	assert.equal(body, 'diff --git a/x b/x\n');
});

test('frontmatter is separated from the diff body', () => {
	const { frontmatter, body } = splitBlock('---\nview: split\n---\n\ndiff --git a/x b/x');
	assert.equal(frontmatter, 'view: split');
	assert.equal(body, 'diff --git a/x b/x');
});

test('a config-only block has an empty body', () => {
	const { frontmatter, body } = splitBlock('---\nrepo: .\ncommit: abc123\n---\n');
	assert.equal(frontmatter, 'repo: .\ncommit: abc123');
	assert.equal(body, '');
});

test('body indentation and blank lines inside the diff are preserved', () => {
	const { body } = splitBlock('---\nview: split\n---\n\n@@ -1 +1 @@\n-  a\n+\n+  b\n');
	assert.equal(body, '@@ -1 +1 @@\n-  a\n+\n+  b\n');
});

test('an unterminated fence is treated as configuration', () => {
	const { frontmatter, body } = splitBlock('---\nview: split\n');
	assert.equal(frontmatter, 'view: split\n');
	assert.equal(body, '');
});

test('CRLF input is normalized', () => {
	const { frontmatter, body } = splitBlock('---\r\nview: split\r\n---\r\n\r\ndiff --git a/x b/x');
	assert.equal(frontmatter, 'view: split');
	assert.equal(body, 'diff --git a/x b/x');
});

test('defaults apply when no options are given', () => {
	const { config, warnings } = normalizeConfig(null);
	assert.equal(config.view, 'unified');
	assert.equal(config.theme, 'auto');
	assert.equal(config.lineNumbers, true);
	assert.deepEqual(warnings, []);
});

test('settings-level defaults are overridden by block options', () => {
	const { config } = normalizeConfig({ view: 'unified' }, { view: 'split', wrap: true });
	assert.equal(config.view, 'unified');
	assert.equal(config.wrap, true);
});

test('view aliases are accepted', () => {
	assert.equal(normalizeConfig({ view: 'side-by-side' }).config.view, 'split');
	assert.equal(normalizeConfig({ view: 'Inline' }).config.view, 'unified');
});

test('unknown options warn instead of failing', () => {
	const { warnings, config } = normalizeConfig({ nope: 1, view: 'split' });
	assert.equal(config.view, 'split');
	assert.equal(warnings.length, 1);
	assert.match(warnings[0]!, /nope/);
});

test('paths accepts a single value or a list', () => {
	assert.deepEqual(normalizeConfig({ paths: 'src/a.ts' }).config.paths, ['src/a.ts']);
	assert.deepEqual(normalizeConfig({ paths: ['a', 'b'] }).config.paths, ['a', 'b']);
});

test('invalid enum values are rejected with a readable message', () => {
	assert.throws(() => normalizeConfig({ view: 'diagonal' }), (error: unknown) => {
		assert.ok(error instanceof ConfigError);
		assert.match((error as ConfigError).message, /unified, split/);
		return true;
	});
});

test('context must be a non-negative whole number', () => {
	assert.equal(normalizeConfig({ context: 10 }).config.context, 10);
	assert.throws(() => normalizeConfig({ context: -1 }), ConfigError);
	assert.throws(() => normalizeConfig({ context: 'lots' }), ConfigError);
});

test('commit cannot be combined with from/to', () => {
	assert.throws(() => normalizeConfig({ commit: 'abc', from: 'main' }), ConfigError);
});

test('a YAML list at the top level is rejected', () => {
	assert.throws(() => normalizeConfig(['view']), ConfigError);
});

// --- looksLikeConfig (implicit frontmatter detection) ---

test('looksLikeConfig returns true for mappings with known keys', () => {
	assert.ok(looksLikeConfig({ repo: '../project' }));
	assert.ok(looksLikeConfig({ view: 'split', theme: 'dark' }));
	assert.ok(looksLikeConfig({ from: 'main', to: 'feature' }));
});

test('looksLikeConfig returns false for null, arrays, strings, and objects with no known keys', () => {
	assert.ok(!looksLikeConfig(null));
	assert.ok(!looksLikeConfig(['view']));
	assert.ok(!looksLikeConfig('view: split'));
	assert.ok(!looksLikeConfig({}));
	assert.ok(!looksLikeConfig({ foo: 'bar', baz: 1 }));
});

test('looksLikeConfig returns false for numbers and booleans', () => {
	assert.ok(!looksLikeConfig(42));
	assert.ok(!looksLikeConfig(true));
});

test('maxHeight accepts CSS lengths and reads a bare number as pixels', () => {
	assert.equal(normalizeConfig({ maxHeight: '40vh' }).config.maxHeight, '40vh');
	assert.equal(normalizeConfig({ maxHeight: '480px' }).config.maxHeight, '480px');
	assert.equal(normalizeConfig({ maxHeight: 480 }).config.maxHeight, '480px');
});

test('maxHeight `none` leaves the diff uncapped', () => {
	assert.equal(normalizeConfig({ maxHeight: 'none' }).config.maxHeight, undefined);
	assert.equal(normalizeConfig({ maxHeight: '' }).config.maxHeight, undefined);
});

test('maxHeight rejects a unit the browser would silently drop', () => {
	assert.throws(() => normalizeConfig({ maxHeight: 'tall' }), ConfigError);
	assert.throws(() => normalizeConfig({ maxHeight: '60 vh' }), ConfigError);
});
