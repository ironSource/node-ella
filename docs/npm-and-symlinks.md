## workaround for symbolic links

Ella can also be used on normal (non-monorepo) projects, when you're frustated with npm's handling of symbolic links: ella says symbolic links are sovereign packages - don't touch their targets - and hides them from npm.

npm has various issues with symbolic links.

1. npm steals dependencies from linked packages (it attempts to move `/linked/node_modules/shared` to `/node_modules/shared`, which either fails or breaks the linked package): [npm#10343](https://github.com/npm/npm/issues/10343)
2. [npm#10800](https://github.com/npm/npm/issues/10800)
3. If package `A` depends on `external-dep` which depends on the published version of package `B`, npm will install the published `B` to the flattened tree in `/node_modules`. This is expected behavior, but we want it to be a link to the local package.

We can fix this last one by creating symlinks for monorepo packages before `npm install`, so that npm sees the links and skips registry install. At least, that's what I hoped it'd do.

However:

- For deep internal links (`A/B/C`), npm attempts to dedupe `C` (even though it's a link) and consults the registry on `C` (unwanted), gets an expected 404, and for some reason reports it as a failed *optional dependency*.
- The stealing of dependencies is still a problem
- There's a noticeable performance degrade when npm traverses symlinks. It's faster to unlink all, do npm install, then relink all.

So, long story short: keep npm away from symlinks.

Before the `npm install` of a package, we temporarily replace every link in its `node_modules` (including those to external targets) with an almost empty `package.json`, whose version matches the link target's version. We make npm think the package already exists, and that it does not have dependencies that need to be installed / deduped.
