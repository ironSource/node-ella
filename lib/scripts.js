'use strict';

const readJSON = require('./read-json')
    , spawnNpm = require('./spawn-npm')
    , log = require('./log')
    , join = require('path').join
    , xtend = require('xtend')

module.exports = class Scripts {
  constructor() {

  }

  run(cwd, dir, script, opts, done) {
    readJSON(join(cwd, dir, 'package.json'), (err, pkg) => {
      if (err) return done(err)

      if (!pkg.scripts || !pkg.scripts[script]) {
        log.verbose('%s has no %s script, skipping', dir, script)
        return done()
      }

      log.info('%s %s', script, dir)

      opts = xtend({ stdout: process.stderr }, opts)
      spawnNpm(join(cwd, dir), ['run', script], opts, done)
    })
  }
}
