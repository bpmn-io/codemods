import fs from 'node:fs';
import path from 'node:path';

import { transform } from './transform.js';

const SOURCE_EXTENSIONS = new Set([ '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx' ]);
const IGNORED_DIRECTORIES = new Set([ 'node_modules', '.git' ]);

/**
 * @typedef {Object} Report
 * @property {number} filesScanned
 * @property {number} filesChanged
 * @property {number} importsRewritten
 * @property {Array<{ file: string, from: string, to: string, line: number }>} rewrites
 * @property {Array<{ file: string, specifier: string, line: number }>} unresolved
 * @property {Array<{ file: string, message: string }>} errors
 */

/**
 * Recursively migrate all JS/TS files below `target` (or a single file),
 * appending explicit extensions to imports that would otherwise not resolve
 * under native ES module resolution.
 *
 * @param {string} target - directory or file to migrate
 * @param {{ dryRun?: boolean }} [options]
 *
 * @return {Report}
 */
export function migrate(target, options = {}) {
  const { dryRun = false } = options;

  const report = {
    filesScanned: 0,
    filesChanged: 0,
    importsRewritten: 0,
    rewrites: [],
    unresolved: [],
    errors: []
  };

  for (const file of collectFiles(path.resolve(target))) {
    report.filesScanned++;

    const code = fs.readFileSync(file, 'utf8');
    const result = transform(code, file);

    if (result.error) {
      report.errors.push({ file, message: result.error.message });
      continue;
    }

    for (const u of result.unresolved) {
      report.unresolved.push({ file, ...u });
    }

    if (result.changed) {
      report.filesChanged++;
      report.importsRewritten += result.changes.length;

      for (const c of result.changes) {
        report.rewrites.push({ file, ...c });
      }

      if (!dryRun) {
        fs.writeFileSync(file, result.code);
      }
    }
  }

  return report;
}

function* collectFiles(target) {
  const stat = fs.statSync(target);

  if (stat.isFile()) {
    yield target;
    return;
  }

  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        yield* collectFiles(full);
      }
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      yield full;
    }
  }
}
