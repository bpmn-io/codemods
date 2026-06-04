import { expect } from 'chai';

import { parseArgs } from '../lib/cli.js';


describe('cli - parseArgs', function() {

  it('should parse target, dry-run and packages', function() {

    // when
    const options = parseArgs([ 'src', '-d', '-p', 'diagram-js', '--package', 'bpmn-js' ]);

    // then
    expect(options.target).to.equal('src');
    expect(options.dryRun).to.be.true;
    expect(options.packages).to.eql([ 'diagram-js', 'bpmn-js' ]);
  });


  it('should parse --package=<name>', function() {

    // when
    const options = parseArgs([ 'src', '--package=diagram-js' ]);

    // then
    expect(options.packages).to.eql([ 'diagram-js' ]);
  });


  it('should reject a package option that swallows a flag', function() {

    // when
    const parse = () => parseArgs([ 'src', '-p', '-d' ]);

    // then
    expect(parse).to.throw(/requires a package name/);
  });


  it('should reject a trailing package option', function() {

    // when
    const parse = () => parseArgs([ 'src', '--package' ]);

    // then
    expect(parse).to.throw(/requires a package name/);
  });


  it('should reject an empty --package=', function() {

    // when
    const parse = () => parseArgs([ 'src', '--package=' ]);

    // then
    expect(parse).to.throw(/requires a package name/);
  });

});
