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

Multi-account tests sign in a second account from `local-web-2`, on the same server.
Override with `E2E_SECOND_ACCOUNT=<section>`.

The web suite builds and serves the client itself when `server` is the dev server,
`https://localhost:8080`. Any other `server` must be a deployed vault:

```
E2E_ACCOUNT=usdev-e2e npm run test:e2e:web
```

`E2E_EMAIL`, `E2E_PASSWORD` and `E2E_SERVER` take precedence over the file when all
three are set. CI uses them.

## Seeded data

Tests that need their own users, organizations or items create them through the server's
SeederApi (`util/SeederApi` in bitwarden/server) instead of the shared accounts above.
Run it beside the local server:

```
cd util/SeederApi && dotnet run   # http://localhost:5047
```

It takes a basic-auth account from its `seederSettings:accounts`. Give the suite the same one
in a `[seeder]` section:

```
[seeder]
username=e2e
password=...
url=http://localhost:5047
```

`url` is optional. `E2E_SEEDER_USERNAME`, `E2E_SEEDER_PASSWORD` and `E2E_SEEDER_URL` take
precedence over the file. With no account configured, tests that seed are skipped.

Import `test` from `src/seeder/fixtures.ts`, which adds a `play` fixture holding the test's
data, and `newPage` for a second user's page:

```ts
const user = await play.scene(
  new SingleUserScene({ email: "user@example.com", password: randomUUID() }),
);
await logInToWebVault(page, seededAccount(user));
```

The server mangles unique values such as emails; `scene.mangle("user@example.com")` returns the
stored one. Everything a play seeds, and everything its pages create through the client, is
deleted when the test ends. `E2E_KEEP_SEEDED_DATA=1` keeps it and prints the command that
deletes it; the SeederApi also deletes play data older than a day.

Add a scene or query by subclassing `SceneTemplate` in `src/seeder/scenes/` or
`QueryTemplate` in `src/seeder/queries/`, named after the server's class and typed after its
`Request` and result.

## CI

`.github/workflows/test-e2e-usdev.yml` runs every suite against usdev nightly, and on
a PR when it is labeled `ci:km-e2e-tests`. The web suite drives the deployed usdev
vault, so a PR's web changes are not under test; the others build their client from
the PR.

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
