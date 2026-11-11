# apps/browser/src/autofill

@./principles.md

## Working in this directory

The principles above apply as written. Injected code is any module reachable from a content script or
injected page entry point (every entry in `apps/browser/webpack.base.js` whose source is under this
directory, including entries added conditionally).

- Stop and flag to the user, rather than implement, any change that would:
  - send new or additional user data to an injected experience
  - bring a third-party package into injected code, even one the repo already depends on
  - move further from a principle; state the trade-off when you flag it
- Flag any weak surface you find to the user. Do not describe it in code comments or documentation.
