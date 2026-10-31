# E2e

```
NOTE: This package is currently a key-management team internal experiment. Please do not
yet contribute to it, or place your tests here. We may in the future standardize this via
an ADR at which point other teams may use it.
```

Playwright end-to-end suites for the web, browser extension and desktop clients, plus a
`shared` suite, which can run tests involving multiple clients at the same time.

Install the browser once:

```
npx playwright install chromium
```

```
npm run test:e2e:web       # webpack dev server + chromium
npm run test:e2e:browser   # builds the chrome extension, loads it unpacked
npm run test:e2e:desktop   # builds electron main/renderer/preload, launches the app
npm run test:e2e:shared    # web + extension together, e.g. passkey unlock
npm run test:e2e:all       # all four, sequentially
```

## Memory

`npm run test:e2e:memory` walks the browser extension through its lifecycle (logged out,
popup on the vault, popup closed, pages with content scripts, inline menu, autofill, a
restarted service worker, popup reopened) and records, at each step:

- the JS heap and WebAssembly memory of every extension context, after a forced GC
- the extension process's physical footprint (macOS `footprint`)
- in the service worker: vault decrypt calls, the decrypted cipher cache, and how many
  plaintext passwords its heap holds

Results land in `.debug/e2e/memory/<E2E_MEMORY_LABEL>/report.json`. Compare runs, or
inspect a heap:

```
E2E_EXTENSION_DIR=/path/to/build E2E_MEMORY_LABEL=after npm run test:memory --workspace @bitwarden/e2e
node e2e/scripts/memory-compare.mjs before after
E2E_HEAP_SNAPSHOT=1 ...                      # save heap snapshots too
node e2e/scripts/heap-retainers.mjs <file>   # what keeps the most memory alive
```

Use a large vault, e.g. `E2E_ACCOUNT=<section with ~10k items>`.

`tests/browser-memory/unlock.e2e.ts`, in the same suite, times master password and PIN
unlock from the click to the vault list's first paint (the popup's `Vault rendered` mark),
and opening the popup while unlocked, 10 runs each, into `unlock.json`. Biometric unlock
runs through the desktop app over native messaging and is not covered.

The browser window opens off-screen; `E2E_HEADED=1` shows it. Headless Chromium restarts
the extension's service worker, which leaves the popup loading.

Failing tests keep a video and a trace (`npx playwright show-trace <trace.zip>`).
Set `E2E_VIDEO=1` to record every test; both land in `e2e/test-results/<test>/`.

## Credentials

Accounts live in `.debug/credentials.txt` (gitignored), an INI-style file:

```
[local-web]
email=e2e-web@example.com
password=...
server=https://localhost:8080
```

Since these are on-disk credentials, only use test accounts.

`server` is the account's web vault URL, and the self-hosted base URL desktop and
browser log into. A bare host means `https://<host>`.

Every suite defaults to `local-web`, because the web client's API URLs are baked
into its build; desktop and browser point their self-hosted setting at it.
Override with `E2E_ACCOUNT=<section>`.

The web suite builds and serves the client itself when `server` is the dev server,
`https://localhost:8080`. Any other `server` must be a deployed vault:

```
E2E_ACCOUNT=usdev-e2e npm run test:e2e:web
```

## Headless

Only the web suite is headless. The others open a window:

- Chromium's new headless mode is the only one that loads extensions, and it
  restarts the extension's service worker repeatedly.
- Electron has no headless mode.

On a Linux CI runner, wrap them in a virtual display:

```
xvfb-run -a npm run test:e2e:browser
xvfb-run -a npm run test:e2e:desktop
xvfb-run -a npm run test:e2e:shared
```
