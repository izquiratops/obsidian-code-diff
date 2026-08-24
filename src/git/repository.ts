import { DiffError } from '../errors.ts';
import { runGit, runGitOrThrow } from './runner.ts';
import type { GitRunOptions } from './runner.ts';

export interface RevisionRange {
	from: string;
	to: string;
}

export interface DiffRequest {
	from?: string;
	to?: string;
	commit?: string;
	paths?: string[];
	context?: number;
}

/**
 * A Git repository already present on disk.
 *
 * Remote repositories will reach this class through a cached local clone, so
 * everything below is unaware of where the repository came from.
 */
export class LocalRepository {
	constructor(readonly path: string) {}

	/** Verifies the path exists and is inside a Git work tree or bare repository. */
	async assertValid(options: GitRunOptions): Promise<void> {
		const result = await runGit(['rev-parse', '--git-dir'], { ...options, cwd: this.path });

		if (result.exitCode === 0) return;

		const stderr = result.stderr.toLowerCase();
		if (stderr.includes('not a git repository')) {
			throw new DiffError('Invalid Git repository', `\`${this.path}\` exists but is not a Git repository.`);
		}

		// TODO: Conditions rely on the message written in English. There's any other way to assert the response status?
		if (
			stderr.includes('no such file or directory') ||
			stderr.includes('cannot change to') ||
			stderr.includes('does not exist')
		) {
			throw new DiffError('Repository not found', `\`${this.path}\` could not be opened.`);
		}

		if (stderr.includes('dubious ownership')) {
			throw new DiffError(
				'Repository not accessible',
				`Git refused to use \`${this.path}\` because it is owned by another user.\n\n${result.stderr.trim()}`,
			);
		}

		throw new DiffError('Repository not found', `\`${this.path}\`\n\n${result.stderr.trim()}`);
	}

	/** Resolves a revision to a full object id, or throws `Diff not found`. */
	async resolveRevision(revision: string, options: GitRunOptions): Promise<string> {
		const result = await runGit(['rev-parse', '--verify', '--quiet', `${revision}^{commit}`], {
			...options,
			cwd: this.path,
		});

		const sha = result.stdout.trim();
		if (result.exitCode !== 0 || sha === '') {
			throw new DiffError(
				'Diff not found',
				`The revision \`${revision}\` does not resolve to a commit in \`${this.path}\`.`,
			);
		}

		return sha;
	}

	/** Returns true when the commit has at least one parent. */
	async hasParent(sha: string, options: GitRunOptions): Promise<boolean> {
		const result = await runGit(['rev-parse', '--verify', '--quiet', `${sha}^1^{commit}`], {
			...options,
			cwd: this.path,
		});
		return result.exitCode === 0 && result.stdout.trim() !== '';
	}

	/**
	 * Produces the raw diff for a request, plus the object ids it resolved to.
	 * The object ids are what a diff cache should be keyed on.
	 */
	async diff(request: DiffRequest, options: GitRunOptions): Promise<{ patch: string; from: string; to: string }> {
		const cwd = this.path;
		const runOptions = { ...options, cwd };
		const contextArgs = request.context === undefined ? [] : [`-U${request.context}`];
		const pathArgs = request.paths?.length ? ['--', ...request.paths] : [];

		if (request.commit !== undefined) {
			const to = await this.resolveRevision(request.commit, runOptions);
			const hasParent = await this.hasParent(to, runOptions);

			// `git show` handles the root-commit case, where there is no `^1`.
			const patch = await runGitOrThrow(
				[
					'show',
					'--no-color',
					'--no-ext-diff',
					'--format=',
					'--patch',
					'--first-parent',
					...contextArgs,
					to,
					...pathArgs,
				],
				runOptions,
				{ message: 'Could not generate diff' },
			);

			const from = hasParent ? await this.resolveRevision(`${to}^1`, runOptions) : EMPTY_TREE;
			return { patch, from, to };
		}

		const fromRef = request.from ?? 'HEAD';
		const toRef = request.to ?? 'HEAD';
		const from = await this.resolveRevision(fromRef, runOptions);
		const to = await this.resolveRevision(toRef, runOptions);

		const patch = await runGitOrThrow(
			['diff', '--no-color', '--no-ext-diff', ...contextArgs, from, to, ...pathArgs],
			runOptions,
			{ message: 'Could not generate diff' },
		);

		return { patch, from, to };
	}
}

/** Git's well-known empty tree object, used as the left side of a root commit. */
export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
