import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { expect } from 'chai';

import { transform } from '../lib/transform.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const indexFile = path.join(__dirname, 'fixtures', 'project', 'src', 'index.js');
const typedFile = path.join(__dirname, 'fixtures', 'project', 'src', 'typed.ts');


describe('transform', function() {

  it('should rewrite resolvable imports and report the rest', function() {

    // given
    const code = [
      "import { getParents } from 'diagram-js/lib/util/Elements';",
      "import { help } from './helper';",
      "import { gone } from './does-not-exist';",
      "import Diagram from 'diagram-js';"
    ].join('\n');

    // when
    const result = transform(code, indexFile);

    // then
    expect(result.error).to.be.null;
    expect(result.changed).to.be.true;

    expect(result.code).to.equal([
      "import { getParents } from 'diagram-js/lib/util/Elements.js';",
      "import { help } from './helper.js';",
      "import { gone } from './does-not-exist';",
      "import Diagram from 'diagram-js';"
    ].join('\n'));

    expect(result.unresolved).to.eql([
      { specifier: './does-not-exist', line: 3 }
    ]);
  });


  it('should preserve the original quote style', function() {

    // given
    const code = 'import { help } from "./helper";';

    // when
    const result = transform(code, indexFile);

    // then
    expect(result.code).to.equal('import { help } from "./helper.js";');
  });


  it('should rewrite re-export sources', function() {

    // given
    const code = "export { help } from './helper';";

    // when
    const result = transform(code, indexFile);

    // then
    expect(result.code).to.equal("export { help } from './helper.js';");
  });


  it('should leave plain exports untouched', function() {

    // given
    const code = 'export const a = 1;';

    // when
    const result = transform(code, indexFile);

    // then
    expect(result.changed).to.be.false;
    expect(result.code).to.equal(code);
  });


  it('should rewrite dynamic imports with a string argument', function() {

    // given
    const code = [
      "const a = import('./helper');",
      "load(() => import('diagram-js/lib/util/Elements'));"
    ].join('\n');

    // when
    const result = transform(code, indexFile);

    // then
    expect(result.code).to.equal([
      "const a = import('./helper.js');",
      "load(() => import('diagram-js/lib/util/Elements.js'));"
    ].join('\n'));
  });


  it('should ignore dynamic imports with a non-literal argument', function() {

    // given
    const code = 'const a = import(`./${name}`);';

    // when
    const result = transform(code, indexFile);

    // then
    expect(result.changed).to.be.false;
    expect(result.code).to.equal(code);
  });


  it('should handle TypeScript type imports', function() {

    // given
    const code = [
      "import { getParents } from 'diagram-js/lib/util/Elements';",
      "import type { Thing } from './model';"
    ].join('\n');

    // when
    const result = transform(code, typedFile);

    // then
    expect(result.code).to.equal([
      "import { getParents } from 'diagram-js/lib/util/Elements.js';",
      "import type { Thing } from './model.js';"
    ].join('\n'));
  });


  it('should report a parse error without throwing', function() {

    // given
    const code = 'import { from }}}';

    // when
    const result = transform(code, indexFile);

    // then
    expect(result.error).to.be.an('error');
    expect(result.changed).to.be.false;
  });

});
