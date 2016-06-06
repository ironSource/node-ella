'use strict';

const bail = require('bail')
    , fs = require('fs')
    , after = require('after')
    , semver = require('semver')
    , spawn = require('cross-spawn')
    , once = require('once')
    , xtend = require('xtend')
    , rimraf = require('rimraf')
    , path = require('path')
    , each = require('async-each')
    , eachSeries = require('async-each-series')
    , cmpRange = require('semver-compare-range')
    , chalk = require('chalk')
    , supportsColor = chalk.supportsColor
    , request = require('request')
    , pump = require('pump')
    , series = require('run-series')
    , dynamicSeries = require('./lib/run-series-dynamic')
    , writeFileAtomic = require('write-file-atomic')
    , split2 = require('split2')
    , pathIsInside = require('path-is-inside')
    , sortedObject = require('sorted-object')

const getPackages = require('./lib/get-packages')
    , packageName = require('./lib/package-name')
    , packageHash = require('./lib/package-hash')
    , LinkState = require('./lib/link-state')
    , LinkAnalyzer = require('./lib/link-state-analyzer')
    , Resolver = require('./lib/resolver')
    , replacer = require('./lib/package-replacer')
    , SoftError = require('./lib/soft-error')
    , readJSON = require('./lib/read-json')
    , symlink = require('./lib/symlink')
    , errback = require('./lib/errback')
    , log = require('./lib/log')

const join = path.join
    , resolve = path.resolve
    , relative = path.relative
    , dirname = path.dirname
    , basename = path.basename

const ROOT = '.'
    , FILE_PREFIX = '.ella'
    , HASH_FILE = FILE_PREFIX + '-package-hash'
    , TYPE_ORDER = ['production', 'dev', 'optional', 'peer']

function Ella(opts) {
  if (!(this instanceof Ella)) return new Ella(opts)
  if (!opts) opts = {}

  if (opts.verbose) log.setVerbose(true)

  this.cwd = resolve(opts.cwd || '.')
  this.production = !!opts.production

  this.tree = {}
  this.tree[ROOT] = {}

  this.dirs = {}
  this.names = {}
  this.dependants = new Map
  this.links = new Map
  this.versions = new Map

  this.resolver = new Resolver(this.cwd, this.dirs, this.versions)
  this.linkState = new LinkState(this.cwd, this.dirs)
  this.linkAnalyzer = new LinkAnalyzer(this.cwd, this.names, this.linkState)
}

module.exports = Ella
const E = Ella.prototype

E._analyze = function (task, done) {
  const tree = this.tree
      , cwd = this.cwd
      , packages = new Map
      , self = this

  log.verbose('Working directory: %s', cwd)

  // Collect and merge dependencies
  series([
    function readPackages(next) {
      getPackages(cwd, (err, files) => {
        if (err) next(err)
        else each(files, readPackage, next)
      })
    },

    resolveTargets,
    resolveSources,
    transformAndCollect,
    resolveSubjects,
    analyzeLinks
  ], done)

  function readPackage (file, next) {
    const parent = dirname(file)
    const dir = relative(cwd, parent) || ROOT

    // In case something went wrong the last time
    replacer.restoreOriginal(parent, function (err, restored) {
      if (err) return next(err)

      if (restored) {
        log.warn('Restored package backup: %s', join(dir, 'package.json'))
      }

      readJSON(file, function (err, pkg) {
        if (err) return next(err)

        const name = packageName(pkg, parent)

        if (!name) {
          return next(new SoftError(
            'Could not extract package name from ' + file
          ))
        }

        if (self.dirs[name]) {
          return next(new SoftError(
            `Found more than one `+
            `package with the name "${name}"`
          ))
        }

        self.dirs[name] = dir
        self.names[dir] = name
        self.versions.set(name, pkg.version)

        packages.set(name, pkg)
        next()
      })
    })
  }

  function resolveTargets (next) {
    const targets = task.targets = new Set
    const opts = task.options

    if (opts.to.length) {
      let valid = true

      opts.to.forEach(function (target) {
        const dir = self.dirs[target]

        if (dir) {
          targets.add(dir)
        } else {
          log.warn('Target %s is not a known package', target)
          valid = false
        }
      })

      if (!valid) return next(new SoftError('Aborted: please see warning(s) above'))
    } else if (opts.save || opts.saveDev || opts.saveOptional || opts.savePeer) {
      targets.add(ROOT)
    }

    next()
  }

  function resolveSources (next) {
    const input = task.options.sources || []

    self.resolver.resolveSources(input, task.options, function (err, sources) {
      if (err) return next(err)

      task.sources = sources
      // log.info('sources', sources)
      next()
    })
  }

  function transformAndCollect (next) {
    const dev = !self.production

    packages.forEach(function (pkg, name) {
      const dir = self.dirs[name]

      applyTransforms(task.transform, dir, name, pkg)

      addDependencies(pkg.dependencies, dir, 'production', name)
      if (dev) addDependencies(pkg.devDependencies, dir, 'development', name)
      addDependencies(pkg.optionalDependencies, dir, 'optional', name)
      addDependencies(pkg.peerDependencies, dir, 'peer', name)
    })

    next()
  }

  function resolveSubjects (next) {
    const subjects = task.subjects = new Set

    task.sources.forEach(function (source) {
      const name = source[0], spec = source[1], isLocal = source[2]

      if (isLocal) {
        const subject = self.dirs[name]
        subjects.add(subject)

        // Add internal dependencies
        const links = self.links.get(subject)
        if (links) links.forEach(name => subjects.add(self.dirs[name]))
      }
    })

    // log.info('subjects', subjects)
    next()

    // TODO: if its `ella i babel-core --to x`
    // then babel-core needs to be installed too
  }

  function analyzeLinks (next) {
    const step = after(packages.size + 1, next)

    for(let dir in self.names) {
      if (dir === ROOT) step()
      else self.linkAnalyzer.analyze(dir, self.links.get(dir), step)
    }

    const rootLinks = []

    for(let dir in self.names) {
      if (dir === ROOT) continue
      const name = self.names[dir]
      if (!self.tree[ROOT][name]) rootLinks.push(name)
    }

    self.linkAnalyzer.analyze('.', rootLinks, step)
  }

  function addDependencies(deps, dir, type, pkgName) {
    if (!deps) return
    for(let key in deps) {
      addDependant(key, pkgName)
      addDependency(key, deps[key], type, dir, pkgName)
    }
  }

  function addSubnode(dir, dep, version, type) {
    if (tree[dir]) tree[dir][dep] = { version, type }
    else tree[dir] = { [dep]: { version, type } }
  }

  function setRootNode(dep, version, type, origin) {
    tree[ROOT][dep] = { version, type, origin }
  }

  function addDependant(dependency, pkgName) {
    if (self.dependants.has(dependency)) {
      self.dependants.get(dependency).add(pkgName)
    } else {
      self.dependants.set(dependency, new Set([pkgName]))
    }
  }

  // TODO: rename `version` to `spec`
  function addDependency(dep, version, type, dir, pkgName) {
    const node = tree[ROOT][dep]

    if (self.versions.has(dep)) {
      const localVersion = self.versions.get(dep)

      if (semver.satisfies(localVersion, version)) {
        if (self.links.has(dir)) self.links.get(dir).add(dep)
        else self.links.set(dir, new Set([dep]))

        return
      }
    }

    if (node == null) {
      return setRootNode(dep, version, type, dir)
    }

    // Resolve conflicts
    // Note: the goal here is to get deterministic trees, not to dedupe
    if (node.origin === dir) {
      const tpl = 'Dependency %s is also listed as %s. Keeping %s'

      // Listed twice. Keep most significant
      if (cmpType(node.type, type) < 0) {
        log.warn(tpl, dep, node.type, type)
        setRootNode(dep, version, type, dir)
      } else {
        log.warn(tpl, dep, type, node.type)
      }
    } else if (node.version !== version) {
      if (node.origin === ROOT) {
        // Root package always takes precedence
      } else if (dir === ROOT) {
        // Root package overrides nested package
        addSubnode(node.origin, dep, node.version, node.type)
        return setRootNode(dep, version, type, dir)
      } else if (node.type !== type) {
        if (cmpType(node.type, type) < 0) {
          // Root node is less significant, move it to subnode
          addSubnode(node.origin, dep, node.version, node.type)
          return setRootNode(dep, version, type, dir)
        }
      } else if (cmpRange(node.version, version) < 0) {
        // TODO: how does cmpRange handle non-semver (e.g. a git url)?

        // Root node range is "smaller", move it to subnode
        addSubnode(node.origin, dep, node.version, node.type)
        return setRootNode(dep, version, type, dir)
      }

      addSubnode(dir, dep, version, type)
    } else if (node.type !== type) {
      for(let i = 0; i < TYPE_ORDER.length; i++) {
        if (node.type === TYPE_ORDER[i]) break

        if (type === TYPE_ORDER[i]) {
          node.type = type
          break
        }
      }
    }
  }
}

E.install = function (input, opts, done) {
  done = errback(done)

  const self = this

  opts.sources = input

  // TODO: make all of this functional, and refactor workToDo
  const task = {
    filter: [ workToDo ],
    options: opts
  }

  function workToDo(dir, pkgName, deps, tree, task) {
    // TODO: add all packages to subjects by default
    if (task.subjects.length && dir !== ROOT) {
      var maybe = true
      if (task.subjects.indexOf(dir) < 0) return false
    }

    const isGenericInstall = task.targets.size === 0

    if (isGenericInstall || !task.targets.has(dir)) {
      task.transform = null
    }

    if (isGenericInstall || task.targets.has(dir) || dir === ROOT) {
      if (self.linkState.missing.has(dir)) {
        task.link = true
      }

      if (self.linkState.extraneous.has(dir)) {
        task.removeExtraneous = true
      }

      // TODO: only if in source
      if (deps.size > 0) {
        task.work = (dir, next) => {
          self._installPackage(dir, opts, next)
        }

        task.destructive = true
        task.hash = !!opts.hash
      }
    }

    if (task.link || task.work || task.transform) {
      return true
    }

    // Package was explicitly included, let user know
    if (maybe || task.targets.has(dir)) {
      log.info('No work to be done in %s', pkgName)
    }

    return false
  }

  // Add new dependencies to the in-memory package,
  // and if npm install succeeds, to the real package
  if (opts.saveDev) var group = 'devDependencies'
  else if (opts.saveOptional) group = 'optionalDependencies'
  else if (opts.savePeer) group = 'peerDependencies'
  else group = 'dependencies'

  // Transform the package.json after it's been read from disk,
  // and before it's written to disk (if install was succesfull)
  task.transform = function (dir, name, pkg) {
    if (!task.targets.has(dir)) return false

    let modified = false

    for (let i = 0; i < task.sources.length; i++) {
      const dep = task.sources[i][0], spec = task.sources[i][1]

      if (!pkg[group] || pkg[group][dep] !== spec) {
        modified = true
        if (pkg[group]) pkg[group][dep] = spec
        else pkg[group] = { [dep]: spec }
      }
    }

    return modified
  }

  this._eachPackage(task, done)
}

E.update = function (names, opts, done) {
  const task = {
    destructive: true,
    link: true,
    filter: [ withDependencies
            , dependencyFilter(names, this.dependants)
            , packageFilter(opts.to) ],
    work: (dir, next) => {
      this._updatePackage(dir, names, opts, next)
    }
  }

  this._eachPackage(task, errback(done))
}

E.prune = function (opts, done) {
  const task = {
    destructive: true,
    link: true,
    work: (dir, next) => {
      this._prunePackage(dir, opts, next)
    }
  }

  this._eachPackage(task, errback(done))
}

E._installPackage = function (dir, opts, next) {
  this._logPackageAction('Installing dependencies to %s', dir)
  this._spawn(join(this.cwd, dir), ['install'], opts, next)
}

E._updatePackage = function (dir, names, opts, next) {
  this._logPackageAction('Updating dependencies of %s', dir)
  this._spawn(join(this.cwd, dir), ['update'].concat(names), opts, next)
}

E._getPackageDependencies = function (dir) {
  const deps = { size: 0 }
  const consolidated = this.tree[dir]

  if (!consolidated) return deps

  for(let name in consolidated) {
    // if (this.dirs[name]) continue
    deps.size++

    const d = consolidated[name]
    const group = deps[d.type]

    if (group) group[name] = d.version
    else deps[d.type] = { [name]: d.version }
  }

  return deps
}

E._getHashFile = function (dir) {
  const suffix = this.production ? 'prod' : 'dev'
  return join(this.cwd, dir, 'node_modules', HASH_FILE + '-' + suffix)
}

E._packageHash = function (pkg, abs) {
  return packageHash([pkg], { dir: abs, root: this.cwd })
}

E._spawn = function (cwd, args, opts, done) {
  done = once(done)

  log.reset()

  if (this.production) args.push('--production')
  if (opts.ignoreScripts) args.push('--ignore-scripts')

  // Overrule user config, because we need to:
  // 1. match log lines prefixed with "npm" (see below)
  // 2. disable shrinkwrap (would break everything);
  // 3. resolve dependencies using the same default tag.
  args.push('--heading=npm')
  args.push('--no-shrinkwrap')
  args.push('--tag=latest')

  // Force color on non-tty output
  args.push(supportsColor ? '--color=always' : '--no-color')

  const child = spawn('npm', args, {
    cwd: cwd,
    stdio: [ 'ignore', process.stdout, process.stderr ]
  })

  child.on('error', handleSpawnError(done))
  child.on('close', function (code) {
    if (code) done(new SoftError('npm exited with code ' + code))
    else done()
  })

  // This was before "materialized links"
  // // Lines can contain ANSI escape codes
  // const skipRe = /npm.+?WARN.+?skippingAction/i
  // const globRe = /npm.+?WARN.+?prefer global/i
  //
  // let emptyLine = false;
  // child.stderr.pipe(split2()).on('data', function(line) {
  //   // Strip first and last empty lines
  //   if (!chalk.stripColor(line).trim()) return emptyLine = true
  //
  //   if (!skipRe.test(line) && !globRe.test(line)) {
  //     if (emptyLine) {
  //       process.stderr.write('\n')
  //       emptyLine = false
  //     }
  //
  //     process.stderr.write(line + '\n')
  //   }
  // })
}

E._eachPackage = function (task, done) {
  if (typeof task === 'function') throw new Error('Legacy usage')

  task.filter = getFunctions(task.filter)
  task.transform = getFunctions(task.transform)

  const self = this

  let actualWork = 0

  this._analyze(task, err => {
    if (err) return done(err)

    eachSeries(Object.keys(self.names), processPackage, function finish (err) {
      if (err) return done(err, actualWork)
      if (!actualWork) log.verbose('No work to be done.')
      done(null, actualWork)
    })
  })

  function processPackage (dir, nextPackage) {
    const deps = self._getPackageDependencies(dir)
        , name = self.names[dir]
        , abs = join(self.cwd, dir)
        , pkgFile = join(abs, 'package.json')
        , state = {}

    // Task options may be mutated per package
    const pt = xtend(task)

    dynamicSeries(
      function filter (next, end) {
        for(let i = 0; i < pt.filter.length; i++) {
          if (!pt.filter[i](dir, name, deps, self.tree[dir], pt)) {
            return end()
          }
        }

        next()
      },

      function read (next, end) {
        if (!pt.hash && !pt.destructive) return next()

        readJSON(pkgFile, function (err, pkg) {
          if (err) {
            if (err.code !== 'ENOENT') info.warn('Could not read %s: %s', pkgFile, err)
            return end()
          }

          // Build temporary package
          pkg.dependencies = sortedObject(deps.production || {})
          pkg.devDependencies = sortedObject(deps.development || {})
          pkg.optionalDependencies = sortedObject(deps.optional || {})
          pkg.peerDependencies = undefined //deps.peer
          pkg.private = true

          state.pkg = pkg
          next()
        })
      },

      function removeExtraneous (next) {
        if (!pt.removeExtraneous) next()
        else self.linkState.removeExtraneous(dir, next)
      },

      function checkHash(next, end) {
        if (!pt.hash) return next()

        state.hash = self._packageHash(state.pkg, abs)

        fs.readFile(self._getHashFile(dir), 'utf8', (err, data) => {
          if (data && data.trim() === state.hash) {
            self._logPackageAction('No changes since last install of %s', dir)
            return end()
          }

          next()
        })
      },

      function subprocess (next) {
        if (!pt.work) return next()

        // Defy mutation
        const destructive = pt.destructive
        const rollbacks = []

        // Just for dev
        function guard (fn) {
          return function guarded (next) {
            next = once(next)
            try { fn(next) } catch (err) { next(err) }
          }
        }

        dynamicSeries(
          destructive && guard(function replace (next) {
            replacer.replaceOriginal(abs, state.pkg, (err, rollback) => {
              if (rollback) rollbacks.push(rollback)
              next(err)
            })
          }),

          destructive && guard(function materializeLinks (next) {
            self.linkState.materialize(dir, (err, rollback) => {
              if (rollback) rollbacks.push(rollback)
              next(err)
            })
          }),

          function doWork (next) {
            actualWork++
            next = once(next)

            try {
              pt.work(dir, next)
            } catch (err) {
              next(err)
            }
          },

          // Perform rollback regardless of work or prep error
          function doRollback (firstError) {
            if (!destructive) return next(firstError)

            ;(function nextRollback(i) {
              if (i >= rollbacks.length) {
                return next(firstError)
              }

              guard(rollbacks[i])(function (err) {
                if (err && firstError) log.warn('Rollback failed: %s', err)
                else if (err) firstError = err

                nextRollback(i+1)
              })
            })(0)
          }
        )
      },

      function createMissingLinks (next) {
        if (!pt.link) next()
        else self.linkState.createMissing(dir, next)
      },

      function transform(next) {
        if (!pt.transform || !pt.transform.length) return next()

        readJSON(pkgFile, (err, real) => {
          if (err) return next(err)
          if (!applyTransforms(pt.transform, dir, name, real)) return next()

          const json = JSON.stringify(real, null, '  ') + '\n'
          log.verbose('Updating %s', pkgFile)

          writeFileAtomic(pkgFile, json, function (err) {
            if (err) return next(err)
            if (pt.hash) state.hash = self._packageHash(real, abs)
            next()
          })
        })
      },

      function saveHash (next) {
        if (!pt.hash || !state.hash) return next()

        writeFileAtomic(self._getHashFile(dir), state.hash, function (err) {
          if (err) log.warn('Failed to write hash: %s', err)
          next()
        })
      },

      nextPackage
    )
  }
}

E._logPackageAction = function (tpl, dir) {
  const args = Array.prototype.slice.call(arguments, 2)

  if (dir === '.') args.unshift(tpl.replace('%s', 'root'))
  else args.unshift(tpl, this.names[dir])

  log.log('info', args)
}

// Outdated. Don't use.
E._prunePackage = function (dir, opts, next) {
  const abs = join(this.cwd, dir)
      , nm = join(abs, 'node_modules')

  fs.stat(nm, (err) => {
    // Skip packages without a node_modules folder
    if (err && err.code !== 'ENOENT') log.warn(err)
    if (err) return next()

    this._logPackageAction('Pruning %s', dir)

    this._spawn(abs, ['prune'], opts, function (err) {
      if (err) return next(err)

      fs.readdir(nm, function (err, files) {
        if (err) {
          if (err.code !== 'ENOENT') log.warn(err)
          return next()
        }

        // There are at most 2 hidden ella files
        if (files.length > 2) return next()

        for(let i = 0; i < files.length; i++) {
          if (!isEllaFile(files[i])) return next()
        }

        rimraf(nm, { glob: false }, (err) => {
          const name = join(dir, 'node_modules')

          if (err) log.warn('Failed to remove empty %s', name)
          else log.info('Removed empty %s', name)

          next()
        })
      })
    })
  })
}

function isEllaFile(file) {
  return file.slice(0, FILE_PREFIX.length) === FILE_PREFIX
}

function handleSpawnError(cb) {
  return function (err) {
    if (err.code === 'ENOENT') {
      return cb(new Error('Could not spawn npm. Please make sure npm is available in PATH.'))
    }

    cb(err)
  }
}

function cmpType(a, b) {
  return TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b)
}

function getFunctions(opt) {
  return [].concat(opt).filter(Boolean)
}

function applyTransforms(funcs, dir, name, pkg) {
  if (!funcs) return false

  let transformed = false

  for(let i = 0; i < funcs.length; i++) {
    if (funcs[i](dir, name, pkg) === true) transformed = true
  }

  return transformed
}

// Common filters

function withDependencies(dir, pkgName, deps) {
  return deps.size > 0
}

function onlyRoot(dir) {
  return dir === ROOT
}

function packageFilter(names, fallback) {
  if (!names.length) return fallback

  return function filterPackages(dir, pkgName) {
    if (dir === ROOT) {
      return true
    }

    return names.indexOf(pkgName) >= 0
  }
}

function dependencyFilter(deps, dependants) {
  if (!deps.length) return

  return function filterDependencies(dir, pkgName) {
    for(let i = 0; i < deps.length; i++) {
      if (dependants.has(deps[i]) && dependants.get(deps[i]).has(pkgName)) {
        return true
      }
    }
  }
}