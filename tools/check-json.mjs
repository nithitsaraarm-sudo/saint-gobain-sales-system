import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set([
  '.git',
  '.agents',
  'node_modules',
  'coverage',
  'dist',
  'build'
]);

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function walk(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        walk(fullPath, files);
      }
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = walk(repoRoot).sort((a, b) => relativePath(a).localeCompare(relativePath(b)));
let failures = 0;

console.log('[check:json] JSON parse validation');

for (const filePath of files) {
  const label = relativePath(filePath);
  try {
    JSON.parse(readFileSync(filePath, 'utf8'));
    console.log(`PASS ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${label}`);
    console.error(error && error.message ? error.message : String(error));
  }
}

if (failures) {
  console.error(`[check:json] FAIL ${failures}/${files.length} JSON files failed to parse.`);
  process.exit(1);
}

console.log(`[check:json] PASS ${files.length} JSON files parsed successfully.`);
