#!/usr/bin/env node

const app = require('commander')
    , Ella = require('./index')

app
  .option('--prod, --production', 'Ignore devDependencies')
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
  .command('prune')
  .description('Prune dependencies')
  .action(function prune () {
    factory().prune({})
  })

app.on('--help', function(){
  console.log('  Examples:\n')
  console.log('    $ ella install')
  console.log('    $ ella i --prod')
  // console.log('    $ ella prune --verbose')
  // console.log('    $ ella exec -- ls -A')
  // console.log('    $ ella ls --depth=1')
  // console.log('    $ ella version patch')
})

if (process.argv.length === 2) {
  return app.help()
}

function factory() {
  return new Ella({
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
