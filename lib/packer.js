'use strict';

const fs = require('fs')
    , rimraf = require('rimraf')
    , path = require('path')
    , pump = require('pump')
    , series = require('run-series')
    , zlib = require('zlib')
    , vfs = require('vinyl-fs')
    , tar = require('tar-stream')
    , File = require('vinyl')
    , through2 = require('through2')
    , concat = require('concat-stream')
    , multistream = require('multistream')
    , constants = require('constants')

const SoftError = require('./soft-error')
    , readJSON = require('./read-json')
    , log = require('./log')
    , vinylnpm = require('./vinyl-npm-package')
    , vinylPrefixer = require('./vinyl-prefixer')
    , vinyltar = require('./vinyl-tar')
    , vinylStdout = require('./vinyl-stdout')

const join = path.join
    , resolve = path.resolve
    , dirname = path.dirname
    , basename = path.basename
    , relative = path.relative

const DMODE = parseInt('755', 8) | constants.S_IFDIR

// TODO: if opts.compatible, then write files to package/..
// or always write to package/, and add --strip <n> option
module.exports = class Packer {
  constructor(multipack) {
    this.packages = multipack.packages
    this.multipack = multipack
  }

  bundle(cwd, dir, subject, opts, done) {
    if (opts.dir && typeof opts.dir !== 'string') {
      return done(new SoftError('Destination directory must be a string'))
    }

    const dest = opts.dir ? resolve(opts.dir) : null
    const deps = opts.bundle
               ? this.multipack.getLocalDependencies(dir, { deep: true })
               : null

    series([
      (next) => {
        if (!dest) {
          next()
        } else if (opts.force) {
          log.verbose('Using --force, cleaning destination')
          rimraf(dest + '/**/*', next)
        } else {
          fs.readdir(dest, (err, files) => {
            if (files && files.length) {
              return next(new SoftError(
                `Destination "${dest}" is not empty. Use --force or -f.`
              ))
            }

            next()
          })
        }
      },

      (next) => {
        const base = join(cwd, dir)
        const main = this.pack(base, deps && deps.keys(), opts, true)
        const streams = [main]

        if (opts.bundle) {
          // Add directory entries
          const dirs = through2.obj()
          streams.push(dirs)

          // Add in order (not all tar readers sort headers)
          const sorted = sortDependencies(deps)

          // Set mtime to the package's mtime,
          // to at least get some deterministic behavior.
          main.once('package', (pkg) => {
            if (sorted.size) add('bundled_modules')
            for(let name of sorted.keys()) add(`bundled_modules/${name}`)
            dirs.end()

            function add(subdir) {
              dirs.write(new File({
                cwd: base,
                path: join(base, subdir),
                stat: {
                  mode: DMODE,
                  isDirectory() { return true },
                  mtime: pkg.stat.mtime
                }
              }))
            }
          })

          sorted.forEach((dir, name) => {
            streams.push(() => {
              const deps = this.multipack.getLocalDependencies(dir).keys()
              const pack = this.pack(join(cwd, dir), deps, opts)
              const prefixer = vinylPrefixer(`bundled_modules/${name}`)
              pump(pack, prefixer)
              return prefixer
            })
          })
        }

        const bundle = multistream.obj(streams)
            , verb = opts.bundle ? 'Bundle' : 'Pack'

        if (dest) {
          log.info(`${verb} %s`, relative(cwd, dest))
          pump(bundle, vfs.dest(dest), next)
        } else if (opts.out) {
          const path = this.tarballName(cwd, subject, opts)
          log.info(`${verb} %s`, relative(cwd, path))

          pump( bundle
              , vinyltar.pack(basename(path), { gzip: opts.gzip })
              , vfs.dest(dirname(path))
              , next)
        } else {
          pump( bundle
              , vinyltar.pack({ gzip: opts.gzip })
              , vinylStdout()
              , next)
        }
      },
    ], done)
  }

  // TODO: ignore or merge pre-existing bundled_modules
  pack(src, bundled, opts, isRoot) {
    log.silly('Packing %s', src)
    const vfs = vinylnpm(src)

    const trans = through2.obj((file, enc, next) => {
      if (file.relative === 'package.json') {
        // TODO: use this.packages (which is already transformed)
        file.contents.pipe(concat(buf => {
          const pkg = JSON.parse(buf.toString())
          this.transformPackage(pkg, opts, bundled, isRoot)
          file.contents = Buffer(JSON.stringify(pkg, null, 2))
          file.stat.size = file.contents.length
          trans.emit('package', file)
          next(null, file)
        }))
      } else {
        next(null, file)
      }
    })

    vfs.on('error', (err) => trans.destroy(err))
    vfs.pipe(trans)

    return trans
  }

  transformPackage(pkg, opts, bundled, isRoot) {
    if (opts.production) {
      pkg.devDependencies = undefined
    }

    if (opts.bundle) {
      if (pkg.files && !opts.compatible && isRoot) {
        pkg.files.push('bundled_modules')
      }

      if (opts.compatible && bundled) {
        const deps = pkg.dependencies || (pkg.dependencies = {})

        for(let name of bundled) {
          deps[name] = 'file:' + (isRoot ? './bundled_modules' : '..') + '/' + name
        }
      }
    }
  }

  tarballName(cwd, name, opts) {
    // Custom path
    if (opts.out && typeof opts.out === 'string') {
      return resolve(cwd, opts.out)
    }

    // Standard path
    const version = this.packages.get(name).version || '0.0.0'
    const ext  = opts.gzip ? 'tgz' : 'tar'

    return join(cwd, `${name}-${version}.${ext}`)
  }
}

function sortDependencies(deps) {
  return new Map(Array.from(deps).sort((a, b) => {
    return a[0].localeCompare(b[0])
  }))
}
