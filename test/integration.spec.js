import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect } from 'chai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rootDir = path.resolve(__dirname, '..');
const exampleDir = path.join(__dirname, 'fixtures', 'example');
const snapshotDir = path.join(__dirname, 'fixtures', 'snapshots');


describe('integration', function() {

  // installing via `file:` runs a full npm install
  this.timeout(120000);

  let projectDir;

  beforeEach(function() {
    projectDir = installExampleProject(rootDir);
  });

  afterEach(function() {
    if (projectDir) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });


  it('should rewrite the example project through the installed CLI', function() {

    // when
    runCodemods(projectDir, [ 'esm', 'src' ]);

    // then
    verifySnapshots(projectDir, 'esm');
  });

});


/**
 * Copy the example project fixture to a throwaway directory and install this
 * package into it via `file:`, exactly as a consumer would.
 */
function installExampleProject(root) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codemods-it-'));

  fs.cpSync(exampleDir, dir, { recursive: true });

  execFileSync(
    'npm',
    [ 'install', `file:${root}`, '--prefer-offline', '--no-audit', '--no-fund' ],
    { cwd: dir, stdio: 'pipe' }
  );

  return dir;
}

function runCodemods(cwd, args) {
  return execFileSync(
    'npx',
    [ '--no-install', '@bpmn-io/codemods', ...args ],
    { cwd, encoding: 'utf8' }
  );
}

/**
 * Assert that two directory trees contain the same files with identical
 * contents.
 */
function verifySnapshots(workingDir, snapshotName) {

  const actualDir = path.join(workingDir, 'src');
  const expectedDir = path.join(snapshotDir, snapshotName, 'src');

  const actual = listFiles(actualDir);
  const expected = listFiles(expectedDir);

  expect(actual, 'file list').to.eql(expected);

  for (const file of expected) {
    expect(
      fs.readFileSync(path.join(actualDir, file), 'utf8'),
      `contents of ${file}`
    ).to.equal(fs.readFileSync(path.join(expectedDir, file), 'utf8'));
  }
}

function listFiles(dir, base = dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFiles(full, base));
    } else {
      files.push(path.relative(base, full));
    }
  }

  return files.sort();
}
