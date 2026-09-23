# Web Connectors

## WebAuthn Flow

> NOTE: This flow currently describes a transitory state that this web connector is regarding the mobile client governing the scheme for linking back to the application. This will be moving to leveraging detecting the cloud environment and using the corresponding protocols.

Three HTML variants are built from the same TS entry point (`webauthn.ts`):

- `webauthn-connector.html` — iframe embed for web vault and desktop (template: `webauthn.html`)
- `webauthn-mobile-connector.html` — full-page mobile UI with logo and security key image (template: `webauthn-mobile.html`)
- `webauthn-fallback-connector.html` — Firefox new-tab fallback (template: `webauthn-fallback.html`, uses separate entry point `webauthn-fallback.ts`)

All variants share `common-webauthn.ts` for assertion serialization (`buildDataString()`) and
credential parsing (`parseWebauthnJson()`), and `common.ts` for query param parsing and deeplink URI
construction.

The connector supports two parameter protocols selected by the `v` query param
(`webauthn.ts`):

- **V1:** base64-encoded `data` + individual query params (`data`, `parent`, `btnText`,
  `btnAwaitingInteractionText`, `v=1`). Used by iframe and fallback flows.
- **V2:** JSON-encoded `data` object containing `{ data, headerText, btnText, btnReturnText,
mobile? }`, plus `deeplinkScheme` query param. Used by mobile flows.

Core interaction: `parseWebauthnJson()` converts the base64url challenge and allowCredentials IDs to
`Uint8Array`. On non-Safari browsers, `navigator.credentials.get({ publicKey })` is called
automatically on load; Safari requires a user-initiated button click (`webauthn.ts`). On
success, `buildDataString()` serializes the `PublicKeyCredential` response (id, rawId,
authenticatorData, clientDataJSON, signature) to JSON with base64url encoding.

### Mobile App Callback

1. Mobile app opens auth web view to `webauthn-mobile-connector.html` (or `webauthn-connector.html`), passing `deeplinkScheme` and V2 `data` query params
2. Connector parses V2 parameters: JSON-decodes the base64 `data` param to extract the webauthn challenge object, header text, and button labels (`webauthn.ts`)
3. Connector displays "read security key" button
4. User interacts with security key
5. Connector calls `navigator.credentials.get({ publicKey })` and serializes the assertion via `buildDataString()`
6. Connector builds callback URI via `buildMobileDeeplinkUriFromParam("webauthn")` (`common.ts`): `deeplinkScheme=https` → `https://bitwarden.com/webauthn-callback` (host varies by region: `.eu`, `.pw`); otherwise → `bitwarden://webauthn-callback`
7. Redirects via `document.location.replace(callbackUri + "?data=" + encodedData)` (`webauthn.ts`); a fallback "Return" button is rendered in case scripted navigation is blocked (`webauthn.ts`)
8. Mobile OS intercepts the URL and returns control to the app
9. Mobile app receives the WebAuthn assertion data
10. **Error path:** redirects to `callbackUri + "?error=" + encodedMessage` instead (`webauthn.ts`)

### Web Vault / Iframe Callback

The `WebAuthnIFrame` class (`libs/common/src/auth/webauthn-iframe.ts`) manages the iframe lifecycle
for both web vault and desktop.

1. `WebAuthnIFrame.init()` embeds `webauthn-connector.html` in an iframe with `allow="publickey-credentials-get <origin>"` (`webauthn-iframe.ts`)
2. Passes V1 params: `data` (base64-encoded JSON), `parent` (embedding page URL), `btnText`, `btnAwaitingInteractionText`, `v=1` (`webauthn-iframe.ts`)
3. Connector sends `parent.postMessage("info|ready", parentUrl)` on load (`webauthn.ts`)
4. On non-Safari browsers, `navigator.credentials.get()` fires automatically; Safari waits for button click
5. On success, connector sends `parent.postMessage("success|<data>", parentUrl)` (`webauthn.ts`); on failure, sends `parent.postMessage("error|<message>", parentUrl)` (`webauthn.ts`)
6. `WebAuthnIFrame.parseMessage()` splits the pipe-delimited message and invokes the registered `successCallback`, `errorCallback`, or `infoCallback` (`webauthn-iframe.ts`)
7. Parent can send `"stop"` / `"start"` messages to pause and resume the WebAuthn attempt (`webauthn.ts`, `webauthn-iframe.ts`)

### Browser Extension / Firefox Fallback Callback

Firefox cannot use WebAuthn inside an extension iframe, so `WebAuthnIFrame` opens
`webauthn-fallback-connector.html` in a new tab instead (`webauthn-iframe.ts`).

1. `webauthn-fallback.ts` loads, parses V1 parameters including `parent` and `locale` for i18n (`webauthn-fallback.ts`)
2. User clicks "Read Security Key" button, triggering `navigator.credentials.get({ publicKey })` (`webauthn-fallback.ts`)
3. On success, connector sends `window.postMessage({ command: "webAuthnResult", data: dataString, remember }, "*")` (`webauthn-fallback.ts`)
4. The browser extension's content script (`content-message-handler.ts`) picks up the `webAuthnResult` message and forwards it via `chrome.runtime.sendMessage()` to the background service worker
5. Background handler (`runtime.background.ts`) validates the referrer is a known vault URL via `isValidVaultReferrer()` (`runtime.background.ts`)
6. On success, opens a 2FA popout at `popup/index.html#/2fa;webAuthnResponse=...;remember=...` via `openTwoFactorAuthWebAuthnPopout()` (`auth-popout-window.ts`)

## Duo Flow

> NOTE: This flow currently describes a transitory state that this web connector is regarding the mobile client governing the scheme for linking back to the application. This will be moving to leveraging detecting the cloud environment and using the corresponding protocols.

The Duo connector is `duo-redirect-connector.html` (source: `duo-redirect.ts`, template:
`duo-redirect.html`). It serves two purposes:

1. **Frameless redirect:** When loaded with a `duoFramelessUrl` query param, validates the URL
   against strict security rules and redirects to Duo's OAuth authorize endpoint
   (`duo-redirect.ts`). Validation requires: hostname matching
   `/^api-[a-zA-Z0-9]+\.(duosecurity|duofederal)\.com$/`, HTTPS protocol, no embedded credentials,
   no custom ports, and pathname `/oauth/v1/authorize`.
2. **Result dispatch:** When Duo's OAuth flow completes, the callback returns to
   `duo-redirect-connector.html` with `client`, `code`, and `state` query params. The connector
   routes the result to the correct client based on the `client` param (`duo-redirect.ts`).

All clients ultimately construct a 2FA token as `code|state` (`Duo2faResult.token`), submitted via
`loginStrategyService.logInTwoFactor()`.

### Mobile App Callback

1. Mobile app attempts login with connect token, supplying a `deeplinkScheme` form value
2. Server returns failed login response with Duo token containing `AuthUrl` whose `redirect_uri` points back to `duo-redirect-connector.html?client=mobile&deeplinkScheme=...`
3. Mobile app navigates to the Duo authentication URL
4. User completes Duo 2FA (push, SMS, etc.)
5. Duo redirects to `duo-redirect-connector.html?client=mobile&code=...&state=...&deeplinkScheme=...`
6. Connector calls `buildMobileDeeplinkUriFromParam("duo")` (`common.ts`): `deeplinkScheme=https` → `https://bitwarden.com/duo-callback` (host varies by region: `.eu`, `.pw`); otherwise → `bitwarden://duo-callback`. Redirects via `document.location.replace(uri + "?code=...&state=...")` (`duo-redirect.ts`)
7. Mobile OS intercepts the URL and returns control to the app
8. Mobile app receives Duo code/state and completes authentication

### Web App Callback

1. Web app launches Duo `AuthUrl` (from `providerData.AuthUrl`) in a new window; the server-provided `redirect_uri` includes `client=web`
2. User completes Duo 2FA in the new window
3. Duo redirects to `duo-redirect-connector.html?client=web&code=...&state=...`
4. Connector sends `{ code, state }` via `new BroadcastChannel("duoResult")` and closes the channel (`duo-redirect.ts`)
5. `WebTwoFactorAuthDuoComponentService` (`apps/web/src/app/auth/core/services/two-factor-auth/web-two-factor-auth-duo-component.service.ts`) listens on the same `BroadcastChannel("duoResult")` and maps the message to a `Duo2faResult`
6. Connector displays a handoff message with a 5-second auto-close countdown and close button (`duo-redirect.ts`)

### Browser Extension Callback

1. Extension opens a 2FA popout (`openTwoFactorAuthDuoPopout()`, `auth-popout-window.ts`) and navigates to `duo-redirect-connector.html?duoFramelessUrl=<encoded-duo-auth-url>&handOffMessage=<encoded-json>` (`extension-two-factor-auth-duo-component.service.ts`)
2. Connector validates the Duo URL and redirects to Duo (`duo-redirect.ts`)
3. After Duo auth, callback returns to `duo-redirect-connector.html?client=browser&code=...&state=...`
4. Connector sends `window.postMessage({ command: "duoResult", code, state }, window.location.origin)` (`duo-redirect.ts`)
5. Content script (`content-message-handler.ts`) picks up the `duoResult` message and forwards it via `chrome.runtime.sendMessage()` to the extension
6. `ExtensionTwoFactorAuthDuoComponentService.listenForDuo2faResult$()` receives the message through the extension's messaging system and maps it to a `Duo2faResult` (`extension-two-factor-auth-duo-component.service.ts`)
7. Connector displays a "you may close this window" handoff message (`duo-redirect.ts`)

### Desktop App Callback

1. Desktop navigates to `duo-redirect-connector.html?duoFramelessUrl=<encoded-duo-auth-url>&handOffMessage=<encoded-json>` (`desktop-two-factor-auth-duo-component.service.ts`)
2. Connector validates the Duo URL and redirects to Duo (`duo-redirect.ts`)
3. After Duo auth, callback returns to `duo-redirect-connector.html?client=desktop&code=...&state=...`
4. Connector displays a handoff message, then redirects to `bitwarden://duo-callback?code=...&state=...` (hardcoded `mobileDesktopCallback`, `duo-redirect.ts`)
5. `processDeepLink()` (`app.component.ts`) detects the `bitwarden://duo-callback` URI, extracts `code` and `state`, and sends a `"duoCallback"` message via `messagingService`
6. `DesktopTwoFactorAuthDuoComponentService` listens for `DUO_2FA_RESULT_COMMAND` (`"duoCallback"`) via `messageListener.messages$()` and maps it to a `Duo2faResult` (`desktop-two-factor-auth-duo-component.service.ts`)

## SSO Flow

Unlike the Duo and WebAuthn connectors — which act as intermediaries for all clients including
mobile — the SSO connector (`sso-connector.html` / `sso.ts`) is only used by **web** and
**browser extension**. Desktop and CLI receive IdP callbacks directly via deep link or localhost
HTTP server, bypassing the connector entirely.

All clients share a common `SsoComponent` (`libs/auth/src/angular/sso/sso.component.ts`) hosted on
the web vault that handles org identifier input and IdP redirect. The callback path after IdP
authentication diverges per client based on the `redirect_uri` registered with IdentityServer.

### Web App Callback

The web app sets `redirect_uri` to `{webVaultUrl}/sso-connector.html` (hardcoded in the `SsoComponent` constructor, `sso.component.ts`).

1. After IdP authentication, IdentityServer redirects to `sso-connector.html?code={code}&state={state}`
2. `sso.ts` loads and calls `initiateWebAppSso()` (state does not contain `:clientId=browser`)
3. If `state` contains a `_returnUri`, the user is redirected to that URI; otherwise, redirected to `/#/sso?code={code}&state={state}`
4. `SsoComponent.ngOnInit()` detects `code` + `state` in query params via `userCompletedSsoAuthentication()`
5. Retrieves `codeVerifier` and pre-login `state` from `SsoLoginService`
6. Validates state matches, exchanges code for token via `loginStrategyService.logIn()` with `SsoLoginCredentials`

### Browser Extension Callback

The browser extension also sets `redirect_uri` to `{webVaultUrl}/sso-connector.html` (`extension-login-component.service.ts`), but appends `:clientId=browser` to the `state` (`default-login-component.service.ts`) so the connector can distinguish it from a web login.

1. After IdP authentication, IdentityServer redirects to `sso-connector.html?code={code}&state={state}`
2. `sso.ts` detects `:clientId=browser` in the state and calls `initiateBrowserSso()`
3. `initiateBrowserSso()` calls `window.postMessage({ command: "authResult", code, state })` targeting the page's own origin
4. The browser extension's content script (`content-message-handler.ts`) picks up the `authResult` message and forwards it via `chrome.runtime.sendMessage()` to the background service worker
5. Background handler (`runtime.background.ts`) validates the referrer is a known vault URL via `isValidVaultReferrer()`
6. On success, opens an SSO popout window at `popup/index.html#/sso?code={code}&state={state}` via `openSsoAuthResultPopout()` (`auth-popout-window.ts`)
7. The extension's `SsoComponent` instance completes the token exchange

### Desktop App Callback (bypasses sso-connector.html)

Desktop has two callback mechanisms, selected based on platform support (`desktop-login-component.service.ts`):

**Deep link (default):** Uses `bitwarden://sso-callback` as the `redirect_uri` (the `DESKTOP_SSO_CALLBACK` constant exported from `sso-url.service.ts`).

1. After IdP authentication, IdentityServer redirects to `bitwarden://sso-callback?code={code}&state={state}`
2. OS intercepts the custom protocol URL and routes it to Electron
3. `processDeepLink()` in `app.component.ts` parses the URL, extracts `code` and `state`
4. Sends a `ssoCallback` message via `messagingService`
5. `app.component.ts` handles `ssoCallback`, navigates to the `["sso"]` route with `code`, `state`, and `redirectUri` as query params
6. Desktop's `SsoComponent` instance completes the token exchange

**Localhost HTTP server (fallback for AppImage / dev):** Uses `http://localhost:{port}` as the `redirect_uri`, managed by `sso-localhost-callback.service.ts`.

1. Starts an HTTP server trying ports 8065–8070 (`sso-localhost-callback.service.ts`)
2. Sets `redirect_uri` to `http://localhost:{port}` and opens the web vault SSO URL in a browser
3. After IdP authentication, IdentityServer redirects to `http://localhost:{port}?code={code}&state={state}`
4. Localhost server receives the request, validates state, sends a `ssoCallback` message
5. Flow continues identically to the deep link path from step 5 above

### CLI Callback (bypasses sso-connector.html)

The CLI uses a localhost HTTP server exclusively (`login.command.ts`).

1. Starts an HTTP server trying ports 8065–8070
2. Sets `redirect_uri` to `http://localhost:{port}`
3. Calls `SsoUrlService.buildSsoUrl()` and opens the resulting web vault URL in a browser
4. User completes org identifier entry and IdP authentication on the web vault
5. After IdP authentication, IdentityServer redirects to `http://localhost:{port}?code={code}&state={state}`
6. Localhost server receives the request, validates state, extracts the org identifier from state (via `_identifier=` suffix)
7. CLI exchanges code for token via `loginStrategyService.logIn()` with `SsoLoginCredentials`
