# esm codemod

Appends explicit extensions to `import` / `export ... from` sources and dynamic
`import('...')` calls so they resolve under **native ES module resolution**.

This is useful when migrating to a package that ships "ESM only". For example,
[diagram-js](https://github.com/bpmn-io/diagram-js) used to allow extension-less
deep imports of its utilities; the ESM-only releases require an explicit
extension:

```diff
- import { getParents } from 'diagram-js/lib/util/Elements';
+ import { getParents } from 'diagram-js/lib/util/Elements.js';
```

The mod is not tied to diagram-js — it works for any relative or package import
whose target file exists once an extension is appended.

## Usage

```bash
npx @bpmn-io/codemods esm <dir|file>

# preview without writing
npx @bpmn-io/codemods esm --dry-run src
```

Run it from your project root so that `node_modules` (the installed,
already-migrated package) is reachable for resolution.

The command exits with code `1` if any import could not be resolved, so it can
be used as a CI guard.

## What it does

For every `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts` and `.tsx` file below the target
(ignoring `node_modules` and `.git`):

1. Each static `import` / `export ... from` source, and every dynamic
   `import('...')` call with a string-literal argument, is checked against ES
   module resolution.
2. If the specifier does not resolve as written but does once an extension is
   appended, the extension is added.
   - Relative and bare (`node_modules`) specifiers are both handled.
   - TypeScript / JSX sources are written with a `.js` specifier (NodeNext
     convention), even though the file on disk is `.ts`/`.tsx`.
3. Specifiers that already carry an extension, and bare package roots
   (e.g. `diagram-js`, `react`), are left untouched.
4. Anything that still cannot be resolved (e.g. a directory import that would
   need `/index.js`, or a genuinely missing file) is **reported** for manual
   review — never silently changed.

Only the source string is edited; surrounding formatting is preserved exactly.

## Programmatic API

```js
import { migrate } from '@bpmn-io/codemods/esm/lib/migrate.js';

const report = migrate('src', { dryRun: true });
```

### Out of scope

By design, the mod does **not**:

- rewrite `require()` calls,
- rewrite dynamic imports with a non-literal argument (`import(name)`),
- add `/index.js` for directory imports,
- guess at unresolvable imports — these are reported instead.
