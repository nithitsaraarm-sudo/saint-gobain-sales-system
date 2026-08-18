import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localReferenceSources = [
  'index.html',
  'manifest.json',
  'service-worker.js'
];
const ignoredSchemes = /^(?:https?:|data:|blob:|mailto:|tel:|javascript:)/i;

function normalizeReference(reference) {
  const raw = String(reference || '').trim();
  if (!raw || raw === '#') return '';
  if (raw.startsWith('#')) return '';
  if (ignoredSchemes.test(raw)) return '';
  const withoutFragment = raw.split('#')[0];
  const withoutQuery = withoutFragment.split('?')[0];
  if (!withoutQuery || withoutQuery === '.' || withoutQuery === './') return './';
  return withoutQuery;
}

function resolveLocalReference(reference) {
  const normalized = normalizeReference(reference);
  if (!normalized) return null;
  const safePath = normalized.replace(/^[./\\]+/, '');
  if (!safePath) return repoRoot;
  return path.resolve(repoRoot, safePath);
}

function isInsideRepo(filePath) {
  const relative = path.relative(repoRoot, filePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/') || '.';
}

function addReference(references, source, reference) {
  const localPath = resolveLocalReference(reference);
  if (!localPath || !isInsideRepo(localPath)) return;
  references.push({ source, reference: normalizeReference(reference), localPath });
}

function collectIndexReferences(references) {
  const fileName = 'index.html';
  const filePath = path.join(repoRoot, fileName);
  if (!existsSync(filePath)) {
    references.push({ source: fileName, reference: fileName, localPath: filePath, required: true });
    return;
  }
  const html = readFileSync(filePath, 'utf8');
  const attrPattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = attrPattern.exec(html)) !== null) {
    addReference(references, fileName, match[1]);
  }
  const versionedPattern = /getVersionedAssetUrl\(\s*["']([^"']+)["']\s*\)/gi;
  while ((match = versionedPattern.exec(html)) !== null) {
    addReference(references, fileName, match[1]);
  }
  const serviceWorkerPattern = /serviceWorker\.register\(\s*["']([^"']+)["']/gi;
  while ((match = serviceWorkerPattern.exec(html)) !== null) {
    addReference(references, fileName, match[1]);
  }
  const dynamicScriptListPattern = /\[\s*(['"][\s\S]*?['"])\s*\]\.forEach\(\s*function\s*\(\s*name\s*\)/m;
  const dynamicScriptMatch = html.match(dynamicScriptListPattern);
  if (dynamicScriptMatch) {
    const scriptNames = dynamicScriptMatch[0].match(/['"]([^'"]+)['"]/g) || [];
    for (const quotedName of scriptNames) {
      const name = quotedName.slice(1, -1);
      if (/^[A-Za-z0-9_-]+$/.test(name)) {
        addReference(references, fileName, `js/${name}.js`);
      }
    }
  }
}

function collectHtmlReferences(references, fileName) {
  const filePath = path.resolve(repoRoot, fileName);
  if (!isInsideRepo(filePath) || !existsSync(filePath)) {
    references.push({ source: fileName, reference: fileName, localPath: filePath, required: true });
    return;
  }
  const html = readFileSync(filePath, 'utf8');
  const attrPattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = attrPattern.exec(html)) !== null) {
    addReference(references, relativePath(filePath), match[1]);
  }
}

function collectManifestReferences(references) {
  const fileName = 'manifest.json';
  const filePath = path.join(repoRoot, fileName);
  if (!existsSync(filePath)) {
    references.push({ source: fileName, reference: fileName, localPath: filePath, required: true });
    return;
  }
  const manifest = JSON.parse(readFileSync(filePath, 'utf8'));
  if (manifest.start_url) addReference(references, fileName, manifest.start_url);
  if (Array.isArray(manifest.icons)) {
    for (const icon of manifest.icons) {
      if (icon && icon.src) addReference(references, fileName, icon.src);
    }
  }
}

function extractArrayBody(source, name) {
  const marker = `const ${name} = [`;
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const bodyStart = start + marker.length;
  const end = source.indexOf('];', bodyStart);
  return end >= 0 ? source.slice(bodyStart, end) : '';
}

function collectServiceWorkerReferences(references) {
  const fileName = 'service-worker.js';
  const filePath = path.join(repoRoot, fileName);
  if (!existsSync(filePath)) {
    references.push({ source: fileName, reference: fileName, localPath: filePath, required: true });
    return;
  }
  const source = readFileSync(filePath, 'utf8');
  const importScriptsPattern = /importScripts\(\s*["']([^"']+)["']\s*\)/gi;
  let match;
  while ((match = importScriptsPattern.exec(source)) !== null) {
    addReference(references, fileName, match[1]);
  }
  const baseAssetsBody = extractArrayBody(source, 'BASE_ASSETS');
  const assetPattern = /["']([^"']+)["']/g;
  while ((match = assetPattern.exec(baseAssetsBody)) !== null) {
    addReference(references, fileName, match[1]);
  }
}

const references = [];
for (const source of localReferenceSources) {
  const sourcePath = path.join(repoRoot, source);
  if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
    references.push({ source, reference: source, localPath: sourcePath, required: true });
  }
}

collectIndexReferences(references);
collectManifestReferences(references);
collectServiceWorkerReferences(references);

for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i] === '--include-html' && process.argv[i + 1]) {
    collectHtmlReferences(references, process.argv[i + 1]);
    i += 1;
  }
}

const unique = new Map();
for (const item of references) {
  const key = `${item.source}|${item.reference}|${item.localPath}`;
  if (!unique.has(key)) unique.set(key, item);
}

let failures = 0;
console.log('[check:assets] Static asset reference validation');

for (const item of unique.values()) {
  if (existsSync(item.localPath)) {
    console.log(`PASS ${item.source} -> ${item.reference} (${relativePath(item.localPath)})`);
  } else {
    failures += 1;
    console.error(`FAIL ${item.source} -> ${item.reference} (${relativePath(item.localPath)})`);
  }
}

if (failures) {
  console.error(`[check:assets] FAIL ${failures}/${unique.size} local asset references are missing.`);
  process.exit(1);
}

console.log(`[check:assets] PASS ${unique.size} local asset references exist.`);
