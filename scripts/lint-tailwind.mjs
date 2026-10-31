import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { __unstable__loadDesignSystem } from 'tailwindcss';

const rootDir = resolve(import.meta.dirname, '..');
const cssPath = join(rootDir, 'src', 'ui', 'styles.css');
const uiDir = join(rootDir, 'src', 'ui');

function collectTsxFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectTsxFiles(fullPath));
    } else if (fullPath.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractClassLiterals(source) {
  const literals = [];
  const classAttrRegex = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;
  for (const match of source.matchAll(classAttrRegex)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? '';
    const cleaned = raw.replace(/\$\{[^}]*\}/g, ' ');
    const tokens = cleaned
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length > 0) {
      literals.push(tokens);
    }
  }

  const ternaryStringRegex = /\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]*)['"]/g;
  for (const match of source.matchAll(ternaryStringRegex)) {
    for (const group of [match[1], match[2]]) {
      if (!group) continue;
      const tokens = group
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (tokens.length > 0) {
        literals.push(tokens);
      }
    }
  }

  return literals;
}

const cssContent = readFileSync(cssPath, 'utf8');
const designSystem = await __unstable__loadDesignSystem(cssContent, {
  base: dirname(cssPath),
  loadStylesheet: async (id) => {
    if (id === 'tailwindcss') {
      const twPath = resolve(rootDir, 'node_modules/tailwindcss/index.css');
      return {
        path: twPath,
        base: dirname(twPath),
        content: readFileSync(twPath, 'utf8'),
      };
    }
    throw new Error(`Unsupported stylesheet import: ${id}`);
  },
});

const files = collectTsxFiles(uiDir);
const errors = [];

for (const file of files) {
  const relFile = relative(rootDir, file);
  const content = readFileSync(file, 'utf8');
  const tokenGroups = extractClassLiterals(content);

  for (const tokens of tokenGroups) {
    const seen = new Set();
    for (const token of tokens) {
      if (seen.has(token)) {
        errors.push(`${relFile}: Duplicate Tailwind class "${token}"`);
      }
      seen.add(token);

      const [css] = designSystem.candidatesToCss([token]);
      if (!css && token !== 'group' && token !== 'peer') {
        errors.push(`${relFile}: Unknown or invalid Tailwind class "${token}"`);
        continue;
      }

      const [canonical] = designSystem.canonicalizeCandidates([token], { rem: 16 });
      if (canonical && canonical !== token) {
        errors.push(
          `${relFile}: Non-canonical Tailwind class "${token}" -> use "${canonical}" instead`
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Tailwind CSS Linter found issues:');
  for (const err of errors) {
    console.error(`  × ${err}`);
  }
  process.exit(1);
}

console.log(`Checked Tailwind CSS classes in ${files.length} TSX files. No warnings or errors.`);
