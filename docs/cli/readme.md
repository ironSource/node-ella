# command line

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

## global options

The following flags are available for most commands:

- `--production -p`: ignore `devDependencies`
- `--verbose`: verbose output (unrelated to npm's own log level);
- `--ignore-scripts`: do not run lifecycle scripts.

## commands

- [install](./install.md)
- [version](./version.md)
- [link](./link.md)
- [pack](./pack.md)
- [bundle](./bundle.md)
