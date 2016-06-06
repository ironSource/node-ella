# roadmap / design doc

**Table of contents**

<!-- TOC depthFrom:2 depthTo:6 withLinks:1 updateOnSave:1 orderedList:0 -->

- [general](#general)
- [installing and updating](#installing-and-updating)
	- [`ella install [<pkg> ..]`](#ella-install-pkg-)
	- [`ella update [<name> ..] [--save] [--to <pkg>]`](#ella-update-name-save-to-pkg)
	- [`ella remove ..`](#ella-remove-)
	- [`ella rebuild`](#ella-rebuild)
	- [`ella save [<name> ..] [--to fuzzy]`](#ella-save-name-to-fuzzy)
- [purging and pruning](#purging-and-pruning)
	- [`ella prune [<pkg> ..]`](#ella-prune-pkg-)
	- [`ella prune [<pkg> ..]`](#ella-prune-pkg-)
	- [`ella purge [<pkg> ..]`](#ella-purge-pkg-)
	- [`ella reinstall [<pkg> ..]`](#ella-reinstall-pkg-)
- [version management](#version-management)
	- [`ella version [<version> | major | minor | patch]`](#ella-version-version-major-minor-patch)
	- [`ella publish`](#ella-publish)
- [npm links](#npm-links)
	- [`ella link [--from fuzzy]`](#ella-link-from-fuzzy)
	- [`ella link <global> [--to fuzzy]`](#ella-link-global-to-fuzzy)
- [informational](#informational)
	- [`ella list|ls [--depth=n]`](#ella-listls-depthn)
	- [`ella packages [--name-only] [--path-only] [--json]`](#ella-packages-name-only-path-only-json)
- [running tests, scripts and commands](#running-tests-scripts-and-commands)
	- [`ella run [script] -- [arguments]`](#ella-run-script-arguments)
	- [`ella test|t`](#ella-testt)
	- [`ella execute|exec -- <command>`](#ella-executeexec-command)
- [navigation](#navigation)
	- [`ella [cd | pushd | popd] <fuzzy>`](#ella-cd-pushd-popd-fuzzy)
- [packing and shrinkwrapping](#packing-and-shrinkwrapping)
	- [`ella pack`](#ella-pack)
	- [`ella box|unbox`](#ella-boxunbox)
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

### `ella install [<pkg> ..]`

Only install the dependencies for target package(s) identified by name. Other monorepo packages depended upon by the target are included as well.

```bash
$ ella i mono-db mono-server
```

### `ella update [<name> ..] [--save] [--to <pkg>]`

Update dependencies. Aliased as `u`.

### `ella remove ..`

### `ella rebuild`

`npm rebuild` all packages.

### `ella save [<name> ..] [--to fuzzy]`

Only save to `package.json` files, without installing.

## purging and pruning

### `ella prune [<pkg> ..]`

Remove unlisted dependencies with `npm prune`, remove empty `node_modules` folders and dead links.

### `ella prune [<pkg> ..]`

Remove unlisted dependencies with `npm prune` and remove empty `node_modules` folders.

### `ella purge [<pkg> ..]`

Recursively remove `node_modules` folders. If no packages names are given, all `node_modules` folders are removed.

### `ella reinstall [<pkg> ..]`

Perform a clean install: `ella purge` followed by `ella install`.

## version management

### `ella version [<version> | major | minor | patch]`

Like `npm version`, but for all packages:

- Increments the version number from the root `package.json`
- Updates the version number of each package, as well as internal dependencies (the semver range is set to `~x.x.x`)
- Stages the `package.json` files to git;
- Spawns `npm version` on the root.

Without any arguments, `ella version` prints the current root version.

### `ella publish`

## npm links

### `ella link [--from fuzzy]`
### `ella link <global> [--to fuzzy]`

## informational

### `ella list|ls [--depth=n]`

~~Run `npm list` on every package (including root). Note, this will list the consolidated dependencies - as installed - not necessarily the ones listed in the `package.json` files.~~ not sure what this should do.

### `ella packages [--name-only] [--path-only] [--json]`

List package paths and/or names.

## running tests, scripts and commands

### `ella run [script] -- [arguments]`

Run a script with `npm run` in every package (including root). If no `script` argument is provided, it will list available scripts.

### `ella test|t`

Run `npm test` on every package (including root). You could also do `ella run test` but like npm, `ella test` is more forgiving towards errors. Errors will be logged but will not prevent the next package from being tested.

Also:

- `ella -s test | multi-tap` or `ella packages | multi-tap`
- `ella test [fuzzy]`

### `ella execute|exec -- <command>`

Execute an arbitrary command in every package (including root). Note the two dashes, they signify the end of arguments parsing - the rest is passed to `child_process.spawn()`.

An example, creating [browserify](https://github.com/substack/node-browserify) bundles for all packages:

`$ ella exec -- browserify index.js > bundle.js`

You could also make this a script in your root `package.json` so you can `npm run build`.

```json
"scripts": {
  "build": "ella exec -- browserify index.js > bundle.js"
}
```

Also:

- `ella exec "command" | whatever`
- `ella exec "command" [fuzzy]`

## navigation

### `ella [cd | pushd | popd] <fuzzy>`

## packing and shrinkwrapping

### `ella pack`
### `ella box|unbox`

## options and config

- control npm's verbosity, silent flag
- use user's default prefix (`save-prefix=^`)

## misc

- Can break `postinstall` scripts
- `ella init`
- `ella i --only-links`
- `ella create` or `ella nom`
- investigate possibilities of `npm --onload-script=path`
- remove all dead links before npm install
- link bins that are expected to be at package/node_modules/.bin
