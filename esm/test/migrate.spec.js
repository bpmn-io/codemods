import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect } from 'chai';

import { migrate } from '../lib/migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fixture = path.join(__dirname, 'fixtures', 'project');


describe('migrate', function() {

  it('should not write files in dry-run mode', function() {

    // given
    const before = fs.readFileSync(path.join(fixture, 'src', 'index.js'), 'utf8');

    // when
    const report = migrate(fixture, { dryRun: true });

    // then
    expect(report.filesChanged).to.be.greaterThan(0);
    expect(report.importsRewritten).to.be.greaterThan(0);

    expect(fs.readFileSync(path.join(fixture, 'src', 'index.js'), 'utf8')).to.equal(before);
  });


  it('should rewrite files and report unresolved imports', function() {

    // given
    const dir = copyFixture();

    // when
    const report = migrate(dir);

    // then
    const index = fs.readFileSync(path.join(dir, 'src', 'index.js'), 'utf8');

    expect(index).to.contain("'diagram-js/lib/util/Elements.js'");
    expect(index).to.contain("'./helper.js'");
    expect(index).to.contain("'./lib/index.js'");
    expect(index).to.contain("import('./helper.js')");
    expect(index).to.contain("'./does-not-exist'");
    expect(index).to.contain("'diagram-js'");

    expect(report.unresolved).to.deep.include.members([
      {
        file: path.join(dir, 'src', 'index.js'),
        specifier: './does-not-exist',
        line: 3
      }
    ]);
  });


  it('should only rewrite the given packages', function() {

    // given
    const dir = copyFixture();

    // when
    const report = migrate(dir, { packages: [ 'diagram-js' ] });

    // then
    const index = fs.readFileSync(path.join(dir, 'src', 'index.js'), 'utf8');

    // diagram-js rewritten, relative imports left untouched
    expect(index).to.contain("'diagram-js/lib/util/Elements.js'");
    expect(index).to.contain("from './helper'");
    expect(index).to.contain("import('./helper')");

    // non-targeted imports are not reported as unresolved
    expect(report.unresolved).to.be.empty;
  });


  it('should not descend into node_modules', function() {

    // when
    const report = migrate(fixture, { dryRun: true });

    // then
    const touchedNodeModules = report.rewrites.some(
      ({ file }) => file.includes(`${path.sep}node_modules${path.sep}`)
    );

    expect(touchedNodeModules).to.be.false;
  });

});


function copyFixture() {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'codemod-'));

  fs.cpSync(fixture, dest, { recursive: true });

  return dest;
}
