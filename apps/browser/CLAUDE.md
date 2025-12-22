# Browser Extension - Critical Rules

- **NEVER** use `chrome.*` or `browser.*` APIs directly in business logic
  - Always use `BrowserApi` abstraction: `/apps/browser/src/platform/browser/browser-api.ts`
  - Required for cross-browser compatibility (Chrome/Firefox/Safari/Opera)

- **ALWAYS** use `BrowserApi.addListener()` for event listeners in popup context
  - Safari requires manual cleanup to prevent memory leaks
  - DON'T use native `chrome.*.addListener()` or `browser.*.addListener()` directly

- **CRITICAL**: Safari has tab query bugs
  - Use `BrowserApi.tabsQueryFirstCurrentWindowForSafari()` when querying current window tabs
  - Safari can return tabs from multiple windows incorrectly

## Manifest V3

- Extension uses Web Extension API Manifest V3
- **Service workers replace background pages**
  - Background context runs as service worker (can be terminated anytime)
  - DON'T assume background page persists indefinitely
  - Use message passing for communication between contexts
  - `chrome.extension.getBackgroundPage()` returns `null` in MV3
