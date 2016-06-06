'use strict';

const fs = require('fs')
    , path = require('path')
    , os = require('os')
    , symlinkType = getType()

module.exports = function symlink(target, link, cb) {
  // Junction points must be absolute
  if (symlinkType === 'junction') {
    target = path.resolve(link, '..', target)
  }

  fs.symlink(target, link, symlinkType, cb)
}

// TODO: we inherited this from rnpm, but IIRC this has been fixed in node
function getType() {
  // Use junctions on Windows < Vista (6.0),
  // Vista and later support regular symlinks.
  if (os.platform() === 'win32' && parseInt(os.release()) < 6) {
    return 'junction'
  } else {
    return 'dir'
  }
}
