# version

## `multipack version [<version> | <type>]`

Like `npm version`, but for all packages:

- Increments the version number from the root `package.json`, either to an exact `version` or by [release type](https://github.com/npm/node-semver) (`major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, or `prerelease`)
- Updates the version number of each package, as well as local dependencies (the semver range is set to `~x.x.x`)
- Stages the `package.json` files to git;
- Spawns `npm version` on the root.

Without any arguments, `multipack version` prints the current root version.
