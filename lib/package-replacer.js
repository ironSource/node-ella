'use strict';

const fs = require('fs')
    , join = require('path').join
    , writeFileAtomic = require('write-file-atomic')
    , rimraf = require('rimraf')
    , cuid = require('cuid')
    , log = require('./log')

const ID_PROP = '_multipack_id'

exports.replaceOriginal = function (abs, pkg, opts, done) {
  if (typeof opts === 'function') done = opts, opts = {}
  else if (!opts) opts = {}

  assertFunction(done, 'done')

  const real = join(abs, 'package.json')
      , id = cuid()
      , backup = backupName(opts.backup || abs, id)

  if (!opts.backup) pkg[ID_PROP] = id

  try {
    var transient = JSON.stringify(pkg, null, '  ') + '\n'
  } catch (err) {
    return done(err)
  }

  fs.readFile(real, function (err, actual) {
    if (err) return done(err)

    fs.writeFile(backup, actual, function (err) {
      if (err) return finish(err)
      writeFileAtomic(real, transient, finish)
    })
  })

  function finish (err) {
    if (!err) {
      rollback.wrap = wrap
      return done(null, rollback)
    }

    rimraf(backup, { glob: false }, function (removeErr) {
      if (removeErr) log.warn('Failed to remove backup: %s', removeErr)
      done(err)
    })
  }

  function rollback (done) {
    assertFunction(done, 'done')
    exports.restoreOriginal(abs, { backup }, done)
  }

  function wrap (done) {
    assertFunction(done, 'done')

    return function workCallback (workErr) {
      exports.restoreOriginal(abs, { backup }, (restoreErr) => {
        if (workErr && restoreErr) {
          log.error('Failed to restore original package to %s: %s'
                   , abs, restoreErr)
        }

        done(workErr || restoreErr)
      })
    }
  }
}

exports.restoreOriginal = function (abs, opts, done) {
  if (typeof opts === 'function') done = opts, opts = {}
  else if (!opts) opts = {}

  const real = join(abs, 'package.json')

  fs.readFile(real, 'utf8', function (err, transient) {
    if (err) return done(err)

    try {
      var pkg = JSON.parse(transient)
    } catch (err) {
      return done(err)
    }

    if (typeof pkg !== 'object') {
      return done(new TypeError('Expected a package object'))
    }

    if (!opts.backup && !(ID_PROP in pkg)) {
      return done()
    }

    if (opts.backup) {
      var backup = opts.backup
    } else {
      const id = pkg[ID_PROP]

      if (typeof id !== 'string') {
        return done(new TypeError('Expected a string id'))
      }

      backup = backupName(abs, id)
    }

    fs.readFile(backup, function (err, actual) {
      if (err) return done(err)

      writeFileAtomic(real, actual, function (err) {
        if (err) return done(err)

        rimraf(backup, { glob: false }, function (err) {
          if (err) log.warn(err)
          done(null, true)
        })
      })
    })
  })
}

function backupName (abs, id) {
  return join(abs, `.multipack-pkg-${id}.json`)
}

function assertFunction (fn, name) {
  if (typeof fn !== 'function') {
    throw new TypeError(name +  ' must be a function')
  }
}
