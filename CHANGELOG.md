# changelog

## unreleased

- Feature: link `package.bin`:
  - From module to root
  - From module to dependent module
  - From a module's dependency to module
- Change `--prod` alias to `-p`
- Feature: `pack <name>` - create a tarball from a package
- Feature: `bundle <name>` - like `pack`, but include internal dependencies
- Log to standard error, so that commands like `pack` can write to standard out
