import esbuild from 'esbuild';
import process from 'node:process';
import builtins from 'builtin-modules';

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
    ...builtins,
    ...builtins.map((m) => `node:${m}`),
  ],
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
