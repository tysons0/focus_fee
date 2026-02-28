
import { build } from 'esbuild';
import { rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outdir = resolve('dist-electron');
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: ['src/main/main.ts', 'src/main/preload.ts'],
  outdir,
  platform: 'node',
  bundle: false,
  format: 'cjs',
  target: 'node18',
  sourcemap: true,
  outExtension: { '.js': '.cjs' }
});

console.log('Built Electron main/preload → dist-electron');
