import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const vault = process.argv[2] ?? process.env.OBSIDIAN_VAULT;
if (!vault) {
  console.error('⚠️ Usage: node scripts/install.mjs "/path/to/Vault"');
  process.exit(1);
}

const { id } = JSON.parse(await readFile('manifest.json', 'utf8'));
const target = join(vault, '.obsidian', 'plugins', id);
await mkdir(target, { recursive: true });

const files = [
  { src: 'dist/main.js', dst: 'main.js' },
  { src: 'manifest.json', dst: 'manifest.json' },
  { src: 'styles.css', dst: 'styles.css' }
];

for (const { src, dst } of files) {
  await copyFile(src, join(target, dst));
}

console.log(`Installed ${id} to ${target}`);
console.log('Reload Obsidian, then enable "Code Diff" in Settings > Community plugins.');
