'use strict';

const path = require('path')
    , isDir = require('is-directory')
    , fs = require('fs')

const MAX_DEPTH = 5
    , SPLIT_RE = /\/|\\/

function getPackages (root, done) {
  const q = [root]
      , res = []

  next()

  function read(parent) {
    fs.readdir(parent, function (err, files) {
      if (err) return done(err)

      files.forEach(function (name) {
        if (name[0] === '.' || name === 'node_modules') return

        const abs = path.join(parent, name)
            , depth = path.relative(root, abs).split(SPLIT_RE).length - 1

        if (depth > MAX_DEPTH) return

        if (name === 'package.json') res.push(abs)
        else if (isDir.sync(abs)) q.push(abs)
      })

      next()
    })
  }

  function next() {
    if (!q.length) done(null, res)
    else read(q.shift())
  }
}

module.exports = getPackages
