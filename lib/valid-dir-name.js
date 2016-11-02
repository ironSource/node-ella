'use strict';

const blacklist = new Set(require('builtins'))

blacklist.add('node_modules')
blacklist.add('dist')
blacklist.add('builds')
blacklist.add('prebuilds')
blacklist.add('fixture')
blacklist.add('fixtures')
blacklist.add('test')
blacklist.add('tests')
blacklist.add('spec')

module.exports = function isValid (name) {
  if (blacklist.has(name)) return false
  if (name.length === 0 || name.length > 214) return false
  if (name[0] === '.') return false
  if (name[0] === '_') return false
  if (name.trim().toLowerCase() !== name) return false

  return true
}
