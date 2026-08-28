import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const sourceIndex = process.argv.indexOf('--source');
const source = sourceIndex >= 0 ? path.resolve(process.argv[sourceIndex + 1] ?? '') : '';

if (!source) throw new Error('Usage: node scripts/create-nortune-manifest.mjs --source <authoritative-runtime-directory>');

const config = JSON.parse(await fs.readFile(path.join(ROOT, 'runtime', 'nortune.config.json'), 'utf8'));

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

const files = [];
for (const file of await walk(source)) {
  const bytes = await fs.readFile(file);
  files.push({
    path: path.relative(source, file).split(path.sep).join('/'),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex')
  });
}
files.sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
  schemaVersion: 1,
  repository: 'officialjivaro/website-nortune-net',
  runtimePath: config.runtimePath,
  files
};

await fs.writeFile(
  path.join(ROOT, 'runtime', 'nortune.manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8'
);

console.log('Captured ' + files.length + ' authoritative runtime files from ' + config.runtimePath + '.');
