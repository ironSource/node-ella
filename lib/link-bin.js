'use strict';

const mkdirp = require('mkdirp')
    , fs = require('fs')
    , path = require('path')
    , readShim = require('read-cmd-shim')
    , createShim = require('cmd-shim')
    , symlink = require('./symlink')
    , log = require('./log')

const relative = path.relative
    , dirname = path.dirname
    , resolve = path.resolve

const isWindows = process.platform === 'win32'

module.exports = function linkBinary (cwd, name, real, link, done) {
  readlink(cwd, link, real, function (err, exists) {
    if (err || exists) return done(err)

    mkdirp(dirname(link), function (err) {
      if (err) return done(err)

      log.verbose('Link %s to %s', name, relative(cwd, link))

      ;(isWindows ? createShim : relativeLink)(real, link, (err) => {
        if (err) log.warn(err)
        done()
      })
    })
  })
}

function readlink (cwd, link, real, done) {
  if (isWindows) {
    readWindowsLink(cwd, link + '.cmd', real, function (err, exists1) {
      if (err) return done(err)

      // Read cygwin link
      readWindowsLink(cwd, link, real, function (err, exists2) {
        done(err, exists1 && exists2)
      })
    })
  } else {
    readUnixLink (link, real, done)
  }
}

function relativeLink (target, link, done) {
  symlink(relative(dirname(link), target), link, done)
}

function readUnixLink (link, real, done) {
  fs.realpath(link, function (err, current) {
    if (err && err.code === 'ENOENT') {
      return done(null, false)
    } else if (err) {
      log.verbose(err)
      return done(null, false)
    } else if (link === current) {
      // Not a symbolic link.
      log.verbose('Skip link %s, taken by real file', link)
      return done(null, true)
    } else if (current === real) {
      // All good
      return done(null, true)
    } else {
      log.verbose('Remove old link %s', link)

      fs.unlink(link, (err) => {
        if (err && err.code !== 'ENOENT') log.verbose(err)
        done(null, false)
      })
    }
  })
}

function readWindowsLink (cwd, link, real, done) {
  readShim(link, function (err, dest) {
    if ((err && err.code === 'ENOENT') || (!err && !dest)) {
      // Create
      return done(null, false)
    } else if (err && err.code === 'ENOTASHIM') {
      log.verbose('Remove invalid shim %s', link)

      // Remove invalid, then create
      fs.unlink(link, function (err) {
        if (err && err.code !== 'ENOENT') log.verbose(err)
        done(null, false)
      })
    } else if (err) {
      return done(err)
    }

    const absoluteDest = resolve(dirname(link), dest)

    if (absoluteDest === real) {
      // All good
      done(null, true)
    } else {
      // Remove, them create
      log.silly('Remove old shim to %s', relative(cwd, absoluteDest))
      log.silly('       in favor of %s', relative(cwd, real))
      log.silly('                at %s', relative(cwd, link))

      fs.unlink(link, function (err) {
        if (err && err.code !== 'ENOENT') log.verbose(err)
        done(null, false)
      })
    }
  })
}
