'use strict';

const path = require('path')
    , pump = require('pump')
    , zlib = require('zlib')
    , tar = require('tar-stream')
    , File = require('vinyl')
    , through2 = require('through2')

const join = path.join
const WIN_SLASH = /\\/g

exports.pack = function vinylPack (name, opts) {
  if (typeof name !== 'string') opts = name, name = null
  if (!opts) opts = {}

  const pack = tar.pack()
  const trans = through2.obj(transform, flush)

  let pushed = false

  return trans

  function transform (file, enc, next) {
    if (!pushed) push()

    if (file.isDirectory()) {
      pack.entry(header(file), next)
    } else if (file.isBuffer()) {
      pack.entry(header(file), file.contents, next)
    } else if (file.isStream()) {
      file.contents.pipe(pack.entry(header(file), next))
    } else if (typeof file.isSymbolic === 'function' && file.isSymbolic()) {
      // Only on vinyl master, untested.
      pack.entry(header(file), next)
    } else {
      next()
    }
  }

  function push() {
    pushed = true

    const cwd = opts.cwd || process.cwd()
        , ext = opts.gzip ? 'tgz' : 'tar'
        , path = join(cwd, name || `archive.${ext}`)
        , tar = new File({ cwd, path, contents: pack })

    if (opts.gzip) {
      const gzip = zlib.createGzip()
      pump(tar.contents, gzip)
      tar.contents = gzip
    }

    trans.push(tar)
  }

  function flush(cb) {
    if (!pushed) push()
    pack.finalize()
    cb()
  }

  function header (file) {
    const stat = file.stat || {}

    const header = {
      name  : file.relative.replace(WIN_SLASH, '/'),
      size  : stat.size,
      mode  : stat.mode,
      mtime : stat.mtime,
      uid   : stat.uid,
      gid   : stat.gid
    }

    if (typeof file.isSymbolic === 'function' && file.isSymbolic()) {
      header.size = 0
      header.linkname = file.symlink.replace(WIN_SLASH, '/')
    }

    return header
  }
}
