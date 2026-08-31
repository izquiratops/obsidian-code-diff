export type RepoLocation =
	| { kind: 'local'; path: string; input: string }
	| { kind: 'remote'; url: string; input: string };

// Matches an explicit URL scheme, e.g.:
//   https://github.com/user/repo.git
//   ssh://git@github.com/user/repo.git
//   git://github.com/user/repo.git
//   ftp://example.com/repo.git / ftps://example.com/repo.git
//   file:///Users/me/repo  (treated as local, see the check below)
const EXPLICIT_SCHEME = /^(?:https?|ssh|git|ftps?|file):\/\//i;
// Matches Git's SCP-like shorthand, e.g. `git@github.com:user/repo.git`.
const SCP_LIKE = /^[A-Za-z0-9._~-]+@[A-Za-z0-9._-]+:(?!\/)/;

/**
 * SCP-like syntax (`git@host:path`) is recognised as remote here, same as any
 * URL-scheme address: `GitDiffSource` currently rejects every remote kind
 * uniformly with "not supported yet" (see HANDOVER.md Phase 5), so this only
 * decides diagnostics, not which remotes are cloneable.
 */
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
export async function resolveRepoLocation(input: string, base: string): Promise<RepoLocation> {
	const trimmed = input.trim();

	if (isRemoteRepo(trimmed)) {
		return { kind: 'remote', url: trimmed, input: trimmed };
	}

	// Import Node.js deps lazily so this module can load on mobile
	const [{ homedir }, { isAbsolute, resolve }] = await Promise.all([import('node:os'), import('node:path')]);

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
