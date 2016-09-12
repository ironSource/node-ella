# multipack (alpha)

**Monorepo package manager.** Multipack wraps [npm](https://npmjs.org) to work with dependencies declared in multiple `package.json` files. This is useful for *monorepos*: large projects composed of multiple related yet independent packages (definitions vary).

[![npm status](http://img.shields.io/npm/v/multipack.svg?style=flat-square)](https://www.npmjs.org/package/multipack) [![node](https://img.shields.io/node/v/multipack.svg?style=flat-square)](https://www.npmjs.org/package/multipack)

## highlights

- Scans for nested packages in the working directory, so you're free to deviate from the convention to place packages in `packages/`.
- Installs npm dependencies, either to the root `node_modules` or to a package's `node_modules` if there's a version conflict
- Currently delegates installation to `npm` with a workaround that has an unfortunate side-effect: `multipack i express` behaves like `npm i express && npm update`. We're considering a move to `ied` or `pnpm`.
- Installs local dependencies (one monorepo package depending on another) as symbolic links, if the declared range matches the on-disk version. Otherwise, the package is installed from npm.
- Has the ability to `bundle` a package with its dependencies for isolated usage

## documentation

- [Introduction](docs/introduction.md)
- [Command line](docs/cli)
- [Limitations and tips](docs/limitations.md)
- [Roadmap](docs/roadmap.md)

## license

[MIT](http://opensource.org/licenses/MIT) © [ironSource](http://www.ironsrc.com/).
