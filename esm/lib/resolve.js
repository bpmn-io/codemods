import fs from 'node:fs';
import path from 'node:path';

/**
 * Extensions that, when already present on a specifier, mean the import is
 * explicit and must be left untouched (module sources as well as assets that
 * are handled by bundlers, never by ES module resolution).
 */
const KNOWN_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.json', '.node',
  '.css', '.scss', '.sass', '.less', '.styl',
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.wasm',
  '.html', '.xml', '.md', '.txt', '.vue', '.bpmn', '.dmn', '.form'
]);

/**
 * Extensions tried for relative imports, in priority order, mapped to the
 * extension that should be written into the specifier.
 *
 * TypeScript / JSX source files are resolved with `.js` specifiers (the
 * NodeNext / "ESM only" convention), even though the file on disk is `.ts`.
 */
const RELATIVE_CANDIDATES = [
  { file: '.js', write: '.js' },
  { file: '.jsx', write: '.js' },
  { file: '.ts', write: '.js' },
  { file: '.tsx', write: '.js' },
  { file: '.mjs', write: '.mjs' },
  { file: '.cjs', write: '.cjs' },
  { file: '.json', write: '.json' }
];

/**
 * Extensions tried for bare (node_modules) imports. Published packages ship
 * compiled files, so we only look for runtime extensions.
 */
const BARE_CANDIDATES = [
  { file: '.js', write: '.js' },
  { file: '.mjs', write: '.mjs' },
  { file: '.cjs', write: '.cjs' },
  { file: '.json', write: '.json' }
];

/**
 * Decide how a single import specifier should be migrated for native ES
 * module resolution.
 *
 * @param {string} specifier - the raw import source, e.g. `diagram-js/lib/util/Elements`
 * @param {string} fromFile - absolute path of the importing file
 * @param {{ packages?: string[] }} [options] - if `packages` is non-empty, only
 *   imports of those packages are considered; everything else is skipped
 *
 * @return {{ status: ('skip'|'rewrite'|'unresolved'), specifier: string }}
 *   `skip` if already resolvable or filtered out by `options.packages`, `rewrite` with the new specifier if an
 *   extension was appended, `unresolved` if no `.js`-style extension resolves.
 */
export function resolveImport(specifier, fromFile, options = {}) {
  const bare = isBare(specifier);

  // when restricted to specific packages, only their (bare) imports apply
  if (options.packages && options.packages.length && !targetsPackage(specifier, bare, options.packages)) {
    return { status: 'skip', specifier };
  }

  // bare package roots (e.g. 'react', 'diagram-js') resolve via main/exports
  if (bare && isBareRoot(specifier)) {
    return { status: 'skip', specifier };
  }

  // already carries an explicit extension
  if (KNOWN_EXTENSIONS.has(specifierExtension(specifier))) {
    return { status: 'skip', specifier };
  }

  // bare subpath covered by package.json exports → already valid for ESM
  if (bare && isSubpathExported(specifier, fromFile)) {
    return { status: 'skip', specifier };
  }

  const rewritten = bare
    ? resolveBare(specifier, fromFile)
    : resolveRelative(specifier, fromFile);

  if (rewritten) {
    return { status: 'rewrite', specifier: rewritten };
  }

  return { status: 'unresolved', specifier };
}

function resolveRelative(specifier, fromFile) {
  const base = path.resolve(path.dirname(fromFile), specifier);

  const direct = resolveCandidates(base, specifier, RELATIVE_CANDIDATES);
  if (direct) return direct;

  // directory import: specifier points to a directory, try <dir>/index.*
  if (isDirectory(base)) {
    return resolveCandidates(
      path.join(base, 'index'),
      specifier + '/index',
      RELATIVE_CANDIDATES
    );
  }

  return null;
}

function resolveBare(specifier, fromFile) {
  const { pkg, subpath } = parseBare(specifier);

  const pkgDir = findPackageDir(pkg, path.dirname(fromFile));

  if (!pkgDir) {
    return null;
  }

  const basePath = path.join(pkgDir, subpath);

  const direct = resolveCandidates(basePath, specifier, BARE_CANDIDATES);
  if (direct) return direct;

  if (isDirectory(basePath)) {
    return resolveCandidates(
      path.join(basePath, 'index'),
      specifier + '/index',
      BARE_CANDIDATES
    );
  }

  return null;
}

function resolveCandidates(basePath, specifier, candidates) {
  for (const { file, write } of candidates) {
    if (isFile(basePath + file)) {
      return specifier + write;
    }
  }

  return null;
}

/**
 * Locate a package directory by walking up the `node_modules` chain, starting
 * from the importing file's directory. Also handles self-referencing: if a
 * directory's own `package.json` names the package, that directory is returned.
 */
function findPackageDir(pkg, fromDir) {
  let dir = fromDir;

  for (;;) {
    const candidate = path.join(dir, 'node_modules', pkg);

    if (isDirectory(candidate)) {
      return candidate;
    }

    if (readJson(path.join(dir, 'package.json'))?.name === pkg) {
      return dir;
    }

    const parent = path.dirname(dir);

    if (parent === dir) {
      return null;
    }

    dir = parent;
  }
}

function parseBare(specifier) {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');

    return {
      pkg: parts.slice(0, 2).join('/'),
      subpath: parts.slice(2).join('/')
    };
  }

  const idx = specifier.indexOf('/');

  return idx === -1
    ? { pkg: specifier, subpath: '' }
    : { pkg: specifier.slice(0, idx), subpath: specifier.slice(idx + 1) };
}

function isBare(specifier) {
  return !specifier.startsWith('.') && !specifier.startsWith('/');
}

function isBareRoot(specifier) {
  return parseBare(specifier).subpath === '';
}

/**
 * Whether the specifier imports from one of the given packages.
 */
function targetsPackage(specifier, bare, packages) {
  return bare && packages.includes(parseBare(specifier).pkg);
}

function specifierExtension(specifier) {
  const segment = specifier.split('/').pop();
  const dot = segment.lastIndexOf('.');

  return dot <= 0 ? '' : segment.slice(dot).toLowerCase();
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Returns true if the bare subpath import is declared in the package's
 * `exports` field, meaning it is already valid for ESM and should not be
 * rewritten.
 */
function isSubpathExported(specifier, fromFile) {
  const { pkg, subpath } = parseBare(specifier);
  if (!subpath) return false;

  const pkgDir = findPackageDir(pkg, path.dirname(fromFile));
  if (!pkgDir) return false;

  const exports = readJson(path.join(pkgDir, 'package.json'))?.exports;
  if (!exports || typeof exports !== 'object') return false;

  const key = './' + subpath;

  if (key in exports) return true;

  for (const [ pattern, valueTemplate ] of Object.entries(exports)) {
    if (!pattern.includes('*') || typeof valueTemplate !== 'string') {
      continue;
    }

    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '(.*)');
    const match = new RegExp('^' + escaped + '$').exec(key);

    if (!match) continue;

    // wildcard matched: only treat as already-valid if the resolved target
    // is an actual file — a directory target still needs rewriting to index.js
    const resolved = valueTemplate.replace(/\*/g, match[1]);
    if (isFile(path.join(pkgDir, resolved))) return true;
  }

  return false;
}
