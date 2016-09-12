'use strict';

const fstream = require('fstream-npm')
    , vinyl = require('./vinyl-fstream')
    , resolve = require('path').resolve

// Also includes directories, to fix the problem mentioned in npm/fstream-npm#6
module.exports = function vinylNpmPackage(dir) {
  const path = resolve(dir || '.')
  return vinyl.src(fstream({ path }))
}
