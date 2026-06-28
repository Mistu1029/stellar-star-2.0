const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const markdownFiles = [
  path.join(root, 'README.md'),
  path.join(root, 'docs', 'REQUIREMENT_PROOF_MATRIX.md'),
  path.join(root, 'docs', 'ARCHITECTURE_AND_LIMITATIONS.md'),
  path.join(root, 'docs', 'RELEASE_CHECKLIST.md'),
];

const linkRegex = /!?\[[^\]]*\]\(([^)]+)\)/g;
const ignoreSchemes = ['mailto:', 'tel:'];

function collectLinks(text) {
  const links = [];
  let match;
  while ((match = linkRegex.exec(text)) !== null) {
    const target = match[1].trim();
    if (!target || ignoreSchemes.some((scheme) => target.startsWith(scheme))) continue;
    if (target.startsWith('#')) continue;
    links.push(target);
  }
  return links;
}

function resolveFileLink(link, sourceFile) {
  if (link.startsWith('/')) {
    return path.join(root, link.replace(/^\//, ''));
  }
  return path.resolve(path.dirname(sourceFile), link);
}

const ignoredRemoteHosts = ['localhost', '127.0.0.1'];

function isLocalPath(link) {
  return !/^https?:\/\//i.test(link);
}

function isIgnoredRemote(link) {
  try {
    const parsed = new URL(link);
    return ignoredRemoteHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

async function checkRemoteLink(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    if (response.ok) return true;
    if (response.status === 405 || response.status === 501) {
      const fallback = await fetch(url, { method: 'GET', signal: controller.signal });
      return fallback.ok;
    }
    return false;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function run() {
  const failures = [];
  const seen = new Set();
  const allLinks = [];

  for (const file of markdownFiles) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const links = collectLinks(text);
    for (const link of links) {
      const key = `${file} -> ${link}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allLinks.push({ link, file });
    }
  }

  const localProofAsset = path.join(root, 'public', 'mobile-responsive.png');
  if (!fs.existsSync(localProofAsset)) {
    failures.push(`Missing local proof asset: ${localProofAsset}`);
  }

  const readmeText = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  if (!readmeText.includes('public/mobile-responsive.png')) {
    failures.push('README.md does not reference public/mobile-responsive.png');
  }

  for (const { link, file } of allLinks) {
    if (isLocalPath(link)) {
      const resolved = resolveFileLink(link, file);
      if (!fs.existsSync(resolved)) {
        failures.push(`Broken local link in ${file}: ${link} -> ${resolved}`);
      }
      continue;
    }

    if (isIgnoredRemote(link)) {
      continue;
    }

    const ok = await checkRemoteLink(link);
    if (!ok) {
      failures.push(`Remote link unreachable in ${file}: ${link}`);
    }
  }

  if (failures.length) {
    console.error('Proof link validation failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log('Proof link validation passed.');
}

run().catch((error) => {
  console.error('Proof link checker encountered an error:', error);
  process.exit(1);
});
