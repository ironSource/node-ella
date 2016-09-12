# introduction

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

    packages/dream-server/node_modules/yamljs/
    node_modules/yamljs/

## internal dependencies

If `dream-server` depends on `super-config`:

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

## registry overrides

If however, the on-disk `super-config` has version `2.0.0`, which doesn't match the `~1.0.0` that `dream-server` wants, then multipack assumes `super-config` has been published to npm, and attempts to `npm install` it to `dream-server/node_modules`.

## laissez-faire

Multipack will find our packages and create the appropriate symbolic links (as well as remove dead ones), however we structure the monorepo:

		core/
			dream-server/
				node_modules/super-config/ -> modules/super-config/
				package.json
		modules/
			super-config/
				package.json
		package.json
