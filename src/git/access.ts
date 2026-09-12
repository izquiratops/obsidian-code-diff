import { DiffError } from '../errors.ts';

function isContainedPath(
	candidate: string,
	root: string,
	relative: (from: string, to: string) => string,
	isAbsolute: (path: string) => boolean,
	separator: string,
): boolean {
	const pathFromRoot = relative(root, candidate);
	// A relative path is contained when:
	// - It is the root itself
	// - It does not escape via `..` and is not reported as an absolute path
	//   For example, on a different Windows drive
	return (
		pathFromRoot === '' ||
		(pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${separator}`) && !isAbsolute(pathFromRoot))
	);
}

export async function isRepositoryInsideVault(repositoryPath: string, vaultPath: string): Promise<boolean> {
	const [{ realpath }, { isAbsolute, relative, resolve, sep }] = await Promise.all([
		import('node:fs/promises'),
		import('node:path'),
	]);

	const resolvedRepository = resolve(repositoryPath);
	const resolvedVault = resolve(vaultPath);
  if (!isContainedPath(resolvedRepository, resolvedVault, relative, isAbsolute, sep)) {
    return false;
  }

	try {
    const [realRepository, realVault] = await Promise.all([
      realpath(resolvedRepository),
      realpath(resolvedVault),
    ]);
		return isContainedPath(realRepository, realVault, relative, isAbsolute, sep);
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		// Let the repository validation produce its more specific missing-path
		// diagnostic. A missing target cannot be used to read outside the vault.
		if (code === 'ENOENT' || code === 'ENOTDIR') return true;
		throw error;
	}
}

/** Enforces the user's explicit opt-in before Git is invoked outside a vault. */
export async function assertRepositoryAccess(
	repositoryPath: string,
	vaultPath: string | null,
	allowReadOnlyGitOutsideVault: boolean,
): Promise<void> {
	if (allowReadOnlyGitOutsideVault === true) return;
	if (vaultPath !== null && (await isRepositoryInsideVault(repositoryPath, vaultPath))) return;

	throw new DiffError(
		'Repository is outside the vault',
		`\`${repositoryPath}\` is outside the current vault. ` +
			'To let Code Diff read it, explicitly enable “Allow read-only Git outside vault” in the plugin settings.',
	);
}
