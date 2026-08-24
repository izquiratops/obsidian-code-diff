import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { DiffError } from '../errors.ts';

export interface GitRunOptions {
	cwd?: string;
	signal?: AbortSignal;
	timeoutMs?: number;
	maxBufferBytes?: number;
}

export interface GitResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Runs a Git command with an argument array, never a shell string, so that
 * values coming from a note can never be interpreted as shell syntax.
 */
export function runGit(args: string[], options: GitRunOptions = {}): Promise<GitResult> {
	const { cwd, signal, timeoutMs = DEFAULT_TIMEOUT_MS, maxBufferBytes = DEFAULT_MAX_BUFFER } = options;

	return new Promise((resolve, reject) => {
		const child = execFile(
			'git',
			['--no-pager', ...args],
			{
				cwd,
				signal,
				timeout: timeoutMs,
				maxBuffer: maxBufferBytes,
				windowsHide: true,
				encoding: 'utf8',
				env: {
					...process.env,
					// Never let Git block on an interactive credential or passphrase
					// prompt: there is nowhere for the user to type it.
					GIT_TERMINAL_PROMPT: '0',
					GIT_OPTIONAL_LOCKS: '0',
					// Keep output stable regardless of the user's locale.
					LC_ALL: 'C',
				},
			},
			(error, stdout, stderr) => {
				if (error == null) {
					resolve({ stdout, stderr, exitCode: 0 });
					return;
				}

				const code = (error as NodeJS.ErrnoException).code;

				if (code === 'ENOENT') {
					// `spawn ENOENT` is raised both when the `git` binary is missing
					// and when `cwd` does not exist, and the two are indistinguishable
					// from the error alone. Check the directory so a missing repository
					// is not reported as a missing Git installation.
					if (cwd !== undefined && !existsSync(cwd)) {
						reject(new DiffError('Repository not found', `\`${cwd}\` does not exist.`));
						return;
					}
					reject(
						new DiffError(
							'Git is not available',
							'The `git` executable could not be found. Make sure Git is installed and available on the PATH that Obsidian was launched with.',
						),
					);
					return;
				}
				if (code === 'ABORT_ERR' || signal?.aborted === true) {
					reject(new DOMException('Aborted', 'AbortError'));
					return;
				}
				if (code === 'ETIMEDOUT') {
					reject(
						new DiffError(
							'Git timed out',
							`\`git ${args.join(' ')}\` did not finish within ${Math.round(timeoutMs / 1000)}s.`,
						),
					);
					return;
				}
				if (code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
					reject(
						new DiffError(
							'Diff is too large',
							'The diff exceeded the maximum size the plugin will read. Narrow it down with `paths` or a smaller revision range.',
						),
					);
					return;
				}

				// A non-zero exit status: hand it back so callers can interpret it.
				resolve({
					stdout,
					stderr: stderr || error.message,
					exitCode: typeof (error as { code?: unknown }).code === 'number' ? (error as unknown as { code: number }).code : 1,
				});
			},
		);

		child.on('error', () => {
			/* Handled through the callback above. */
		});
	});
}

/** Runs a Git command and turns a non-zero exit into a `DiffError`. */
export async function runGitOrThrow(
	args: string[],
	options: GitRunOptions,
	failure: { message: string; detail?: string },
): Promise<string> {
	const result = await runGit(args, options);

	if (result.exitCode !== 0) {
		const detail = [failure.detail, `git ${args.join(' ')}`, result.stderr.trim()]
			.filter((part): part is string => Boolean(part && part.length > 0))
			.join('\n\n');
		throw new DiffError(failure.message, detail);
	}

	return result.stdout;
}
