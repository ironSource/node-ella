'use strict';

const fs = require('fs')
    , join = require('path').join
    , writeFileAtomic = require('write-file-atomic')
    , rimraf = require('rimraf')
    , cuid = require('cuid')
    , log = require('./log')

const HIDDEN_PROP = '_multipack_id'

exports.replaceOriginal = function (abs, pkg, done) {
  const real = join(abs, 'package.json')
      , id = pkg[HIDDEN_PROP] = cuid()
      , backup = backupName(abs, id)

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
    if (!err) return done(null, rollback)

    rimraf(backup, { glob: false }, function (removeErr) {
      if (removeErr) log.warn('Failed to remove backup: %s', removeErr)
      done(err)
    })
  }

  function rollback (done) {
    exports.restoreOriginal(abs, done)
  }
}

exports.restoreOriginal = function (abs, done) {
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

    if (!(HIDDEN_PROP in pkg)) {
      return done()
    }

    const id = pkg[HIDDEN_PROP]

    if (typeof id !== 'string') {
      return done(new TypeError('Expected a string id'))
    }

    const backup = backupName(abs, id)

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
