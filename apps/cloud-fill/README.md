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

    PATH=<wasm-bindgen-cli 0.2.129 bin>:$PATH apps/cloud-fill/build-wasm.sh
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

## Running it on a real browser

The extension takes commands only through Chrome native messaging. The `host/` directory has the pieces.

1. Load the extension (unpacked from `dist/`, or from the zip) and note its id on `chrome://extensions`.
2. Register the host. This copies the host into `~/.cloud-fill`, writes a wrapper that pins the current `node`, and writes the host manifest, which allows only that extension id to start the host:

   ```shell
   node apps/cloud-fill/host/install.mjs --extension-id <id>
   ```

   Use `--browser chromium|brave|edge` for other browsers, `--manifest-dir <dir>` and `--home <dir>` to override the manifest and install locations, and `--uninstall` to remove it. The extension reconnects on its own within about 30 seconds, so the browser does not need a restart.

3. On the machine that holds the vault, start the approving side and take its pairing token:

   ```shell
   aac listen --psk
   ```

4. Pair, then fill. Pass the token on stdin so it does not appear in the process list:

   ```shell
   echo "<token>" | node ~/.cloud-fill/bin/cloud-fill.mjs pair -
   node ~/.cloud-fill/bin/cloud-fill.mjs fill --origin https://example.com
   ```

   `fill` acts on the active tab, requests the credential for that tab's origin, waits for the user to approve, and prints a status only. `--origin` makes it refuse if the active tab is on a different origin.

Anything that can run as the same user can reach `~/.cloud-fill/host.sock` and trigger a fill, so an agent with a shell on this machine can call it too. Each fill still needs the user's approval unless the approving client auto-approves. Pairing tokens are single use and the pairing lives in browser session storage, so a new browser session needs a new token.
