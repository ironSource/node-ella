# limitations

- Assumes the current working directory is the project root, so don't run `multipack` in a subdirectory
- A root `package.json` is required, with at least a name and version
- Shrinkwrap is disabled
- Has a depth limit of 5 directories
- Multipack builds deterministic dependency trees, but it does not dedupe deep dependencies, nor does it resolve semver ranges. The range `^1.0.0` is considered to be different from `~1.0.0`, even though `npm` might resolve both to `1.0.1`. Finding an optimal tree is not our goal.

## naming rules

- Package names must be unique project-wide
- Package names *as well as their parent directories*:
  - Must be [valid npm package names](https://www.npmjs.com/package/validate-npm-package-name#naming-rules)
  - May not contain dots or match `dist`, `builds` or `prebuilds`.

For example, the following directories are ignored:

- `http` (built-in name)
- `stream/particle-stream` (same)
- `modules/.comet` (dot)
- `modules/time.js` (same)
- `dist/warp-client` (ignored name)
- `modules/Portal` (uppercase).

# tips

- On Windows, we recommend you use [Cmder](http://cmder.net/) and force npm into unicode mode by running `npm config set unicode -g`.
