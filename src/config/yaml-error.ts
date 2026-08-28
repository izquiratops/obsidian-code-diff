/**
 * Formats a thrown YAML parse error into a one-line, user-facing message.
 * Kept apart from `block.ts` (which needs Obsidian's `parseYaml`) so it can be
 * tested without an Obsidian runtime.
 */
export function describeYamlError(error: unknown): string {
	if (error instanceof Error) return error.message.split('\n')[0] ?? error.message;
	return String(error);
}
