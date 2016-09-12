# install

## `multipack install`

Install all dependencies and create symbolic links. Aliased as `i`.

## `multipack install [<name> ..] [--save*] [--to <pkg>]`

Options:

- `-S --save`
- `-D --save-dev`
- `-O --save-optional`
- `-E --save-exact`

Install external or local dependencies and optionally save them to target package(s). Targets are identified by their package name. If a target is specified, `--save` is implied. Repeat `--to` to target multiple packages.

The following command installs `debug` and saves it to the `dependencies` of `packages/mono-db/package.json` and `packages/mono-server/package.json`:

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
- local path (untested, likely to conflict)

The only exception: multipack doesn't handle raw git URLs like `git://some-server.com/`.

### partial install (w.i.p.)

If `name` matches a monorepo package, multipack installs the dependencies of that package and any packages that it depends upon.

```bash
$ multipack i mono-db mono-server
```

### local dependencies

If `name` matches a monorepo package and a target is specified, then `name` is saved to the target's `package.json` (as `~[version]` by default) and installed as a relative symbolic link. For example, the following creates a link at `mono-server/node_modules/mono-db`:

```bash
$ multipack i mono-db --to mono-server
```

### registry override

If `name@<version>` matches a monorepo package and `version` doesn't match the on-disk version, multipack assumes the package has been published to npm and attempts to install it. The package is either installed to the root or the target's `node_modules` (like a regular dependency) - replacing the symbolic link that may be there (TODO).

```bash
$ multipack i mono-db@~1.0.2
```

### hashing (experimental)

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
