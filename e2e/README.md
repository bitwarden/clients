# E2e

```
NOTE: This package is currently a key-management team internal experiment. Please do not
yet contribute to it, or place your tests here. We may in the future standardize this via
an ADR at which point other teams may use it.
```

Playwright end-to-end suites for the web, browser extension and desktop clients, plus a
`shared` suite spanning web and extension.

```
npm run test:e2e:web       # webpack dev server + chromium
npm run test:e2e:browser   # builds the chrome extension, loads it unpacked
npm run test:e2e:desktop   # builds electron main/renderer/preload, launches the app
npm run test:e2e:shared    # web + extension together, e.g. passkey unlock
npm run test:e2e:all       # all four, sequentially
```

Failing tests keep a video. Set `E2E_VIDEO=1` to record every test; videos land in
`e2e/test-results/<test>/`.

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
