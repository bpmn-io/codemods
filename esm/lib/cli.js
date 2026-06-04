import path from 'node:path';

import { migrate } from './migrate.js';

const HELP = `Usage: npx @bpmn-io/codemods esm [options] <dir|file>

Append explicit extensions to import/export sources so they resolve under
native ES module resolution (e.g. when migrating to a package that ships
"ESM only", such as diagram-js).

Options:
  -p, --package <name>   Only rewrite imports of this package (repeatable);
                         when given, relative and other packages are left alone
  -d, --dry-run          Report changes without writing files
  -h, --help             Show this help

Exit code is 1 when any import could not be resolved.
`;

/**
 * Run the `esm` codemod CLI.
 *
 * @param {string[]} argv - arguments after the mod name
 */
export function run(argv) {
  let options;

  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${HELP}`);
    process.exitCode = 1;
    return;
  }

  const { help, dryRun, packages, target } = options;

  if (help) {
    process.stdout.write(HELP);
    return;
  }

  const report = migrate(target, { dryRun, packages });

  print(report, dryRun);

  process.exitCode = report.unresolved.length || report.errors.length ? 1 : 0;
}

/**
 * Parse the `esm` mod CLI arguments.
 *
 * @param {string[]} argv
 *
 * @return {{ help: boolean, dryRun: boolean, packages: string[], target: string }}
 *
 * @throws {Error} on invalid usage, e.g. a `--package` without a name
 */
export function parseArgs(argv) {
  const options = { help: false, dryRun: false, packages: [], target: null };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--package' || arg === '-p') {
      options.packages.push(requirePackage(arg, argv[++i]));
    } else if (arg.startsWith('--package=')) {
      options.packages.push(requirePackage('--package', arg.slice('--package='.length)));
    } else if (!arg.startsWith('-') && options.target === null) {
      options.target = arg;
    }
  }

  options.target = options.target || process.cwd();

  return options;
}

/**
 * Guard against a `--package` option that is missing its value or accidentally
 * swallowed a following flag (e.g. `-p -d`).
 */
function requirePackage(flag, value) {
  if (!value || value.startsWith('-')) {
    throw new Error(`Option ${flag} requires a package name, got: ${value ?? '(none)'}`);
  }

  return value;
}

function print(report, dryRun) {
  const rel = (file) => path.relative(process.cwd(), file) || file;

  if (report.rewrites.length) {
    process.stdout.write(`\n${dryRun ? 'Would rewrite' : 'Rewrote'} imports:\n`);

    for (const { file, from, to, line } of report.rewrites) {
      process.stdout.write(`  ${rel(file)}:${line}  ${from} -> ${to}\n`);
    }
  }

  if (report.unresolved.length) {
    process.stdout.write('\nCould not resolve (please check manually):\n');

    for (const { file, specifier, line } of report.unresolved) {
      process.stdout.write(`  ${rel(file)}:${line}  ${specifier}\n`);
    }
  }

  if (report.errors.length) {
    process.stdout.write('\nFailed to parse:\n');

    for (const { file, message } of report.errors) {
      process.stdout.write(`  ${rel(file)}  ${message}\n`);
    }
  }

  process.stdout.write(
    `\n${report.filesScanned} file(s) scanned, ` +
    `${report.filesChanged} changed, ` +
    `${report.importsRewritten} import(s) rewritten, ` +
    `${report.unresolved.length} unresolved.\n`
  );
}
