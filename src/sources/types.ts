/** A raw diff plus whatever identity information the source could establish. */
export interface ResolvedDiff {
	/** Unified/Git diff text, exactly as produced by Git or pasted by the user. */
	patch: string;
	/** Resolved object id for the left-hand side, when known. */
	fromSha?: string;
	/** Resolved object id for the right-hand side, when known. */
	toSha?: string;
	/** Short human-readable description of where this diff came from. */
	origin?: string;
}

export interface DiffSource {
	/**
	 * Produces the raw diff. Implementations must honour `signal`: pass it
	 * through to any async work they start (e.g. `GitDiffSource` forwards it to
	 * `execFile` via `GitRunOptions` in `git/runner.ts`), so that a spawned Git
	 * process is killed rather than left running when the block is removed from
	 * the view (`CodeDiffBlock.onunload` aborts on unload). Sources with no
	 * async work of their own, like `EmbeddedDiffSource`, have nothing to abort
	 * and can ignore it.
	 */
	resolve(signal: AbortSignal): Promise<ResolvedDiff>;
	/** Stable identity of this source, used for diagnostics and (later) caching. */
	readonly id: string;
}
