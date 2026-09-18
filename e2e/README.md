# Desktop end-to-end tests

Playwright tests that drive the desktop app over the Chrome DevTools protocol.
Each run wipes `.debug/desktop-profile`, starts the app with mocked biometrics
(`npm run debug:desktop:automation`) and attaches to it, so tests always begin
from a fresh, logged-out app.

Feature flags, biometric prompts, locking, and the after-first-unlock state a
restart leaves behind are driven through the in-app automation driver, wrapped by
`utils/automation-driver.ts`.

## Setup

1. Create `.debug/e2e-credentials.txt` (git-ignored) with your test accounts:

   ```ini
   [default]
   email=test@example.com
   password=<master password>
   server=https://vault.example.com
   ```

   Test accounts only. The file is read by `utils/credentials.ts`.

   The `server` value is applied through the environment selector before login.

## Running

```bash
npm run test:e2e
```

Test files share one app instance and run in filename order, hence the numeric
prefixes: `01-login.spec.ts` logs in, later files assume an unlocked vault.
