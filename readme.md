# multipack (alpha)

**Monorepo package manager.** multipack wraps [npm](https://npmjs.org) to work with dependencies and scripts declared in multiple `package.json` files. This is useful for *monorepos*: large projects composed of multiple related yet independent packages (definitions vary).

[![npm status](http://img.shields.io/npm/v/multipack.svg?style=flat-square)](https://www.npmjs.org/package/multipack) [![node](https://img.shields.io/node/v/multipack.svg?style=flat-square)](https://www.npmjs.org/package/multipack)

**Highlights**

- Scans for nested packages in the working directory, so you're free to deviate from the convention to place packages in `packages/`. But a root `package.json` is required.
- Installs npm dependencies, either to the root `node_modules` or to a package's `node_modules` if there's a version conflict
- Installs monorepo packages (one package depending on another) as symbolic links, if the specified range matches the on-disk version. Otherwise, the package is installed from npm.

**Table of contents**

<!-- TOC depthFrom:2 depthTo:6 withLinks:1 updateOnSave:1 orderedList:0 -->

- [what does such a monorepo look like?](#what-does-such-a-monorepo-look-like)
- [further reading](#further-reading)
- [install](#install)
- [command line](#command-line)
	- [global options](#global-options)
	- [`multipack install`](#multipack-install)
	- [`multipack install [<name> ..] [--save*] [--to <pkg>]`](#multipack-install-name-save-to-pkg)
		- [partial install (w.i.p.)](#partial-install-wip)
		- [internal dependencies](#internal-dependencies)
		- [registry override](#registry-override)
		- [hashing (experimental)](#hashing-experimental)
	- [`multipack version [<version> | <type>]`](#multipack-version-version-type)
	- [`multipack link [<name> ..]`](#multipack-link-name-)
- [license](#license)

<!-- /TOC -->

## what does such a monorepo look like?

Suppose we have the following directory structure, with `dream-server` depending on `http-auth`, `super-config` on `yamljs` and the root on `gulp`.

    packages/
      dream-server/
        package.json
      super-config/
        package.json
    package.json

The `multipack install` command finds nested packages, collects the dependencies listed in each `package.json` and installs them at the root:

    packages/
    node_modules/
      http-auth/
      yamljs/
      gulp/

If two packages depend on different versions, multipack installs the latest version at the root and the other in a package's `node_modules`.

    packages/
      dream-server/
        node_modules/
          yamljs/
    node_modules/
      yamljs/

**Internal dependencies**

If `dream-server` explicitly depends on `super-config`:

```json
{
  "name": "dream-server",
  "version": "1.1.0",
  "dependencies": {
    "super-config": "~1.0.0"
  }
}
```

And the version of `super-config` matches `~1.0.0`, then multipack creates a symbolic link at `packages/dream-server/node_modules/super-config` to `packages/super-config`. Now you can `require('super-config')` from JavaScript code in `dream-server`.

**Registry override**

If however, the on-disk `super-config` has the version `2.0.0`, which doesn't match the `~1.0.0` that `dream-server` wants, then multipack assumes `super-config` has been published to npm, and attempts to `npm install` it to `dream-server/node_modules`.

## further reading

- [Limitations and tips](docs/limitations.md)
- [Roadmap](docs/roadmap.md)

## install

Install multipack globally with [npm](https://npmjs.org):

```bash
$ npm install -g multipack
```

multipack uses this same `npm` binary. We recommend npm 3, for better deduping. To check your version of npm or install another, run:

```bash
$ npm -v
2.15.6
$ npm install npm@3 -g
```

## command line

### global options

The following flags are available for most commands:

- `--production` or `--prod`: ignore `devDependencies`
- `--verbose`: verbose output (unrelated to npm's own log level);
- `--ignore-scripts`: do not run lifecycle scripts.

### `multipack install`

Install all dependencies and create symbolic links. Aliased as `i`.

### `multipack install [<name> ..] [--save*] [--to <pkg>]`

Options:

- `-S --save`
- `-D --save-dev`
- `-O --save-optional`
- `-E --save-exact`

Install external or internal dependencies and optionally save them to target package(s). Targets are identified by their package name. If a target is specified, `--save` is implied. Repeat `--to` to target multiple packages.

The following command installs `debug` and adds it to the `dependencies` of `packages/mono-db/package.json` and `packages/mono-server/package.json`:

```bash
$ multipack i debug --to mono-db --to mono-server
```

This command just installs `debug`:

```bash
$ multipack i debug
```

Or save it to the root package - exactly like `npm i debug --save`:

```bash
$ multipack i debug --save
```

Almost every `name` format from npm is supported:

- `name`, `name@1.1.1`, `name@^1.4.0`
- scoped names
- distribution tags: `name@latest`
- hosted: `org/repo`, `github:org/repo`, `https://github.com/org/repo` and all the other variants
- local or remote tarball
- local directory (untested, likely to conflict)

The only exception: multipack doesn't handle raw git URLs like `git://some-server.com/`.

#### partial install (w.i.p.)

If `name` matches a monorepo package, multipack installs the dependencies of that package and any packages that it depends upon.

```bash
$ multipack i mono-db mono-server
```

#### internal dependencies

If `name` matches a monorepo package and a target is specified, then `name` is saved to the target's `package.json` (as `~[version]` by default) and installed as a relative symbolic link. For example, the following creates a link at `mono-server/node_modules/mono-db`:

```bash
$ multipack i mono-db --to mono-server
```

#### registry override

If `name@<version>` matches a monorepo package and `version` doesn't match the on-disk version, multipack assumes the package has been published to npm and attempts to install it. The package is either installed to the root or the target's `node_modules` (like a regular dependency) - replacing the symbolic link that may be there (TODO).

```bash
$ multipack i mono-db@~1.0.2
```

#### hashing (experimental)

Specify `--hash` to compute a hash per package, based on the contents of its `package.json` as well as git diff if in a git directory. The hash is saved to a hidden file in `node_modules`. Subsequent times that you run `install` with `--hash`, multipack will skip installation if the hash didn't change. Note it can't detect mutation of `node_modules` by external tools (including `npm` used by itself).

```bash
$ multipack i --hash
e Installing dependencies to root
e Installing dependencies to a
e Installing dependencies to b

$ echo change > readme.md
$ multipack i --hash
e Installing dependencies to root
e No changes since last install of a
e No changes since last install of b
```

### `multipack version [<version> | <type>]`

Like `npm version`, but for all packages:

- Increments the version number from the root `package.json`, either to an exact `version` or by [release type](https://github.com/npm/node-semver) (`major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, or `prerelease`)
- Updates the version number of each package, as well as internal dependencies (the semver range is set to `~x.x.x`)
- Stages the `package.json` files to git;
- Spawns `npm version` on the root.

Without any arguments, `multipack version` prints the current root version.

### `multipack link [<name> ..]`

In the root `node_modules`, as well as in any packages depending on `name`, create a symbolic link to the globally installed or linked `name`. E.g.:

```bash
cd ~/thing
npm link
cd ~/monorepo
multipack link thing
```

The reverse, creating a global link to a monorepo package, is not supported yet.

## license

[MIT](http://opensource.org/licenses/MIT) © [ironSource](http://www.ironsrc.com/).
