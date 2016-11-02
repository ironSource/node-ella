#!/usr/bin/env node
'use strict';

const app = require('commander')
    , Multipack = require('./index')

// "multipack version" is interpreted as "multipack --version"..
// app.version(require('../package.json').version);

app
  .option('-p --production', 'Ignore devDependencies')
  .option('--verbose', 'Verbose output')

app
  .command('install [name...]')
  .alias('i')
  .option('--to [pkg]', 'Target packages (repeated flag)', collect, [])
  .option('-S --save', 'Save to dependencies of target(s)')
  .option('-D --save-dev', 'Save to devDependencies of target(s)')
  .option('-O --save-optional', 'Save to optionalDependencies of targets(s)')
  .option('-E --save-exact', 'Save exact version')
  .option('--ignore-scripts', 'Do not run lifecycle scripts')
  .option('--hash', 'Skip install (next time) if there were no changes')
  .description('Install dependencies')
  .action(function install (names, options) {
    factory().install(names, options)
  })

app
  .command('update [name...]')
  .alias('u')
  .option('--for [pkg]', 'Filter by package name', collect, [])
  .option('--ignore-scripts', 'Do not run lifecycle scripts')
  .description('Update dependencies')
  .action(function update (names, options) {
    factory().update(names, {
      packages: options.for,
      ignoreScripts: options.ignoreScripts
    })
  })

app
  .command('version [target]')
  .description('Update version of all packages, then commit and tag')
  .action(function(target) {
    factory().version(target)
  });

app
  .command('link [name...]')
  .description('Link global dependencies')
  .action(function link (names, options) {
    factory().externalLink(names)
  })

app
  .command('prune')
  .description('Prune dependencies')
  .action(function prune () {
    factory().prune({})
  })

app
  .command('pack [name...]')
  .description('Create a tarball from a package')
  .option('-b --build', 'Run npm build before packing')
  .option('-o --out [path]', 'Write to file (defaults to "<name>-<version>.<ext>")')
  .option('-g --gzip', 'Create a gzipped tarball (tgz)')
  .option('-d --dir [path]', 'Write to a directory instead of a tarball')
  .option('-f --force', 'Overwrite destination (if --dir)')
  .action(function(names, options) {
    factory().pack(names, options)
  });

app
  .command('bundle [name...]')
  .description('Create a self-contained bundle')
  .option('-b --build', 'Run npm build before bundling')
  .option('-o --out [path]', 'Write to file (defaults to "<name>-<version>.<ext>")')
  .option('-g --gzip', 'Create a gzipped tarball (tgz)')
  .option('-d --dir [path]', 'Write to a directory instead of a tarball')
  .option('-f --force', 'Overwrite destination (if --dir)')
  .option('-c --compatible', 'Create an npm-installable bundle')
  .action(function(names, options) {
    factory().bundle(names, options)
  });

app.on('--help', function(){
  console.log('  Examples:\n')
  console.log('    $ multipack install')
  console.log('    $ multipack i --prod')
  console.log('    $ multipack version patch')
  // console.log('    $ multipack prune --verbose')
  // console.log('    $ multipack exec -- ls -A')
  // console.log('    $ multipack ls --depth=1')
  // console.log('    $ multipack version patch')
})

if (process.argv.length === 2) {
  return app.help()
}

function factory() {
  return new Multipack({
    cwd: process.cwd(),
    production: app.production,
    verbose: app.verbose
  })
}

function collect(val, acc) {
  acc.push(val)
  return acc
}

app.parse(process.argv)
