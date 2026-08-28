import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const RUNTIME = path.join(ROOT, 'runtime');
const config = JSON.parse(await fs.readFile(path.join(RUNTIME, 'nortune.config.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(RUNTIME, 'nortune.manifest.json'), 'utf8'));

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function relative(file, root = DIST) {
  return path.relative(root, file).split(path.sep).join('/');
}

async function fingerprint(file) {
  const bytes = await fs.readFile(file);
  return {
    path: relative(file),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex')
  };
}

const files = (await Promise.all((await walk(DIST)).map(fingerprint))).sort((a, b) => a.path.localeCompare(b.path));
const errors = [];
const expected = new Map(manifest.files.map((file) => [file.path, file]));
const actual = new Map(files.map((file) => [file.path, file]));

for (const [file, record] of expected) {
  const candidate = actual.get(file);
  if (!candidate) errors.push('Missing runtime file: ' + file);
  else if (candidate.bytes !== record.bytes || candidate.sha256 !== record.sha256) errors.push('Runtime file differs from Nortune: ' + file);
}
for (const file of actual.keys()) if (!expected.has(file)) errors.push('Unexpected runtime file: ' + file);

const html = await fs.readFile(path.join(DIST, 'index.html'), 'utf8');
const canonical = 'https://nortune.net/' + config.kind + '/' + config.slug + '/';
for (const required of ['data-runtime-brand="nortune"', 'noindex, follow', canonical, './assets/nortune-storage-guard-c4f8a1.js']) {
  if (!html.includes(required)) errors.push('Runtime index is missing: ' + required);
}
if (/(?:src|href)=["']\/assets\//i.test(html)) errors.push('Runtime index contains a root-relative application asset.');
if (/__NORTUNE_[A-Z_]+__/.test(html)) errors.push('Runtime index contains an unresolved build placeholder.');

for (const file of await walk(DIST)) {
  if (/\.map$/i.test(file)) errors.push('Source map is not allowed: ' + relative(file));
  if (!/\.(?:html|js|css)$/i.test(file)) continue;
  const text = await fs.readFile(file, 'utf8');
  if (/\bAerod\b/i.test(text)) errors.push('Foreign branding remains in: ' + relative(file));
}

if (errors.length) {
  console.error('Nortune runtime verification failed with ' + errors.length + ' issue(s):');
  for (const error of errors) console.error('- ' + error);
  process.exit(1);
}

console.log('Verified ' + files.length + ' files: dist is byte-identical to ' + manifest.runtimePath + '.');
