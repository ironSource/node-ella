# limitations

- For some commands, the monorepo must have a root `package.json` with a version number. Behavior is currently undefined if you don't have it.
- Assumes the current working directory is the root, so don't run `multipack` in a subdirectory
- Package names must be unique project-wide
- multipack builds deterministic dependency trees, but it does not dedupe deep dependencies, nor does it resolve semver ranges. The range `^1.0.0` is considered to be different from `~1.0.0`, even though `npm` might resolve both to `1.0.1`. Finding an optimal tree is not our goal.
- Shrinkwrap is disabled

# tips

- On Windows, we recommend you use [Cmder](http://cmder.net/) and force npm into unicode mode by running `npm config set unicode -g`.
