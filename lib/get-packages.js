'use strict';

const path = require('path')
    , fs = require('fs')
    , after = require('after')
    , validName = require('./valid-dir-name')

const MAX_DEPTH = 3
    , SEP = path.sep

function getPackages (root, done) {
  root = path.resolve(root)

  const res = []
  let hasRootPackage = false

  read(root, 0, function (err) {
    if (err) done(err)
    else done(null, res, hasRootPackage)
  })

  function read(parent, depth, cb) {
    fs.readdir(parent, function (err, files) {
      if (err) return cb(ignoreErrors(err))

      let pending = 0

      for(let name of files) {
        if (name === 'package.json') {
          if (parent === root) hasRootPackage = true
          res.push(parent + SEP + name)
        } else if (depth < MAX_DEPTH && validName(name)) {
          pending++
          read(parent + SEP + name, depth + 1, next)
        }
      }

      if (pending === 0) return cb()

      function next (err) {
        if (pending > 0 && (err || --pending === 0)) {
          pending = 0
          cb(err)
        }
      }
    })
  }
}

module.exports = getPackages

function ignoreErrors(err) {
  return !err || err.code === 'ENOENT' || err.code === 'ENOTDIR' ? null : err
}
