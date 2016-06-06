'use strict';

class SoftError extends Error {
  constructor(msg) {
    super(msg)
    SoftError.make(this)
  }
}

SoftError.is = function (err) {
  return err && ((err instanceof SoftError) || err.softError)
}

SoftError.make = function (err) {
  if (SoftError.is(err)) return err

  Object.defineProperty(err, 'softError', {
    enumerable: false,
    value: true
  })

  return err
}

module.exports = SoftError
