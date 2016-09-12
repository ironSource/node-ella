'use strict';

const blacklist = new Set(require('builtins'))

blacklist.add('node_modules')
blacklist.add('dist')
blacklist.add('builds')
blacklist.add('prebuilds')
blacklist.delete('util')

module.exports = function isValid (name) {
  if (name.length === 0 || name.length > 214) return false
  if (name.indexOf('.') >= 0) return false
  if (name[0] === '_') return false
  if (name.trim().toLowerCase() !== name) return false
  if (blacklist.has(name)) return false

  return true
}
