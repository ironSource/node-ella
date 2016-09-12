'use strict';

const through2 = require('through2')
    , join = require('path').join

module.exports = function vinylPrefixer (prefix) {
  return through2.obj(function (file, enc, next) {
    file.path = join(file.base, prefix, file.relative)
    next(null, file)
  })
}
