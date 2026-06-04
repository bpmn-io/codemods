#!/usr/bin/env node
import { run as esm } from '../esm/lib/cli.js';

/**
 * Registry of available codemods, keyed by their CLI name.
 *
 * Each handler receives the arguments that follow the mod name.
 *
 * @type {Record<string, (argv: string[]) => void>}
 */
const MODS = {
  esm
};

const HELP = `Usage: npx @bpmn-io/codemods <mod> [options]

A collection of codemods for the bpmn.io ecosystem.

Mods:
${Object.keys(MODS).map((name) => `  ${name}`).join('\n')}

Run a mod with --help for its options, e.g.:
  npx @bpmn-io/codemods esm --help
`;

main(process.argv.slice(2));

function main(argv) {
  const [ mod, ...rest ] = argv;

  if (!mod || mod === '--help' || mod === '-h') {
    process.stdout.write(HELP);
    process.exitCode = mod ? 0 : 1;
    return;
  }

  const handler = MODS[mod];

  if (!handler) {
    process.stderr.write(`Unknown mod: ${mod}\n\n${HELP}`);
    process.exitCode = 1;
    return;
  }

  handler(rest);
}
