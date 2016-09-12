# roadmap / design doc

**Table of contents**

<!-- TOC depthFrom:2 depthTo:6 withLinks:1 updateOnSave:1 orderedList:0 -->

- [general](#general)
- [installing and updating](#installing-and-updating)
	- [`multipack install [<pkg> ..]`](#multipack-install-pkg-)
	- [`multipack update [<name> ..] [--save] [--to <pkg>]`](#multipack-update-name-save-to-pkg)
	- [`multipack remove ..`](#multipack-remove-)
	- [`multipack rebuild`](#multipack-rebuild)
	- [`multipack save [<name> ..] [--to fuzzy]`](#multipack-save-name-to-fuzzy)
- [purging and pruning](#purging-and-pruning)
	- [`multipack prune [<pkg> ..]`](#multipack-prune-pkg-)
	- [`multipack prune [<pkg> ..]`](#multipack-prune-pkg-)
	- [`multipack purge [<pkg> ..]`](#multipack-purge-pkg-)
	- [`multipack reinstall [<pkg> ..]`](#multipack-reinstall-pkg-)
- [version management](#version-management)
	- [`multipack version [<version> | major | minor | patch]`](#multipack-version-version-major-minor-patch)
	- [`multipack publish`](#multipack-publish)
- [npm links](#npm-links)
	- [`multipack link [--from fuzzy]`](#multipack-link-from-fuzzy)
	- [`multipack link <global> [--to fuzzy]`](#multipack-link-global-to-fuzzy)
- [informational](#informational)
	- [`multipack list|ls [--depth=n]`](#multipack-listls-depthn)
	- [`multipack packages [--name-only] [--path-only] [--json]`](#multipack-packages-name-only-path-only-json)
- [running tests, scripts and commands](#running-tests-scripts-and-commands)
	- [`multipack run [script] -- [arguments]`](#multipack-run-script-arguments)
	- [`multipack test|t`](#multipack-testt)
	- [`multipack execute|exec -- <command>`](#multipack-executeexec-command)
- [navigation](#navigation)
	- [`multipack [cd | pushd | popd] <fuzzy>`](#multipack-cd-pushd-popd-fuzzy)
- [options and config](#options-and-config)
- [misc](#misc)

<!-- /TOC -->

## general

- tests tests tests
- Sort dependencies of a `package.json` same as npm
- [From readme example] Refuse registry override if `super-config` is a private package, regardless of its version:

```json
{
  "name": "super-config",
  "version": "2.0.0",
  "private": true
}
```

## installing and updating

### `multipack install [<pkg> ..]`

Only install the dependencies for target package(s) identified by name. Other monorepo packages depended upon by the target are included as well.

```bash
$ multipack i mono-db mono-server
```

### `multipack update [<name> ..] [--save] [--to <pkg>]`

Update dependencies. Aliased as `u`.

### `multipack remove ..`

### `multipack rebuild`

`npm rebuild` all packages.

### `multipack save [<name> ..] [--to fuzzy]`

Only save to `package.json` files, without installing.

## purging and pruning

### `multipack prune [<pkg> ..]`

Remove unlisted dependencies with `npm prune`, remove empty `node_modules` folders and dead links.

### `multipack prune [<pkg> ..]`

Remove unlisted dependencies with `npm prune` and remove empty `node_modules` folders.

### `multipack purge [<pkg> ..]`

Recursively remove `node_modules` folders. If no packages names are given, all `node_modules` folders are removed.

### `multipack reinstall [<pkg> ..]`

Perform a clean install: `multipack purge` followed by `multipack install`.

### `multipack publish`

## npm links

### `multipack link [--from fuzzy]`
### `multipack link <global> [--to fuzzy]`

## informational

### `multipack list|ls [--depth=n]`

~~Run `npm list` on every package (including root). Note, this will list the consolidated dependencies - as installed - not necessarily the ones listed in the `package.json` files.~~ not sure what this should do.

### `multipack packages [--name-only] [--path-only] [--json]`

List package paths and/or names.

## running tests, scripts and commands

### `multipack run [script] -- [arguments]`

Run a script with `npm run` in every package (including root). If no `script` argument is provided, it will list available scripts.

### `multipack test|t`

Run `npm test` on every package (including root). You could also do `multipack run test` but like npm, `multipack test` is more forgiving towards errors. Errors will be logged but will not prevent the next package from being tested.

Also:

- `multipack -s test | multi-tap` or `multipack packages | multi-tap`
- `multipack test [fuzzy]`

### `multipack execute|exec -- <command>`

Execute an arbitrary command in every package (including root). Note the two dashes, they signify the end of arguments parsing - the rest is passed to `child_process.spawn()`.

An example, creating [browserify](https://github.com/substack/node-browserify) bundles for all packages:

`$ multipack exec -- browserify index.js > bundle.js`

You could also make this a script in your root `package.json` so you can `npm run build`.

```json
"scripts": {
  "build": "multipack exec -- browserify index.js > bundle.js"
}
```

Also:

- `multipack exec "command" | whatever`
- `multipack exec "command" [fuzzy]`

## navigation

### `multipack [cd | pushd | popd] <fuzzy>`

## options and config

- control npm's verbosity, silent flag
- use user's default prefix (`save-prefix=^`)

## misc

- Can break `postinstall` scripts
- `multipack init`
- `multipack i --only-links`
- `multipack create` or `multipack nom`
- investigate possibilities of `npm --onload-script=path`
- remove all dead links before npm install
- link bins that are expected to be at package/node_modules/.bin
