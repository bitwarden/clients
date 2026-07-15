# Browser Extension E2E Tests (Playwright) — Critical Rules

**NEVER**

- Modify production app code
- Modify the extension build/webpack/nx config — the tests consume the existing Nx build outputs
  (`dist/apps/browser/<target>`, where `<target>` is an Nx build-configuration name such as
  `chrome-dev`, selected via the `TARGETS` env var)
- Define selectors inline with tests — page/fragment objects (`*.page.ts` / `*.fragment.ts`) are
  defined alongside the component code they target

**Extension install**

- The unpacked extension is loaded into Chromium via `chromium.launchPersistentContext` with
  `--load-extension` (see `support/extension.fixture.ts`), then driven through its popup URL
  (`chrome-extension://<id>/popup/index.html`). The extension id is read from the MV3 service-worker
  URL. The config's `globalSetup` builds it first: `npx nx build browser --configuration=chrome-dev`.
- **Chromium only.** Playwright cannot load Firefox extensions.

**Runtime requirements & known limitations**

- **Runs headed by default; headless does not work.** In headless Chrome the MV3 background service
  worker registers but never finishes startup, so the popup hangs forever on its loading spinner.
  `HEADLESS=true` is intentionally opt-in and known-broken.
- **A running backend is required.** The extension points at `BW_SERVER_URL` as a self-hosted server
  and needs `/api`, `/identity`, etc. reachable there — the full server stack, not just the
  web-vault dev server on :8080.
- **Popup init is timing-sensitive.** The popup must not be reloaded while the MV3 worker is
  cold-starting — a reload restarts the handshake — so `openPopup` issues a single navigation and
  waits (no reload retry). Initial render can be slow/flaky under machine load; prefer a clean
  machine and kill stray Chrome processes between runs.

**References**

- https://playwright.dev/docs/chrome-extensions
- https://playwright.dev/docs/pom
- https://playwright.dev/docs/locators
- https://playwright.dev/docs/test-assertions
