import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appscriptRoot = path.join(repoRoot, 'appscript');

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function walk(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.gs')) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkGasFile(filePath) {
  return spawnSync(process.execPath, ['--check', '--input-type=commonjs', '-'], {
    cwd: repoRoot,
    input: readFileSync(filePath, 'utf8'),
    encoding: 'utf8'
  });
}

const files = walk(appscriptRoot).sort((a, b) => relativePath(a).localeCompare(relativePath(b)));
let failures = 0;

console.log('[check:gas] Google Apps Script syntax validation');

if (!files.length) {
  console.warn('[check:gas] WARNING no appscript/**/*.gs files were found.');
}

for (const filePath of files) {
  const result = checkGasFile(filePath);
  const label = relativePath(filePath);
  if (result.status === 0) {
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
    if (result.stderr) console.error(result.stderr.trim());
    if (result.stdout) console.error(result.stdout.trim());
  }
}

if (failures) {
  console.error(`[check:gas] FAIL ${failures}/${files.length} Apps Script syntax checks failed.`);
  process.exit(1);
}

console.log(`[check:gas] PASS ${files.length} Apps Script syntax checks passed.`);
