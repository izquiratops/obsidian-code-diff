import { homedir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';

export type RepoLocation =
	| { kind: 'local'; path: string; input: string }
	| { kind: 'remote'; url: string; input: string };

// TODO: write examples as comments here
const EXPLICIT_SCHEME = /^(?:https?|ssh|git|ftps?|file):\/\//i;
const SCP_LIKE = /^[A-Za-z0-9._~-]+@[A-Za-z0-9._-]+:(?!\/)/;

// TODO: Does the plugin support SCP too? It's transparent for git to clone the repository?
export function isRemoteRepo(input: string): boolean {
	if (EXPLICIT_SCHEME.test(input)) return !/^file:\/\//i.test(input);
	return SCP_LIKE.test(input);
}

/**
 * Resolves the `repo` value into either a remote URL or an absolute local path.
 *
 * Relative paths are resolved against `base`, which the caller chooses from the
 * plugin settings (vault root or the folder holding the note).
 */
export function resolveRepoLocation(input: string, base: string): RepoLocation {
	const trimmed = input.trim();

	if (isRemoteRepo(trimmed)) {
		return { kind: 'remote', url: trimmed, input: trimmed };
	}

	let path = trimmed;
	if (path === '~') {
		path = homedir();
	} else if (path.startsWith('~/')) {
		path = resolve(homedir(), path.slice(2));
	} else if (!isAbsolute(path)) {
		path = resolve(base, path);
	}

	return { kind: 'local', path, input: trimmed };
}
