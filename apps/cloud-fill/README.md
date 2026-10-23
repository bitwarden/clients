# Cloud Fill (spike)

Minimal MV3 extension that fills a login in an agent's cloud browser. It is not part of the main
browser build and reuses the autofill framework from `apps/browser/src/autofill`.

- `src/content.ts`: isolated-world content script (collect and insert services). Injected into the
  top frame by the service worker at fill time. No static content scripts.
- `src/background.ts`, `src/fill.ts`: service worker. Takes the origin from the browser's record of
  the top frame, collects page details, asks a `CredentialSource`, builds the fill script with the
  shared `generateLoginFillScript`, and sends it to the content script. Results carry a status only.
- `test/fill.e2e.mjs`: loads the unpacked extension in Chromium and drives the fill.

Build and test (uses the repo root `node_modules`):

    CLOUD_FILL_ALLOW_LOCALHOST=1 node apps/cloud-fill/build.mjs
    PLAYWRIGHT_BROWSERS_PATH=<dir with chromium> node apps/cloud-fill/test/fill.e2e.mjs

`CLOUD_FILL_ALLOW_LOCALHOST=1` is for test builds only; the default build accepts https origins only.
