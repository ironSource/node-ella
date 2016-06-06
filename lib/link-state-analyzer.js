'use strict'

const fs = require('fs')
    , after = require('after')
    , path = require('path')
    , each = require('async-each')
    , pathIsInside = require('path-is-inside')
    , LinkState = require('./link-state')
    , readJSON = require('./read-json')
    , log = require('./log')

const join = path.join
    , relative = path.relative

module.exports = class Analyzer {
  constructor (cwd, names, state) {
    this.cwd = cwd
    this.names = names
    this.state = state
  }

  analyze (dir, links, done) {
    const missing = new Set(links)
        , ok = new Set
        , extraneous = new Set
        , custom = new Map
        , nm = join(this.cwd, dir, 'node_modules')
        , self = this

    fs.readdir(nm, function (err, files) {
      if (err && err.code === 'ENOENT') {
        self.state.saveAnalysis(dir, ok, missing, extraneous, custom)
        done()
      } else if (err) {
        done(err)
      } else {
        each(files, check, function (err) {
          if (err) return done(err)
          self.state.saveAnalysis(dir, ok, missing, extraneous, custom)
          done()
        })
      }
    })

    function check(mod, next) {
      const link = join(nm, mod)

      fs.realpath(link, function (err, real) {
        if (err && err.code === 'ENOENT') {
          // Removed in the mean time or a dead link (most likely)
          if (!missing.has(mod)) extraneous.add(mod)
          return next()
        } else if (err) {
          log.warn(err)
          return next()
        } else if (link === real) {
          // Not a symbolic link.
          // Could be a leftover materialized link
          return readJSON(join(link, 'package.json'), function (err, pkg) {
            if (pkg && LinkState.isMaterializedPackage(pkg)) {
              log.verbose('Found leftover materialized link: %s', link)
              extraneous.add(mod)
            }

            next()
          })
        } else if (!pathIsInside(real, self.cwd)) {
          // A npm link or something else
          missing.delete(mod)
          custom.set(mod, real)
          return next()
        }

        if (!missing.has(mod)) {
          extraneous.add(mod)
        } else if (self.names[relative(self.cwd, real)] === mod) {
          // All good
          missing.delete(mod)
          ok.add(mod)
        }

        next()
      })
    }
  }
}
