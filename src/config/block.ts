import { parseYaml } from 'obsidian';
import { splitBlock } from './frontmatter.ts';
import { ConfigError, looksLikeConfig, normalizeConfig, type ConfigParseResult, type DiffConfig } from './schema.ts';

export interface ParsedBlock extends ConfigParseResult {
	body: string;
}

export function parseBlock(source: string, defaults: Partial<DiffConfig> = {}): ParsedBlock {
	const { frontmatter, body } = splitBlock(source);

	let rawConfig: unknown = null;

	// Frontmatter exists
	if (frontmatter !== null && frontmatter.trim() !== '') {
		try {
			rawConfig = parseYaml(frontmatter);
		} catch (error) {
			throw new ConfigError(`Could not parse block configuration: ${describeYamlError(error)}`);
		}
	}

	// Frontmatter doesn't exist. Body has config or a embedded diff.
	if (frontmatter === null && body.trim() !== '') {
		const trimStartBody = body.trimStart();
		if (trimStartBody.startsWith('diff --git')) {
			// Definitely a diff body, not config. Skip YAML parse.
		} else {
			try {
				const parsedBody = parseYaml(trimStartBody);
				if (looksLikeConfig(parsedBody)) {
					const { config, warnings } = normalizeConfig(parsedBody, defaults);
					return { config, warnings, body: '' };
				}
			} catch (error) {
				throw new ConfigError(`Could not parse block configuration: ${describeYamlError(error)}`);
			}
		}
	}

	const { config, warnings } = normalizeConfig(rawConfig, defaults);
	return { config, warnings, body };
}

function describeYamlError(error: unknown): string {
	if (error instanceof Error) return error.message.split('\n')[0] ?? error.message;
	return String(error);
}
