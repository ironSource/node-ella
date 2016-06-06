'use strict';

const fs = require('fs')
    , semver = require('semver')
    , path = require('path')
    , each = require('async-each')
    , packageSpec = require('realize-package-specifier')
    , inspect = require('util').inspect
    , supportsColor = require('chalk').supportsColor
    , request = require('request')
    , pump = require('pump')
    , tar = require('tar-fs')
    , gunzip = require('gunzip-maybe')
    , tmp = require('tmpgen')('node-ella/*', { clean: true })

const fetchPackage = require('./fetch-package')
    , SoftError = require('./soft-error')
    , readJSON = require('./read-json')
    , log = require('./log')

const join = path.join
    , basename = path.basename

module.exports = class Resolver {
  constructor(cwd, dirs, versions) {
    this.cwd = cwd
    this.dirs = dirs
    this.versions = versions
    this.packageCache = new Map
  }

  resolveSources(sources, opts, done) {
    each(sources, (src, next) => {
      this.resolveSource(src, opts, next)
    }, done)
  }

  // Yields [name, spec, isLocalPackage], like the
  // { "name": "spec" } pair in package dependencies.
  resolveSource(source, opts, done) {
    packageSpec(source, this.cwd, (err, ps) => {
      if (err) return done(SoftError.make(err))

      if (ps.type === 'version') {
        // beep@1.1.1
        const localVersion = this.versions.get(ps.name)
            , isLocal = localVersion === ps.spec

        if (opts.saveExact) done(null, [ps.name, ps.spec, isLocal])
        else done(null, [ps.name, '~' + ps.spec, isLocal])
      } else if (ps.type === 'range') {
        // beep@~1.1.1
        this._resolveRange(ps.name, ps.spec, function (err, v, isLocal) {
          if (err) done(err)
          else if (opts.saveExact) done(null, [ps.name, v, isLocal])
          else done(null, [ps.name, ps.rawSpec, isLocal])
        })
      } else if (ps.type === 'tag') {
        // beep@latest or just beep
        this._resolveTag(ps.name, ps.spec, function (err, v, isLocal) {
          if (err) done(err)
          else if (opts.saveExact) done(null, [ps.name, v, isLocal])
          else done(null, [ps.name, '~' + v, isLocal])
        })
      } else if (ps.name && (ps.type === 'git' || ps.type === 'hosted')) {
        // beep@org/beep
        done(null, [ps.name, ps.spec])
      } else if (ps.type === 'git') {
        done(new SoftError('Raw git urls are not supported: ' + ps.spec))
      } else if (ps.type === 'hosted') {
        const url = ps.hosted.directUrl

        this._readHosted(url, function (err, pkg) {
          if (err) return done(err)
          if (!pkg.name) return done(new SoftError(`Missing package name: ${url}`))
          done(null, [pkg.name, ps.spec])
        })
      } else if (ps.type === 'directory') {
        // beep@/path/to/thing
        if (ps.name) return done(null, [ps.name, ps.rawSpec])

        // Try to read local package.json
        const path = join(ps.spec, 'package.json')

        readJSON(path, function (err, pkg) {
          if (err) return done(SoftError.make(err))
          if (!pkg.name) return done(new SoftError(`Missing package name: ${path}`))
          done(null, [pkg.name, ps.rawSpec])
        })
      } else if (ps.type === 'local' || ps.type === 'remote') {
        // beep@/path/to/thing
        if (ps.name) return done(null, [ps.name, ps.rawSpec])

        this._readTarball(ps.type, ps.spec, function (err, pkg) {
          if (err) return done(SoftError.make(err))
          if (!pkg.name) return done(new SoftError(`Missing package name: ${ps.spec}`))
          done(null, [pkg.name, ps.rawSpec])
        })
      } else {
        log.verbose(inspect(ps, { colors: supportsColor, depth: null }))
        done(new Error('Unknown type: ' + ps.type))
      }
    })
  }

  _resolveTag(name, tag, done) {
    if (tag === 'latest' && this.versions.has(name)) {
      return done(null, this.versions.get(name), true)
    }

    this._fetchPackage(name, function (err, data) {
      if (err) return done(err)

      const version = data['dist-tags'][tag]

      if (!version) {
        const lines = ['Available distribution tags for %s:']
            , args = [name]

        for(let tag in data['dist-tags']) {
          lines.push(`- ${tag}: ${data['dist-tags'][tag]}`)
        }

        args.unshift(lines.join('\n'))
        log.log('info', args)

        return done(new SoftError('No such distribution tag: ' + tag))
      }

      done(null, version)
    })
  }

  _resolveRange(name, range, done) {
    if (this.versions.has(name)) {
      const localVersion = this.versions.get(name)
      if (semver.satisfies(localVersion, range)) {
        return done(null, localVersion, true)
      }
    }

    this._fetchPackage(name, function (err, data) {
      if (err) return done(err)

      const versions = Object.keys(data.versions)
      const version = semver.maxSatisfying(versions, range)

      if (!version) {
        if (versions.length) {
          const lines = ['Available versions for %s:']
              , args = [name]

          for(let i = versions.length; i--;) {
            if (lines.length > 10) {
              lines.push('- and %s more')
              args.push(i)
              break
            }

            lines.push(`- ${versions[i]}`)
          }

          args.unshift(lines.join('\n'))
          log.log('info', args)
        }

        return done(new SoftError(`No such version: ${name} ${range}`))
      }

    	done(null, version)
    })
  }

  _readTarball(type, spec, done) {
    let dest = tmp(), pkgFile;

    pump(source(), gunzip(), tar.extract(dest, { ignore: ignore }), function (err) {
      if (err) done(err)
      else if (!pkgFile) done(new SoftError('No package found in tarball: ' + spec))
      else readJSON(pkgFile, done)
    })

    function source() {
      if (type === 'remote') return request(spec)
      else return fs.createReadStream(spec)
    }

    function ignore(path) {
      if (basename(path) === 'package.json') {
        if (!pkgFile || path.length < pkgFile.length) {
          pkgFile = path
          return false
        }
      }

      return true
    }
  }

  _readHosted(url, done) {
    request(url, { json: true }, function (err, res, body) {
      if (err) done(err)
      else if (res.statusCode === 404) return done(new SoftError('Not found: ' + url))
      else done(null, body)
    })
  }

  // TODO: use disk or npm cache?
  _fetchPackage(name, done) {
    if (this.packageCache.has(name)) {
      return process.nextTick(() => {
        done(null, this.packageCache.get(name))
      })
    }

    fetchPackage(name, (err, data) => {
      if (err) return done(SoftError.make(err))

      this.packageCache.set(name, data)
      done(null, data)
    })
  }
}
