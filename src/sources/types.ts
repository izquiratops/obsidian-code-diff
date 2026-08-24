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
	 * TODO: What does this even mean?
	 * Produces the raw diff. Implementations must honour `signal` so that a
	 * block removed from the view stops doing work.
	 */
	resolve(signal: AbortSignal): Promise<ResolvedDiff>;
	/** Stable identity of this source, used for diagnostics and (later) caching. */
	readonly id: string;
}
