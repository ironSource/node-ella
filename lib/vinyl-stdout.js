'use strict';

const through2 = require('through2')
    , pump = require('pump')

module.exports = function vinylStdout(std) {
  std = std || process.stdout

  return through2.obj((file, enc, next) => {
    pump(file.contents, wrap(std), next)
  })
}

function wrap(std) {
  return through2((chunk, enc, next) => {
    std.write(chunk)
    next()
  })
}
