# pack

## `multipack pack [name...]`

Options:

- `-b --build`: Run `npm build` before bundling
- `-o --out [path]`: Write to a file (path defaults to `<name>-<version>.<ext>`)
- `-g --gzip`: Create a gzipped tarball (tgz)
- `-d --dir <path>`: Write to a directory instead of a tarball
- `-f --force`: Overwrite destination (only for `--dir`)
- `-p --production`: Remove `devDependencies` from `package.json`

Create a tarball from a package. Files get included or excluded by [npm's rules](https://docs.npmjs.com/files/package.json#files), same as `npm pack`. Writes to standard out by default. To get the same behavior as npm (which writes to a fixed filename), run `multipack pack -o`.

Current limitation: does not prefix paths in the tarball with `package/` as npm expects.

You can pack multiple packages at once:

```bash
$ multipack pack module-one module-two -og
m Pack module-one-1.1.0.tgz
m Pack module-two-2.0.3.tgz
```

Or pack the root package:

```bash
$ multipack pack -og
m Pack my-project-1.1.0.tgz
```
