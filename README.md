# @bpmn-io/codemods

A collection of codemods for the bpmn.io ecosystem, exposed via CLI.

## Usage

```bash
npx @bpmn-io/codemods <mod> [options]

# e.g.
npx @bpmn-io/codemods esm --dry-run src
```

Run a mod with `--help` for its options.

## Available mods

| Mod | Purpose |
| --- | --- |
| [`esm`](./esm) | Append explicit extensions to imports so they resolve under native ES module resolution (e.g. migrating to "ESM only" packages such as diagram-js). |

## Development

```bash
npm install
npm test
```

`npm test` runs the tests of every mod (`*/test/**/*.spec.js`).

## Adding a mod

> [!NOTE]
> Each mod lives in its own sub-folder with its own library API and tests and is run through a single CLI.

Create a new sub-folder mirroring [`esm`](./esm):

```
<mod>/
  lib/cli.js     # exports `run(argv)` — the CLI handler
  lib/           # library implementation
  test/          # *.spec.js + fixtures
  README.md
```

Then register it in [bin/codemods.js](./bin/codemods.js):

```js
import { run as myMod } from '../<mod>/lib/cli.js';

const MODS = {
  esm,
  myMod
};
```

Add a row to the table above and list `<mod>/lib` in the `files` field of the
root [package.json](./package.json). Shared dev dependencies (`@babel/parser`,
`mocha`, `chai`) live at the root.
