# link

## `multipack link [<name> ..]`

In the root `node_modules`, as well as in any packages depending on `name`, create a symbolic link to the globally installed or linked `name`. E.g.:

```bash
cd ~/thing
npm link
cd ~/monorepo
multipack link thing
```

The reverse, creating a global link to a monorepo package, is not supported yet.
