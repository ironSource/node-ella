'use strict';

const fs = require('fs')
const PERMISSION_ERR = `You don't have access to this file.`

// TODO: remove sync usage
function readJSONSync(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'))
  } catch (err) {
    return fallback
  }
}

function readJSON(path, cb) {
  fs.readFile(path, 'utf8', function (err, json) {
    if (err) return cb(humanError(err))

    try {
      var value = JSON.parse(json)
    } catch (err) {
      return cb(err)
    }

    cb(null, value)
  })
}

function humanError(err) {
  // Improve the message of permission errors
  if (err.code === 'EACCES') {
    err.message = `${err.message}\n${PERMISSION_ERR}\n`
  }

  return err
}

module.exports = readJSON
module.exports.sync = readJSONSync
