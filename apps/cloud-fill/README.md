# Cloud Fill (spike)

Minimal MV3 extension that fills a login in an agent's cloud browser from a credential the user
approved in their Bitwarden client over Agent Access. It is not part of the main browser build and
reuses the autofill framework from `apps/browser/src/autofill`.

- `src/content.ts`: isolated-world content script (collect and insert services). Injected into the
  top frame by the service worker at fill time. No static content scripts.
- `src/fill.ts`: takes the origin from the browser's record of the top frame, collects page
  details, refuses cross-origin form actions, asks a `CredentialSource`, builds the fill script with
  the shared `generateLoginFillScript` and sends it to the content script. Results carry a status only.
- `src/relay-credential-source.ts`, `wasm-remote/`: Agent Access RemoteClient compiled to wasm.
  Identity and sessions are kept in `chrome.storage.session`.
- `src/native-channel.ts`: trigger channel. Only the native messaging host Chrome launches for the
  extension id can request a fill or a pairing.
- `src/static-credential-source.ts`: hardcoded test credential, test builds only.

Build (uses the repo root `node_modules`):

    PATH=<wasm-bindgen-cli 0.2.114 bin>:$PATH apps/cloud-fill/build-wasm.sh
    node apps/cloud-fill/build.mjs                      # production: https origins, wss relay
    CLOUD_FILL_TEST_BUILD=1 node apps/cloud-fill/build.mjs   # allows localhost and ws:// relays

Tests (need a Chromium that honors `--load-extension`, for example Playwright's):

    CLOUD_FILL_TEST_BUILD=1 CLOUD_FILL_SOURCE=static node apps/cloud-fill/build.mjs
    PLAYWRIGHT_BROWSERS_PATH=<dir> node apps/cloud-fill/test/fill.e2e.mjs

    CLOUD_FILL_TEST_BUILD=1 node apps/cloud-fill/build.mjs
    AP_RELAY_BIN=<ap-relay> AP_LISTENER_BIN=<rust-listener-example> \
      PLAYWRIGHT_BROWSERS_PATH=<dir> node apps/cloud-fill/test/relay.e2e.mjs

`ap-relay` and the listener come from the agent-access repo (`cargo build -p ap-relay`, and
`cargo build --manifest-path examples/rust-listener/Cargo.toml`).
