# bundle

## `multipack bundle [name...]`

Options:

- `-b --build`: Run `npm build` before bundling
- `-o --out [path]`: Write to a file (path defaults to `<name>-<version>.<ext>`)
- `-g --gzip`: Create a gzipped tarball (tgz)
- `-d --dir <path>`: Write to a directory instead of a tarball
- `-f --force`: Overwrite destination (only for `--dir`)
- `-p --production`: Exclude `devDependencies`
- `-c --compatible`: Create an npm-installable bundle.

Create a tarball from a package, same as [pack](./pack.md), but include local dependencies too. The result is a clean, self-contained subset of your monorepo. If we bundle `dream-server`, and this depends on `super-config`, then `super-config` is packed itself and included in the `dream-server` bundle:

    bundled_modules/
	    super-config/
    index.js
		package.json

Because of this structure, we can unpack the tarball somewhere (or pipe it to things like Docker) and simply run `multipack i`. That the packages are at a different location, does not matter to multipack.

You can bundle multiple packages at once:

```bash
$ multipack bundle module-one module-two -og
m Bundle module-one-1.1.0.tgz
m Bundle module-two-2.0.3.tgz
```

Or bundle the root package:

```bash
$ multipack bundle -og
m Bundle my-project-1.1.0.tgz
```

### npm compatibility mode

With `--compatible`, local dependencies are transformed to [local paths](https://docs.npmjs.com/files/package.json#local-paths), so that after unpacking, we can run `npm install` and npm will know where to find these dependencies.

```json
{
	"name": "dream-server",
	"dependencies": {
		"super-config": "file:./bundled_modules/super-config"
	}
}
```

Multipack cannot install this type of bundle, as it can't handle local paths yet.
