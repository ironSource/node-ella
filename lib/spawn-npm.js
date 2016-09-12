'use strict';

const spawn = require('cross-spawn')
    , once = require('once')
    , supportsColor = require('chalk').supportsColor
    , log = require('./log')
    , SoftError = require('./soft-error')
    , handleSpawnError = require('./handle-spawn-error')

module.exports = function (cwd, args, opts, done) {
  if (typeof opts === 'function') done = opts, opts = {}

  done = once(done)
  log.reset()

  if (opts.production) args.push('--production')
  if (opts.ignoreScripts) args.push('--ignore-scripts')

  // Overrule user config, because we need to:
  // 1. disable shrinkwrap (would break everything);
  // 2. resolve dependencies using the same default tag.
  args.push('--no-shrinkwrap')
  args.push('--tag=latest')

  // Force color
  args.push(supportsColor ? '--color=always' : '--no-color')

  const child = spawn('npm', args, {
    cwd: cwd,
    stdio: [ 'ignore', opts.stdout || process.stdout, process.stderr ]
  })

  child.on('error', handleSpawnError(done))
  child.on('close', function (code) {
    if (code) done(new SoftError('npm exited with code ' + code))
    else done()
  })

  return child
}
