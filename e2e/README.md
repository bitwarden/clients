# End-to-end tests

Playwright suites, one folder per client:

| Folder     | Client              | How it runs                                                                 |
| ---------- | ------------------- | --------------------------------------------------------------------------- |
| `desktop/` | Electron app        | wipes `.debug/desktop-profile`, starts `debug:desktop:automation`, attaches |
| `browser/` | Chrome extension    | wipes `.debug/chrome-profile`, starts `debug:browser`, attaches             |
| `web/`     | web vault, dev mode | starts the webpack dev server, Playwright launches its own browser          |

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
npm run test:e2e            # all three, in sequence
npm run test:e2e:desktop
npm run test:e2e:browser
npm run test:e2e:web
```

Within a suite the files share one client instance and run in filename order,
hence the numeric prefixes: `01-login.spec.ts` logs in, later files assume an
unlocked vault.
