'use strict';

// Adapted from run-series

var once = require('once')
  , slice = Array.prototype.slice

function series () {
  // run-series drop-in
  var args = getArgs(slice.call(arguments))
  run (args[0], args[1])
}

function run (tasks, cb) {
  var current = 0
  var results = []
  var isSync = true
  var ended = 0

  function done (err) {
    if (ended++) return

    function end () {
      cb(err, results)
    }

    if (isSync) process.nextTick(end)
    else end()
  }

  function next (err, result) {
    if (ended) return

    results.push(result)
    if (++current >= tasks.length || err) done(err)
    else (tasks[current] || noop)(next, done)
  }

  if (tasks.length > 0) (tasks[0] || noop)(next, done)
  else done(null)

  isSync = false
}

// Unused
function sub () {
  var args = getArgs(slice.call(arguments))
  var tasks = args[0], cb = args[1]

  return function subseries (endSub) {
    run(tasks, function (err, results) {
      cb(err, function (endError) {
        endSub(err || endError, results)
      })
    })
  }
}

function getArgs(args) {
  if (Array.isArray(args[0])) {
    var tasks = args[0]
    var cb = args[1]
  } else {
    tasks = args
    cb = tasks.pop()
  }

  if (typeof cb !== 'function') {
    throw new TypeError('Last argument must be a function')
  }

  return [tasks, cb]
}

function noop (next) {
  next()
}

module.exports = series
series.sub = sub
