/**
 * Decides which source produces a block's diff, kept apart from the
 * Obsidian-dependent block lifecycle (see `frontmatter.ts` for the same
 * rationale) so it can be tested on its own.
 */

import { ConfigError, type DiffConfig } from './schema.ts';

export type SourceDecision = { kind: 'embedded'; warning?: string } | { kind: 'git' };

/**
 * A block with both a diff body and Git options renders the body, and warns
 * rather than failing (see HANDOVER.md, "Decisions taken that are worth
 * revisiting").
 */
export function decideSource(config: DiffConfig, body: string): SourceDecision {
	const hasBody = body.trim() !== '';
	const { repo, from, to, commit } = config;
	const hasGitConfig = [repo, from, to, commit].some(Boolean);

	if (hasBody) {
		return hasGitConfig
			? { kind: 'embedded', warning: 'The block has both a diff body and Git options; the embedded diff was used.' }
			: { kind: 'embedded' };
	}

	if (!hasGitConfig) {
		throw new ConfigError(
			'The block is empty. Paste a diff into it, or set `repo` together with `from`/`to` or `commit`.',
		);
	}

	if (config.repo === undefined) {
		throw new ConfigError('`repo` is required when generating a diff from Git.');
	}

	return { kind: 'git' };
}
