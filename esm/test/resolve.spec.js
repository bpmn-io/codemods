import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { expect } from 'chai';

import { resolveImport } from '../lib/resolve.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fromFile = path.join(__dirname, 'fixtures', 'project', 'src', 'index.js');
const fromTsFile = path.join(__dirname, 'fixtures', 'project', 'src', 'typed.ts');


describe('resolve - resolveImport', function() {

  it('should append .js to a bare subpath import', function() {

    // when
    const result = resolveImport('diagram-js/lib/util/Elements', fromFile);

    // then
    expect(result).to.eql({
      status: 'rewrite',
      specifier: 'diagram-js/lib/util/Elements.js'
    });
  });


  it('should append .js to a relative import', function() {

    // when
    const result = resolveImport('./helper', fromFile);

    // then
    expect(result).to.eql({ status: 'rewrite', specifier: './helper.js' });
  });


  it('should write .js for a relative TypeScript source', function() {

    // given
    // ./model resolves to model.ts on disk

    // when
    const result = resolveImport('./model', fromTsFile);

    // then
    expect(result).to.eql({ status: 'rewrite', specifier: './model.js' });
  });


  it('should skip bare package roots', function() {

    // when
    const result = resolveImport('diagram-js', fromFile);

    // then
    expect(result.status).to.equal('skip');
  });


  it('should skip specifiers that already have an extension', function() {

    // when
    const result = resolveImport('diagram-js/lib/util/Elements.js', fromFile);

    // then
    expect(result.status).to.equal('skip');
  });


  it('should skip asset imports', function() {

    // when
    const result = resolveImport('./style.css', fromFile);

    // then
    expect(result.status).to.equal('skip');
  });


  it('should rewrite a relative directory import to index.js', function() {

    // given
    // ./lib resolves to ./lib/index.js on disk

    // when
    const result = resolveImport('./lib', fromFile);

    // then
    expect(result).to.eql({ status: 'rewrite', specifier: './lib/index.js' });
  });


  it('should mark a directory with no index as unresolved', function() {

    // given
    // ./fixtures exists as a directory but has no index file

    // when
    const result = resolveImport('./fixtures', fromFile);

    // then
    expect(result).to.eql({ status: 'unresolved', specifier: './fixtures' });
  });


  it('should mark a missing relative import as unresolved', function() {

    // when
    const result = resolveImport('./does-not-exist', fromFile);

    // then
    expect(result).to.eql({ status: 'unresolved', specifier: './does-not-exist' });
  });


  it('should mark a missing bare subpath as unresolved', function() {

    // when
    const result = resolveImport('diagram-js/lib/util/Nope', fromFile);

    // then
    expect(result.status).to.equal('unresolved');
  });


  it('should skip a self-referencing package subpath covered by own exports', function() {

    // given
    // the fixture package.json has name "test-project" and exports "./export"

    // when
    const result = resolveImport('test-project/export', fromFile);

    // then
    expect(result.status).to.equal('skip');
  });


  describe('package filter', function() {

    it('should rewrite imports of a targeted package', function() {

      // when
      const result = resolveImport(
        'diagram-js/lib/util/Elements', fromFile, { packages: [ 'diagram-js' ] }
      );

      // then
      expect(result).to.eql({
        status: 'rewrite',
        specifier: 'diagram-js/lib/util/Elements.js'
      });
    });


    it('should skip imports of a non-targeted package', function() {

      // when
      const result = resolveImport(
        'diagram-js/lib/util/Elements', fromFile, { packages: [ 'bpmn-js' ] }
      );

      // then
      expect(result.status).to.equal('skip');
    });


    it('should skip relative imports when a filter is given', function() {

      // when
      const result = resolveImport('./helper', fromFile, { packages: [ 'diagram-js' ] });

      // then
      expect(result.status).to.equal('skip');
    });


    it('should match the package exactly, not by prefix', function() {

      // when
      const result = resolveImport(
        'diagram-js-direction/lib/x', fromFile, { packages: [ 'diagram-js' ] }
      );

      // then
      expect(result.status).to.equal('skip');
    });

  });

});
