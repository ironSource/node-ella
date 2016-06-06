'use strict';

const colors = require('chalk')
    , format = require('util').format
    , repeat = require('single-line-log')(process.stdout)
    , slice = Array.prototype.slice

let verbose = false

exports.info = function () {
  log('info', slice.call(arguments))
}

exports.warn = function () {
  log('warn', slice.call(arguments))
}

exports.error = function () {
  log('error', slice.call(arguments))
}

exports.verbose = function () {
  if (verbose) log('verbose', slice.call(arguments))
}

exports.silly = function () {
  // TODO
}

exports.newline = function () {
  console.log()
}

exports.setVerbose = function (bool) {
  verbose = !!bool
}

// TODO: remove
exports.repeat = function () {
  const args = slice.call(arguments)
  const level = args.shift()
  log(level, args, true)
}

exports.log = log

exports.reset = reset

const levels
  = { info: 'cyan'
    , warn: 'yellow'
    , error: 'red'
    , verbose: 'gray' }

let wasRepeated = false

function reset() {
  if (wasRepeated) {
    repeat.clear()
    console.log('')
    wasRepeated = false
  }
}

function log(level, args, repeated) {
  if (!repeated) reset()
  if (!args.length) return

  for(let i=0; i<args.length; i++) {
    if (args[i] instanceof Error) {
      args[i] = args[i].message ||  args[i].code || args[i].name
    } else if (i > 0 && typeof args[i] === 'string') {
      args[i] = colors.green(args[i])
    } else if (i > 0 && typeof args[i] === 'number') {
      args[i] = colors.gray(args[i])
    }
  }

  // TODO: use figures
  const pre = colors[levels[level] || 'cyan']('e')
  const text = pre + ' ' + format.apply(null, args)

  if (repeated) {
    wasRepeated = true
    repeat(text)
  } else {
    console.log(text)
  }
}

process.on('exit', function () {
  reset()
})
