import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

import {
	EXTENSION_TO_FILE_FORMAT,
	attachResolvedLanguages,
	getSharedHighlighter,
	resolveTheme,
	type FileDiffMetadata,
} from '@pierre/diffs';

import {
	BUNDLED_LANGUAGES,
	BUNDLED_THEMES,
	isBundledLanguage,
	unbundledLanguages,
} from '../src/render/languages.ts';
import { plainTextGrammar } from '../src/render/shiki-stubs.ts';

const require = createRequire(import.meta.url);

/**
 * `scripts/shiki-subset.mjs` stubs every grammar and theme that these two lists
 * do not name, and a stub is silent by design: a mistyped language renders as
 * plain text instead of failing the build. These tests are the guard rail.
 */

test('every bundled language names a real Shiki grammar', () => {
	for (const lang of BUNDLED_LANGUAGES) {
		assert.doesNotThrow(
			() => require.resolve(`@shikijs/langs/${lang}`),
			`"${lang}" is not a Shiki language id`,
		);
	}
});

test('every bundled language is reachable from a file name', () => {
	const detectable = new Set<string>(
		Object.values(EXTENSION_TO_FILE_FORMAT).filter((lang): lang is string => lang !== undefined),
	);

	for (const lang of BUNDLED_LANGUAGES) {
		assert.ok(
			detectable.has(lang),
			`"${lang}" is bundled but no file extension maps to it, so its grammar is dead weight`,
		);
	}
});

test('bundled languages are listed once', () => {
	assert.equal(new Set(BUNDLED_LANGUAGES).size, BUNDLED_LANGUAGES.length);
});

test('every bundled theme resolves', async () => {
	for (const name of BUNDLED_THEMES) {
		const theme = await resolveTheme(name);
		assert.equal(theme.name, name);
	}
});

test('the placeholder grammar tokenises as plain text', async () => {
	const lang = 'code-diff-test-lang';
	const highlighter = await getSharedHighlighter({ themes: ['pierre-dark'], langs: [] });

	attachResolvedLanguages({ name: lang, data: plainTextGrammar(lang) }, highlighter);

	const { tokens } = highlighter.codeToTokens('program main\nend program', {
		lang,
		theme: 'pierre-dark',
	});

	// One token per line, holding the line verbatim: no highlighting, no crash.
	assert.deepEqual(
		tokens.map((line) => line.map((token) => token.content)),
		[['program main'], ['end program']],
	);
});

test('unbundledLanguages reports each missing language once', () => {
	const files = [
		{ name: 'src/main.ts' },
		{ name: 'legacy/solver.f90' },
		{ name: 'legacy/mesh.f90' },
		{ name: 'notes/README' },
		{ name: 'macros.el' },
	] as FileDiffMetadata[];

	assert.deepEqual(unbundledLanguages(files), ['fortran-free-form', 'emacs-lisp']);
});

test('plain text and bundled languages count as bundled', () => {
	assert.ok(isBundledLanguage('text'));
	assert.ok(isBundledLanguage('ansi'));
	assert.ok(isBundledLanguage('typescript'));
	assert.ok(!isBundledLanguage('emacs-lisp'));
});
