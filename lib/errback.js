'use strict';

const once = require('once')
    , SoftError = require('./soft-error')
    , log = require('./log')

module.exports = function (cb) {
  return once(function (err) {
    if (SoftError.is(err)) {
      log.error(err)
      if (cb) cb()
    } else if (err) {
      if (cb) cb(err)
      else throw err
    } else if (cb) {
      cb()
    }
  })
}
