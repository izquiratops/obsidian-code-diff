import { parseYaml } from 'obsidian';
import { splitBlock } from './frontmatter.ts';
import { ConfigError, normalizeConfig, type ConfigParseResult, type DiffConfig } from './schema.ts';

export interface ParsedBlock extends ConfigParseResult {
	/** Everything after the frontmatter. Empty when the block only carries config. */
	body: string;
}

export function parseBlock(source: string, defaults: Partial<DiffConfig> = {}): ParsedBlock {
	const { frontmatter, body } = splitBlock(source);

	let raw: unknown = null;
	if (frontmatter !== null && frontmatter.trim() !== '') {
		try {
			raw = parseYaml(frontmatter);
		} catch (error) {
			throw new ConfigError(`Could not parse block configuration: ${describeYamlError(error)}`);
		}
	}

	const { config, warnings } = normalizeConfig(raw, defaults);
	return { config, warnings, body };
}

function describeYamlError(error: unknown): string {
	if (error instanceof Error) return error.message.split('\n')[0] ?? error.message;
	return String(error);
}
