# End-to-end tests

Playwright suites, one folder per client:

| Folder      | Client              | How it runs                                                                 |
| ----------- | ------------------- | --------------------------------------------------------------------------- |
| `desktop/`  | Electron app        | wipes `.debug/desktop-profile`, starts `debug:desktop:automation`, attaches |
| `browser/`  | Chrome extension    | wipes `.debug/chrome-profile`, starts `debug:browser`, attaches             |
| `web/`      | web vault, dev mode | starts the webpack dev server, Playwright launches its own browser          |
| `combined/` | desktop + extension | starts both debug clients and pairs them over native messaging              |

Desktop and browser are launched outside Playwright and driven over the Chrome
DevTools protocol, so the tests exercise the same build you would debug by hand.
Both start from a wiped profile, so every run begins logged out.

`utils/` holds what every client shares (credentials, login, lock screen, the
automation driver wrapper); each client folder holds what only it can do — the
desktop settings dialog, the extension's popup routes.

Feature flags, biometric prompts, locking, and the after-first-unlock state a
restart leaves behind are driven through the in-app automation driver, wrapped by
`utils/automation-driver.ts`.

## Setup

1. Create `.debug/e2e-credentials.txt` (git-ignored) with your test accounts:

   ```ini
   [default]
   email=test@example.com
   password=<master password>
   server=vault.example.com

   # Used by the web suite, which serves the dev build against your local
   # server stack, so omit `server` and register the account there. Sign up
   # through the dev server and pick the verification mail out of mailcatcher
   # (http://localhost:1080).
   [local]
   email=local@example.com
   password=<master password>
   ```

   Test accounts only. The file is read by `utils/credentials.ts`. When `server`
   is set it is applied through the environment selector before login.

2. The web suite needs the local server stack running (api on 4000, identity on
   33656, …) — that is what the dev server proxies to. The SSO tests also need
   the stack's SAML IdP (`docker compose --profile idp up -d`, on :8090) and an
   organization configured for SSO, named by `sso_identifier` in the
   credentials file.

3. The browser suite needs the launcher's own dev dependencies:

   ```bash
   npm install --no-save puppeteer-core @puppeteer/browsers
   ```

## Running

```bash
npm run test:e2e            # all four, in sequence
npm run test:e2e:desktop
npm run test:e2e:browser
npm run test:e2e:web
npm run test:e2e:combined
```

Within a suite the files share one client instance and run in filename order,
hence the numeric prefixes: `01-login.spec.ts` logs in, later files assume an
unlocked vault.

## BDD scenarios

New tests are written in Gherkin and run through
[playwright-bdd](https://vitalets.github.io/playwright-bdd/), which compiles a
`.feature` file into a Playwright test file:

```
desktop/features/*.feature   scenarios, the readable spec
desktop/steps/*.ts           step definitions
desktop/utils/bdd.ts         fixtures (`app`, `page`, `driver`) + Given/When/Then
desktop/.features-gen/       generated tests, git-ignored
```

Generation is a separate step, so the suite is run as `bddgen test && playwright
test` — that is what `npm run test:e2e:desktop` does. Because a Playwright
project has a single `testDir`, the generated tests live in their own `bdd`
project that depends on the `specs` project, keeping the log-in-first ordering.

To add BDD to another suite, copy `desktop/utils/bdd.ts` (the fixtures differ
per client) and the two projects from `desktop/playwright.config.ts`.

## The cross-client suite

`combined/` covers what neither client can do alone: the extension's biometric
unlock, which is answered by the desktop app over native messaging.

```
desktop (Electron, :9222) ── .debug/s.bw ── desktop_proxy ── Chrome (:9200)
                                                 ▲
                       .debug/chrome-profile/NativeMessagingHosts/…json
```

`combined/start.js` starts `debug:desktop:automation` and `debug:browser` from
wiped profiles and then writes the missing piece of local IPC: both debug runs
already share the `.debug` IPC socket dir, but the desktop app only writes native
messaging manifests for real browser profiles, and it cannot know the debug
extension's id. So the launcher waits for the extension's service worker, writes
a manifest for that id into the debug Chrome profile (Chrome resolves manifests
relative to its user data dir, so the host system's Chrome is untouched), and
only then answers the readiness URL Playwright waits on.

Scenarios get two pages — `desktop` and `extension` — plus `driver`, the desktop
automation driver, since the biometric prompt is mocked on the desktop side.

```bash
npm run test:e2e:combined
```
