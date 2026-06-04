import path from 'node:path';

import { migrate } from './migrate.js';

const HELP = `Usage: npx @bpmn-io/codemods esm [options] <dir|file>

Append explicit extensions to import/export sources so they resolve under
native ES module resolution (e.g. when migrating to a package that ships
"ESM only", such as diagram-js).

Options:
  -d, --dry-run   Report changes without writing files
  -h, --help      Show this help

Exit code is 1 when any import could not be resolved.
`;

/**
 * Run the `esm` codemod CLI.
 *
 * @param {string[]} argv - arguments after the mod name
 */
export function run(argv) {
  const dryRun = argv.includes('--dry-run') || argv.includes('-d');
  const help = argv.includes('--help') || argv.includes('-h');

  if (help) {
    process.stdout.write(HELP);
    return;
  }

  const target = argv.find((arg) => !arg.startsWith('-')) || process.cwd();

  const report = migrate(target, { dryRun });

  print(report, dryRun);

  process.exitCode = report.unresolved.length || report.errors.length ? 1 : 0;
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
