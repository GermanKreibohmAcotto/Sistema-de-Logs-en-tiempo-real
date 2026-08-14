// tsc does not copy non-TS files. The migration runner reads *.sql files at
// runtime, so the compiled build needs them alongside the compiled JS.
//
// Deliberately not using fs.cpSync: on at least one Windows/Node 22.17.1
// combination encountered during development, fs.cpSync({recursive:true})
// crashes the process with STATUS_STACK_BUFFER_OVERRUN (a native binding
// bug, reproducible with no project code involved at all). The migrations
// directory is flat (no subdirectories), so a plain readdir + copyFileSync
// loop does the same job without going anywhere near that code path.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src', 'db', 'migrations');
const dest = join(here, '..', 'dist', 'db', 'migrations');

if (existsSync(src)) {
  mkdirSync(dest, { recursive: true });
  const files = readdirSync(src).filter((f) => f.endsWith('.sql'));
  for (const file of files) {
    copyFileSync(join(src, file), join(dest, file));
  }
  console.log(`Copiadas ${files.length} migraciones: ${src} -> ${dest}`);
}
