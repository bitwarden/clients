---
paths:
  - "apps/browser/src/autofill/content/**"
---

# Autofill Content Scripts - Critical Rules

## Angular Exception

Code in this directory runs as **injected content scripts**, not within the Angular application context.

- **DO NOT** use Angular patterns (components, services, dependency injection, RxJS Observable Data Services, Signals, `takeUntilDestroyed()`, `async` pipe, etc.)
- **DO NOT** import Angular modules or dependencies
- The Angular Architecture Patterns defined in the repo-root CLAUDE.md do not apply here

## Lit Components

- Components in `content/components/` use [Lit](https://lit.dev/), not Angular
- Lit components should consume shared concepts (constants, values) from the component library when possible, without introducing Angular or other dependency entanglements

## Browser API Usage

- Content scripts cannot import the `BrowserApi` abstraction required elsewhere in the browser extension
- Direct use of `chrome.*` / `browser.*` APIs (e.g., `chrome.runtime.sendMessage`) is expected here
- This is an exception to the `BrowserApi` rule in the parent `apps/browser/CLAUDE.md`

## Cross-Browser Compatibility

- Ensure injected code is compatible across browser clients, particularly Firefox, Chrome, and Safari
- Use polyfills and vendor-specific implementations where needed

## Memory Management

- Ensure proper teardown of listeners, observers, and other concerns that might linger in memory
- Content scripts do not benefit from Angular's lifecycle hooks — cleanup must be handled manually
