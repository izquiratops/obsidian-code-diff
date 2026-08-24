export class DiffError extends Error {
	readonly detail?: string;

	constructor(message: string, detail?: string) {
		super(message);
		this.name = 'DiffError';
		this.detail = detail;
	}
}

export function toDiffError(error: unknown, fallbackMessage: string): DiffError {
	if (error instanceof DiffError) return error;
	if (error instanceof Error) return new DiffError(fallbackMessage, `${error.name}: ${error.message}`);
	return new DiffError(fallbackMessage, String(error));
}
