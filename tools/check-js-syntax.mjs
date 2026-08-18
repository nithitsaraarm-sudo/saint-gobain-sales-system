import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        walk(path.join(directory, entry.name), files);
      }
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

function checkFile(filePath) {
  return spawnSync(process.execPath, ['--check', filePath], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
}

function checkSource(source, label) {
  return spawnSync(process.execPath, ['--check', '--input-type=commonjs', '-'], {
    cwd: repoRoot,
    input: source,
    encoding: 'utf8'
  });
}

function extractInlineScripts(html, filePath) {
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let index = 0;
  while ((match = pattern.exec(html)) !== null) {
    const attrs = match[1] || '';
    const source = match[2] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (!source.trim()) continue;
    index += 1;
    scripts.push({
      label: `${relativePath(filePath)} inline script #${index}`,
      source
    });
  }
  return scripts;
}

const jsFiles = walk(repoRoot).sort((a, b) => relativePath(a).localeCompare(relativePath(b)));
const inlineScripts = [];
const indexPath = path.join(repoRoot, 'index.html');
if (existsSync(indexPath) && statSync(indexPath).isFile()) {
  inlineScripts.push(...extractInlineScripts(readFileSync(indexPath, 'utf8'), indexPath));
}

let failures = 0;
console.log('[check:js] JavaScript syntax validation');

for (const filePath of jsFiles) {
  const result = checkFile(filePath);
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

for (const script of inlineScripts) {
  const result = checkSource(script.source, script.label);
  if (result.status === 0) {
    console.log(`PASS ${script.label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${script.label}`);
    if (result.stderr) console.error(result.stderr.trim());
    if (result.stdout) console.error(result.stdout.trim());
  }
}

const total = jsFiles.length + inlineScripts.length;
if (failures) {
  console.error(`[check:js] FAIL ${failures}/${total} JavaScript source checks failed.`);
  process.exit(1);
}

console.log(`[check:js] PASS ${total} JavaScript source checks passed.`);
