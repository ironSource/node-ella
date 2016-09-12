'use strict';

const File = require('vinyl')
    , through2 = require('through2')
    , path = require('path')
    , fs = require('fs')
    , after = require('after')
    , inherits = require('util').inherits
    , Readable = require('stream').Readable

exports.src = function fstreamVinyl (fstream) {
  const cache = new Map
      , visited = new Set
      , vfs = through2.obj(transform).on('pipe', pipe)

  if (fstream) {
    fstream.once('error', (err) => vfs.destroy(err))
    fstream.pipe(vfs)
  }

  return vfs

  // fstream has its own non-standard stream semantics.
  // normalize it best we can.
  function pipe (src) {
    // fstream-npm does not emit `entry` for directories,
    // but it does emit `entryStat`. Note: on fstream-npm,
    // this event also fires for ignored entries, so don't
    // take it as a source of truth.
    src.on('entryStat', remember)
    src.on('entry', write)
    src.on('end', cleanup)
    src.on('abort', abort)
    vfs.on('unpipe', unpipe)
    vfs.on('close', close)

    // Note: files have to be consumed for DirReader to resume

    function unpipe (rs) {
      if (rs === src) cleanup()
    }

    function cleanup () {
      src.removeListener('entryStat', remember)
      src.removeListener('entry', write)
      src.removeListener('end', cleanup)
      src.removeListener('abort', abort)
      vfs.removeListener('unpipe', unpipe)
      vfs.removeListener('close', close)
    }

    function abort () {
      cleanup()
      vfs.end()
    }

    function close () {
      cleanup()
      if (!src._aborted) src.abort()
    }

    function write (entry) {
      if (vfs.write(entry) === false) src.pause()
    }
  }

  function remember (entry) {
    if (entry.type === 'Directory') cache.set(entry._path, entry)
  }

  // Note: on fstream-npm, entry._path is the original
  // path, and entry.path is the (prefixed) tarball path.
  function transform (entry, enc, next) {
    let parent = path.dirname(entry._path)

    const missing = []

    // Emit explicit directory entries for all ancestors
    while(parent !== entry.root._path && !visited.has(parent)) {
      missing.push(parent)
      parent = path.dirname(parent)
    }

    missing.reverse()

    const step = after(missing.length, (err) => {
      if (err) return next(err)
      push(entry)
      next()
    })

    missing.forEach(parent => {
      if (cache.has(parent)) {
        push(cache.get(parent))
        return step()
      }

      // In case no `entryStat` was emitted, fallback to our own stat call
      fs.stat(parent, (err, stats) => {
        if (err) return step(err)

        push({ type: 'Directory', root: entry.root, _path: parent, props: stats })
        step()
      })
    })
  }

  function push (entry) {
    if (entry.type === 'Directory') {
      visited.add(entry._path)
    }

    if (entry.type !== 'Directory' && entry.type !== 'File') {
      return vfs.destroy(new Error('Unsupported type: ' + entry.type))
    }

    const path     = entry._path
        , contents = entry.type === 'Directory' ? null
                   // Not idea why, but this fixes piping into vfs.dest()
                   : new Readable().wrap(entry)
        , cwd      = entry.root._path
        , stat     = entry.props instanceof fs.Stats ? entry.props
                   : new CleanStats(entry.props)

    vfs.push(new File({ cwd, path, contents, stat }))
  }
}

// Mimic `fs.Stats`. Ignore all of fstream's cruft.
function CleanStats(props) {
  this.dev = props.dev
  this.ino = props.ino
  this.mode = props.mode
  this.nlink = props.nlink
  this.uid = props.uid
  this.gid = props.gid
  this.rdev = props.rdev
  this.size = props.size
  this.blksize = props.blksize
  this.blocks = props.blocks
  this.atime = props.atime
  this.mtime = props.mtime
  this.ctime = props.ctime
  this.birthtime = props.birthtime
}

inherits(CleanStats, fs.Stats)
