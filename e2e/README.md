# E2e

```
NOTE: This package is currently a key-management team internal experiment. Please do not
yet contribute to it, or place your tests here. We may in the future standardize this via
an ADR at which point other teams may use it.
```

Playwright end-to-end suites for the web, browser extension and desktop clients.

```
npm run test:e2e:web       # webpack dev server + chromium
npm run test:e2e:browser   # builds the chrome extension, loads it unpacked
npm run test:e2e:desktop   # builds electron main/renderer/preload, launches the app
npm run test:e2e:all       # all three, sequentially
```

Add `-- --headed`, `-- --debug` or `-- --ui` to any of them; everything after `--`
is forwarded to `playwright test`.

Failing tests keep a video. Set `E2E_VIDEO=1` to record every test; videos land in
`e2e/test-results/<test>/`.

## Credentials

Accounts live in `.debug/credentials.txt` (gitignored), an INI-style file:

```
[local-web]
email=e2e-web@example.com
password=...
server=localhost
```

`server` picks the environment: a bare `localhost` maps to the local dev server,
anything else is used as the self-hosted base URL.

Defaults differ per client, because only desktop and browser can be pointed at a
server at runtime — the web client's API URLs are baked into its build:

| suite   | default account |
| ------- | --------------- |
| web     | `local-web`     |
| browser | `usdev-e2e`     |
| desktop | `usdev-e2e`     |

Override with `E2E_ACCOUNT=<section>`.

The web suite builds and serves the client itself, so it can only reach the local
stack. To run it against an already-deployed vault instead, give it both the URL
and a matching account:

```
E2E_WEB_URL=https://vault.usdev.bitwarden.pw E2E_ACCOUNT=usdev-e2e npm run test:e2e:web
```

## Client notes

- **web** — the dev server both builds and serves, and proxies `/api`,
  `/identity`, … to the local server on the ports in `apps/web/config/development.json`.
  Its certificate is self-signed, so `ignoreHTTPSErrors` is on.
- **browser** — a production build, run in a persistent context with the unpacked
  build loaded. A development build is pinned to the local stack by the
  `managedEnvironment` dev flag in `apps/browser/config/development.json`, which
  also removes the environment selector, so it can never reach another server.
  Extensions require a headed browser, so this suite always runs headed.
- **desktop** — state is isolated under `.debug/e2e/desktop-profile`, wiped
  before each run, so a suite never touches a real installation's vault.

## Headless

Only the web suite is headless. The other two open a window:

- Chromium's new headless mode is the only one that loads extensions, and it
  restarts the extension's service worker repeatedly.
- Electron has no headless mode.

On a Linux CI runner, wrap both in a virtual display:

```
xvfb-run -a npm run test:e2e:browser
xvfb-run -a npm run test:e2e:desktop
```
