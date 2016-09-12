'use strict';

module.exports = function handleSpawnError(cb, cmd) {
  cmd = cmd || 'npm'

  return function (err) {
    if (err.code === 'ENOENT') {
      return cb(new Error(
        `Could not spawn ${cmd}. Please make sure ${cmd} is available in PATH.`
      ))
    }

    cb(err)
  }
}
