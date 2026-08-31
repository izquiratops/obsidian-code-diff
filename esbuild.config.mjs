import esbuild from 'esbuild';
import process from 'node:process';
import { builtinModules } from 'node:module';

import { shikiSubset } from './scripts/shiki-subset.mjs';

const banner = `/* Code Diff plugin for Obsidian - generated bundle, do not edit. */`;
const prod = process.argv[2] === 'production';

const ctx = await esbuild.context({
  banner: { js: banner },
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
  ],
  plugins: [shikiSubset()],
  format: 'cjs',
  target: 'es2022',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  minify: prod,
  outfile: 'dist/main.js',
  platform: 'node',
  define: { 'process.env.NODE_ENV': prod ? '"production"' : '"development"' },
});

if (prod) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
}
