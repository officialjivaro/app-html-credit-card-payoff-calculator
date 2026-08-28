import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const RUNTIME = path.join(ROOT, 'runtime');
const TOOL_KINDS = ['apps', 'calculators', 'software'];
const KIND_LABELS = { apps: 'Apps', calculators: 'Calculators', software: 'Software' };
const KIND_ATTRIBUTION = { apps: 'A Nortune app', calculators: 'A Nortune calculator', software: 'A Nortune product' };

const config = JSON.parse(await fs.readFile(path.join(RUNTIME, 'nortune.config.json'), 'utf8'));
const { kind, slug } = config;

if (!TOOL_KINDS.includes(kind)) throw new Error('Unsupported Nortune tool kind: ' + kind);
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid Nortune tool slug: ' + slug);

function escapeRegExp(value) {
  return value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
}

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

function normalizeDirectoryNavigation(output) {
  const target = '/' + kind + '/';
  const label = KIND_LABELS[kind];

  output = output.replace(
    /<a(\s+[^>]*?)href=["']\/(?:apps|calculators|software)\/?["']([^>]*)>(?:Apps|Calculators|Software)<\/a>/gi,
    '<a$1href="' + target + '"$2>' + label + '</a>'
  );

  for (const quote of ['"', "'", String.fromCharCode(96)]) {
    for (const sourceKind of TOOL_KINDS) {
      const sourceLabel = KIND_LABELS[sourceKind];
      for (const sourcePath of ['/' + sourceKind, '/' + sourceKind + '/']) {
        output = output.replaceAll(
          'href:' + quote + sourcePath + quote + ',children:' + quote + sourceLabel + quote,
          'href:' + quote + target + quote + ',children:' + quote + label + quote
        );
      }
    }
  }
  return output;
}

function normalizeToolText(text) {
  const attribution = KIND_ATTRIBUTION[kind];
  let output = text
    .replace(/(<(?:script|link)\b[^>]*(?:src|href)=["'])\/assets\//gi, '$1./assets/')
    .replace(/<base\s+href=["']\/["']\s*\/?>/gi, '<base href="./" />')
    .replace(/\bAerod home\b/gi, 'Nortune home')
    .replace(/An\s+app\s+by\s+(?:aerod|nortune)\.net/gi, attribution)
    .replace(/An\s+app\s+by\s+Nortune/gi, attribution)
    .replace(/A\s+Nortune\s+(?:app|calculator|product)/gi, attribution)
    .replace(
      /No account, backend, or hidden tracking\. Your numbers stay in this browser unless you download a file\./gi,
      'No account or bank connection is required. Tool inputs stay in this browser unless you download or share a file.'
    )
    .replace(new RegExp('aerod-' + escapeRegExp(slug), 'gi'), 'nortune-' + slug);

  output = normalizeDirectoryNavigation(output);

  for (const directory of TOOL_KINDS) {
    for (const quote of ['"', "'", String.fromCharCode(96)]) {
      output = output.replaceAll('href=' + quote + '/' + directory + quote, 'href=' + quote + '/' + directory + '/' + quote);
      output = output.replaceAll('href:' + quote + '/' + directory + quote, 'href:' + quote + '/' + directory + '/' + quote);
    }
  }
  return output;
}

const generatedAssets = (await fs.readdir(path.join(DIST, 'assets'))).sort();
const applicationScripts = generatedAssets.filter((name) => /^index-.+\.js$/i.test(name));
const applicationStyles = generatedAssets.filter((name) => /^index-.+\.css$/i.test(name));

if (applicationScripts.length !== 1) throw new Error('Expected one generated application script, found: ' + applicationScripts.join(', '));
if (applicationStyles.length !== 1) throw new Error('Expected one generated application stylesheet, found: ' + applicationStyles.join(', '));

let applicationScript = applicationScripts[0];
let applicationStyle = applicationStyles[0];

for (const file of await walk(DIST)) {
  if (!/\.(?:html|js|css)$/i.test(file)) continue;
  const text = await fs.readFile(file, 'utf8');
  const normalized = normalizeToolText(text);
  if (normalized !== text) await fs.writeFile(file, normalized, 'utf8');
}

if (config.outputScript && applicationScript !== config.outputScript) {
  await fs.rename(path.join(DIST, 'assets', applicationScript), path.join(DIST, 'assets', config.outputScript));
  applicationScript = config.outputScript;
}
if (config.outputStyle && applicationStyle !== config.outputStyle) {
  await fs.rename(path.join(DIST, 'assets', applicationStyle), path.join(DIST, 'assets', config.outputStyle));
  applicationStyle = config.outputStyle;
}

const runtimeAssets = path.join(RUNTIME, 'assets');
for (const entry of await fs.readdir(runtimeAssets, { withFileTypes: true })) {
  if (!entry.isFile()) throw new Error('Runtime asset must be a file: ' + entry.name);
  if (/\.map$/i.test(entry.name)) throw new Error('Source maps are not permitted in the runtime: ' + entry.name);
  await fs.copyFile(path.join(runtimeAssets, entry.name), path.join(DIST, 'assets', entry.name));
}

const template = await fs.readFile(path.join(RUNTIME, 'nortune-index.template.html'), 'utf8');
const html = template
  .replaceAll('__NORTUNE_APP_SCRIPT__', applicationScript)
  .replaceAll('__NORTUNE_APP_STYLE__', applicationStyle);

if (/__NORTUNE_[A-Z_]+__/.test(html)) throw new Error('The Nortune index template contains unresolved placeholders.');
await fs.writeFile(path.join(DIST, 'index.html'), html, 'utf8');

console.log('Built Nortune runtime for ' + kind + '/' + slug + '.');
