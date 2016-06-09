'use strict';

// Adapted from novemberborn/package-hash
// In flux, just an experiment

const stringify = require('json-stable-stringify')
    , cp = require('child_process')
    , fs = require('fs')
    , path = require('path')
    , crypto = require('crypto')

const dirname = path.dirname
    , join = path.join
    , createHash = crypto.createHash
    , cache = new Map

const TEN_MB = 1024 * 1024 * 10

function tryReadFileSync (file) {
  try {
    return fs.readFileSync(file)
  } catch (err) {
    return null
  }
}

function tryGetRef (gitdir, head) {
  const m = /^ref: (.+)$/.exec(head)
  if (!m) return null

  return tryReadFileSync(join(gitdir, m[1]))
}

function tryGetDiff (dir) {
  try {
    // Attempt to get consistent output no matter the platform. Diff both
    // staged and unstaged changes.
    return cp.execFileSync('git', ['--no-pager', 'diff', 'HEAD', '--no-color', '--no-ext-diff', '.'], {
      cwd: dir,
      maxBuffer: TEN_MB,
      stdio: ['ignore', 'pipe', 'ignore']
    })
  } catch (err) {
    return null
  }
}

function headHash(root) {
  const gitdir = join(root, '.git')
  const head = tryReadFileSync(join(gitdir, 'HEAD'))

  if (!head) return null

  const hash = createHash('md5')
  hash.update(head)

  const packed = tryReadFileSync(join(gitdir, 'packed-refs'))
  if (packed) hash.update(packed)

  const ref = tryGetRef(gitdir, head)
  if (ref) hash.update(ref)

  return hash.digest()
}

function computeHash (hash, input, opts) {
  for (let i = 0; i < input.length; i++) {
    const salt = input[i]

    if (typeof salt === 'string') {
      hash.update(salt, 'utf8')
    } else if (Buffer.isBuffer(salt)) {
      hash.update(salt)
    } else if (typeof salt === 'object' && salt != null) {
      hash.update(stringify(salt), 'utf8')
    } else if (salt != null) {
      throw new TypeError('Salt must be an Array, Buffer, Object or string')
    }
  }

  if (opts.dir) {
    const diff = tryGetDiff(opts.dir)
    if (diff) hash.update(diff)
  }

  if (opts.root || opts.dir) {
    const root = opts.root || opts.dir

    if (cache.has(root)) {
      const buf = cache.get(root)
      if (buf) hash.update(buf)
    } else {
      const buf = headHash(root)
      cache.set(root, buf)
      if (buf) hash.update(buf)
    }
  }

  return hash
}

let ownHash = null
module.exports = function sync (input, opts) {
  if (!ownHash) {
    // Memoize the hash for multipack itself.
    const dir = __dirname + '/..'
        , pkg = fs.readFileSync(dir + '/package.json')

    ownHash = computeHash(createHash('md5'), [pkg], { dir }).digest()
  }

  const hash = createHash('md5')
  hash.update(ownHash)

  if (Array.isArray(input)) {
    return computeHash(hash, input, opts || {}).digest('hex')
  } else {
    return computeHash(hash, [input], opts || {}).digest('hex')
  }
}
