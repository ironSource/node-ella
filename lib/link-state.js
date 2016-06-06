'use strict';

const fs = require('fs')
    , after = require('after')
    , rimraf = require('rimraf')
    , path = require('path')
    , series = require('run-series')
    , dynamicSeries = require('./run-series-dynamic')
    , writeFileAtomic = require('write-file-atomic')

const symlink = require('./symlink')
    , log = require('./log')
    , packageName = require('./package-name')
    , readJSON = require('./read-json')

const join = path.join
    , relative = path.relative
    , dirname = path.dirname

const MATERIALIZED_DESCRIPTION = 'Materialized link for ella [temporary]'

class LinkState {
  constructor (cwd, dirs) {
    this.cwd = cwd
    this.dirs = dirs

    this.ok = new Map
    this.missing = new Map
    this.extraneous = new Map
    this.custom = new Map
  }

  saveAnalysis (dir, ok, missing, extraneous, custom) {
    if (ok.size) this.ok.set(dir, ok)
    else this.ok.delete(dir)

    if (missing.size) this.missing.set(dir, missing)
    else this.missing.delete(dir)

    if (extraneous.size) this.extraneous.set(dir, extraneous)
    else this.extraneous.delete(dir)

    if (custom.size) this.custom.set(dir, custom)
    else this.custom.delete(dir)
  }

  removeExtraneous (dir, done) {
    const extraneous = this.extraneous.get(dir)
        , self = this

    dynamicSeries([
      extraneous && function clean (next) {
        const step = after(extraneous.size, next)

        extraneous.forEach(name => {
          const rel = join(dir, 'node_modules', name)
          log.verbose('Removing extraneous %s', rel)

          rimraf(join(self.cwd, rel), { glob: false }, function (err) {
            if (err) log.warn('Failed to remove extraneous %s', rel)
            step()
          })
        })
      }
    ], done)
  }

  createMissing (dir, done) {
    const missing = this.missing.get(dir)
        , self = this

    dynamicSeries([
      missing && missing.size && function createNodeModules(next) {
        fs.mkdir(join(self.cwd, dir, 'node_modules'), function (err) {
          if (err && err.code === 'EEXIST') next()
          else next(err)
        })
      },

      missing && function create (next) {
        const step = after(missing.size, next)

        missing.forEach(name => {
          const rel = join(dir, 'node_modules', name)
          const link = join(self.cwd, rel)
          const target = join(self.cwd, self.dirs[name])

          rimraf(link, { glob: false }, function (err) {
            if (err) return step(err)

            log.verbose('Creating link %s', rel)
            relativeLink(target, link, step)
          })
        })
      }
    ], done)
  }

  materialize (dir, done) {
    const ok = this.ok.get(dir)
        , missing = this.missing.get(dir)
        , custom = this.custom.get(dir)
        , rollbacks = []
        , self = this

    if (!ok && !missing && !custom) return done()

    dynamicSeries([
      function createNodeModules(next) {
        fs.mkdir(join(self.cwd, dir, 'node_modules'), function (err) {
          if (err && err.code === 'EEXIST') next()
          else next(err)
        })
      },

      ok && function materializeExisting (next) {
        materializeLinks('ok', ok, false, next)
      },

      missing && function materializeMissing (next) {
        materializeLinks('missing', missing, false, next)
      },

      custom && function materializeCustom (next) {
        materializeLinks('custom', custom, true, next)
      }
    ], finish)

    function finish (err) {
      done(err, rollbacks.length ? rollback : null)
    }

    function rollback (done) {
      // TODO: attempt to rollback all, regardless of error?
      series(rollbacks.map(item => {
        return function (next) {
          if (item.state === 'missing') {
            // TODO: remove?
            log.silly('Skipping link rollback: %s', item.link)
            return next()
          }

          log.silly('Link rollback: %s', item.link)

          rimraf(item.link, { glob: false }, function (err) {
            if (err) return next(err)
            symlink(item.target, item.link, next)
          })
        }
      }), done)
    }

    function materializeLinks (state, mods, external, next) {
      const step = after(mods.size, next)

      mods.forEach((value, key) => {
        if (external) { // mods is a map
          var name = key
          var target = value
        } else { // mods is a set
          name = value
          target = join(self.cwd, self.dirs[name])
        }

        const link = join(self.cwd, dir, 'node_modules', name)

        if (external) {
          fs.readlink(link, function (err, linkValue) {
            if (err) return step(err)

            rimraf(link, { glob: false }, function (err) {
              if (err) return step(err)
              materializeLink(state, link, target, linkValue, step)
            })
          })
        } else {
          rimraf(link, { glob: false }, function (err) {
            if (err) return step(err)

            // Make a relative link for internal packages
            const linkValue = relative(dirname(link), target)
            materializeLink(state, link, target, linkValue, step)
          })
        }
      })
    }

    function materializeLink (state, link, target, linkValue, next) {
      // Remember the value of the link, not the canonical path
      rollbacks.push({ state, link, target: linkValue })
      log.silly('Realizing link %s', link)

      readJSON(join(target, 'package.json'), function (err, pkg) {
        if (err) return next(err)

        if (typeof pkg !== 'object') pkg = {}

        const materialized = {
          name: packageName(pkg, target),
          description: MATERIALIZED_DESCRIPTION,
          version: pkg.version || '0.0.1'
        }

        const json = JSON.stringify(materialized, null, '  ')

        fs.mkdir(link, function (err) {
          if (err) return next(err)
          writeFileAtomic(join(link, 'package.json'), json, next)
        })
      })
    }
  }
}

module.exports = LinkState

LinkState.isMaterializedPackage = function (pkg) {
  return pkg.description === MATERIALIZED_DESCRIPTION
}

function relativeLink(target, link, done) {
  symlink(relative(dirname(link), target), link, done)
}
