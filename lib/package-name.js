'use strict';

const readJSON = require('./read-json').sync
    , path = require('path')

function packageName(cwd, dir) {
  if (typeof cwd === 'string') {
    var pkg = readJSON(path.join(cwd, dir, 'package.json'), {})
  } else {
    pkg = cwd
  }

  return pkg.name || path.basename(dir)
}

module.exports = packageName
