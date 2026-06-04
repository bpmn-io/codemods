import path from 'node:path';

import { parse } from '@babel/parser';

import { resolveImport } from './resolve.js';

/**
 * Rewrite the import/export sources of a single file so that they resolve
 * under native ES module resolution.
 *
 * Only the source string literals are touched; the rest of the file is left
 * byte-for-byte unchanged.
 *
 * @param {string} code - the file contents
 * @param {string} filename - absolute path of the file (used for resolution)
 * @param {{ packages?: string[] }} [options] - passed through to the resolver
 *
 * @return {{
 *   code: string,
 *   changed: boolean,
 *   changes: Array<{ from: string, to: string, line: number }>,
 *   unresolved: Array<{ specifier: string, line: number }>,
 *   error: (Error|null)
 * }}
 */
export function transform(code, filename, options = {}) {
  let ast;

  try {
    ast = parse(code, {
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      plugins: pluginsFor(filename)
    });
  } catch (error) {
    return { code, changed: false, changes: [], unresolved: [], error };
  }

  const edits = [];
  const changes = [];
  const unresolved = [];

  for (const source of importSources(ast)) {
    const result = resolveImport(source.value, filename, options);
    const line = source.loc.start.line;

    if (result.status === 'rewrite') {
      const quote = code[source.start];

      edits.push({
        start: source.start,
        end: source.end,
        text: quote + result.specifier + quote
      });

      changes.push({ from: source.value, to: result.specifier, line });
    } else if (result.status === 'unresolved') {
      unresolved.push({ specifier: source.value, line });
    }
  }

  return {
    code: applyEdits(code, edits),
    changed: edits.length > 0,
    changes,
    unresolved,
    error: null
  };
}

/**
 * Collect the source string literals of all static `import`/`export ... from`
 * declarations as well as dynamic `import('...')` calls with a string argument.
 *
 * Dynamic imports with a non-literal argument (template, variable) cannot be
 * resolved statically and are therefore ignored.
 */
function importSources(ast) {
  const sources = [];

  for (const node of walk(ast.program)) {
    if (
      (node.type === 'ImportDeclaration' ||
        node.type === 'ExportNamedDeclaration' ||
        node.type === 'ExportAllDeclaration') &&
      node.source
    ) {
      sources.push(node.source);
    } else if (node.type === 'CallExpression' && node.callee.type === 'Import') {
      const [ arg ] = node.arguments;

      if (arg && arg.type === 'StringLiteral') {
        sources.push(arg);
      }
    }
  }

  return sources;
}

/**
 * Depth-first traversal over every AST node, dependency-free.
 */
function* walk(node) {
  yield node;

  for (const key in node) {
    const value = node[key];

    if (Array.isArray(value)) {
      for (const child of value) {
        if (isNode(child)) {
          yield* walk(child);
        }
      }
    } else if (isNode(value)) {
      yield* walk(value);
    }
  }
}

function isNode(value) {
  return value !== null && typeof value === 'object' && typeof value.type === 'string';
}

/**
 * Apply replacements to the source string. Edits are applied back-to-front so
 * that earlier offsets stay valid.
 */
function applyEdits(code, edits) {
  let result = code;

  for (const { start, end, text } of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, start) + text + result.slice(end);
  }

  return result;
}

function pluginsFor(filename) {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.ts') {
    return [ 'typescript', 'decorators-legacy' ];
  }

  if (ext === '.tsx') {
    return [ 'typescript', 'jsx', 'decorators-legacy' ];
  }

  return [ 'jsx', 'decorators-legacy' ];
}
