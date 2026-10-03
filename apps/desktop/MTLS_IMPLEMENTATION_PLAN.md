# Linux desktop mTLS implementation plan

Status: x86_64 implementation and Flatpak packaging completed with a manual finish/export path; packaged end-to-end validation remains open. The standard Flatpak finisher lacks `appstreamcli-compose`. See [MTLS_PROTOTYPE_REPORT.md](MTLS_PROTOTYPE_REPORT.md). aarch64 is outside the user-requested scope.

For concrete requirements, interfaces, lifecycle rules, implementation tasks, and prototype gates, see [MTLS_DETAILED_CONCEPT.md](MTLS_DETAILED_CONCEPT.md). Where this overview offers alternatives, the detailed concept defines the proposed baseline.

## Requirements and scope

Implement client certificate authentication for the Linux desktop client, prioritizing the Flatpak package.

- Accept password protected PKCS#12 files (`.p12` and `.pfx`) containing a certificate and private key.
- Configure certificates before account login, so server configuration discovery and authentication can use mTLS.
- Associate one certificate with each configured TLS endpoint. All accounts using that endpoint share the certificate.
- Keep certificates available after account logout. Remove or replace them through an explicit certificate management action.
- Support HTTPS requests and notification WebSockets.
- Preserve normal server certificate and hostname verification.
- Accept client identities issued by any CA, including self-signed identities; Authentik/the reverse proxy decides whether to accept them.
- Use an empty-password app-private NSS store for the first version, as accepted by the user. Store unlock and desktop secret-service integration are deferred.

The certificate authenticates the desktop client to the TLS terminator, typically the reverse proxy in front of Vaultwarden. The proxy verifies the certificate during the TLS handshake and forwards application requests to Vaultwarden. Vaultwarden does not need to receive or process the client certificate. Vaultwarden account authentication remains a separate step.

Multiple identities for accounts on the same endpoint, hardware tokens, and automatic certificate enrollment are outside the initial scope. Different endpoints may use different certificates; an identity may also be explicitly assigned to several endpoints.

## Existing architecture

- `libs/common/src/services/api.service.ts`: API requests ultimately use browser `fetch`; an XMLHttpRequest path also exists.
- `libs/common/src/platform/server-notifications/internal/signalr-connection.service.ts`: notifications use SignalR with WebSockets.
- `apps/desktop/src/main/window.main.ts`: creates the persistent Electron session `persist:bitwarden` and assigns it to application windows.
- `libs/angular/src/auth/self-hosted-env-config-dialog/`: shared self-hosted server configuration UI.
- `apps/desktop/src/platform/preload.ts`: existing renderer-to-main-process bridge.
- `apps/desktop/resources/com.bitwarden.desktop.devel.yaml`: Flatpak packaging and permissions.
- `apps/desktop/resources/linux-wrapper.sh`: Flatpak launch environment and Zypak integration.

Electron already exposes Linux certificate import and selection APIs. The preferred design keeps Chromium networking and adds certificate management in the main process. An HTTP fetch middleware cannot supply a TLS private key, and an HTTP-only transport replacement would also need to address WebSockets and other resource requests.

The current iOS implementation provides a behavioral reference: import PKCS#12, store the identity in Keychain, identify it by SHA-256 fingerprint, and supply it when challenged. Linux NSS storage requires its own design and does not automatically provide the same protection as iOS Keychain. Desktop certificate ownership will be endpoint based, with explicit removal independent of account logout.

## Required changes

### 1. Establish certificate storage inside Flatpak

First verify which NSS database the packaged Electron opens for both import and TLS selection. Do not assume that the Electron session partition determines the NSS database location.

The target is a database in the application's private, persistent Flatpak storage, with private keys accessible only through the certificate backend. Verify how Electron can be directed to use that database before its certificate backend initializes. If the packaged version cannot use the intended location directly, resolve that integration before building the full UI.

The manifest currently does not expose the host's standard NSS database directories. Do not add access to a shared host certificate database as the default solution. Use the file chooser portal to access the certificate selected by the user, rather than granting general filesystem access.

Required prototype checks:

- Certificate import and selection access the same database.
- The location is writable and survives application and sandbox restarts.
- Another Flatpak application's certificate database is not accessed.
- Chromium's network process can use the identity under Zypak and the existing process isolation configuration.
- Database initialization and file permissions are correct on a fresh install.
- Verify restrictive storage permissions, operation without a keyring, and clean rejection of existing password protected stores without modifying them.

The PKCS#12 password protects the input file. The accepted NSS store has no meaningful unlock-password protection after import; app-private storage and file permissions are the baseline. Disclose that limitation during setup. No mTLS unlock secret is generated or stored, and secret-service availability does not gate this feature.

### 2. Add an endpoint certificate registry

Create a desktop certificate registry that persists non-secret configuration separately from certificate identities.

Suggested records:

| Record            | Fields                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Identity metadata | SHA-256 fingerprint of certificate DER, display label, subject, issuer, expiration, backend reference |
| Endpoint binding  | Normalized hostname and effective port, identity fingerprint                                          |

Normalize endpoint URLs using a URL parser and treat an omitted HTTPS port as 443. Paths do not define TLS certificate ownership. Map `wss` notification destinations to their corresponding TLS hostname and port. Reject insecure schemes for configured mTLS endpoints.

Build bindings from endpoints the user explicitly configures or confirms. Include separate API, identity, notification, and other self-hosted resource endpoints where applicable. Require approval in the product UI before extending certificate use to additional origins discovered through server configuration or redirects. Do not infer permission from domain suffixes or wildcard matching.

Store this registry independently of user state that is cleared on logout. Load bindings before the first server request. Accounts sharing an endpoint automatically use its binding; account switching does not change the identity.

### 3. Implement the main process certificate backend

Add a service responsible for:

- Importing PKCS#12 through a controlled NSS helper. The probe found that Electron direct import can grant server trust to bundled CAs, so arbitrary bundles must not be passed directly to `app.importCertificate`.
- Enumerating identities and obtaining certificate metadata and a SHA-256 fingerprint.
- Validating that an import contains a usable private key and certificate chain, and reporting invalid input, wrong password, expiration, and unsupported input clearly.
- Handling `app`'s `select-client-certificate` event before network requests begin.
- Calling `event.preventDefault()` and selecting only an offered certificate matching the endpoint binding and configured fingerprint.
- Completing the callback without a certificate when no approved identity is available. Avoid falling back to Electron's default selection of the first available certificate.
- Handling concurrent requests without repeated password dialogs, and completing pending callbacks on cancellation or window shutdown.
- Cancelling unexpected token password requests promptly and reporting an unsupported protected store. No store unlock prompt is required for the baseline.
- Removing app-owned identities when no endpoint binding references them.

The selection callback chooses among identities Chromium offers. Constructing a JavaScript certificate object does not supply a private key. Import, enumeration, and fingerprint lookup must be supported by the actual backend.

Electron's documented import callback returns a result code, rather than imported identity metadata, and its documented app API has no corresponding identity enumeration or deletion methods. Evaluate a small NSS integration for these operations, either through the existing native module or packaged NSS tooling. If tooling is used, pass arguments directly, avoid shell interpolation, and never put passwords on the command line or in logs. Do not delete unrelated certificates or shared chain certificates.

### 4. Add a narrow preload and IPC interface

Expose certificate management operations through the existing bridge, for example:

- Select and import a certificate.
- List app-managed certificate metadata and endpoint bindings.
- Bind an identity to an endpoint.
- Replace a binding or remove an identity.
- Respond to the PKCS#12 import password prompt; no token unlock workflow is required.

Use typed IPC payloads and validate the sender and all arguments in the main process. Keep certificate file reading, backend operations, and private keys out of the renderer. Keep passwords transient and out of logs and normal state persistence. Return sanitized errors and non-secret metadata.

The main process should open the file chooser and use the returned file path. Do not expose a general operation that reads arbitrary renderer-supplied paths. Avoid retaining the source PKCS#12 file or creating an unmanaged second copy after import.

### 5. Add certificate configuration UI

Provide desktop Linux certificate controls from the self-hosted server configuration flow, available before login, plus a way to manage bindings after login.

The shared Angular dialog needs a capability abstraction or extension point so the desktop implementation can provide certificate operations. Show controls only where the capability is implemented.

Required user actions and feedback:

- Choose a `.p12` or `.pfx` file and enter its password.
- Review certificate label, fingerprint, expiration, and destination endpoints.
- Assign an imported certificate to an endpoint.
- Replace or remove a certificate and understand which endpoints are affected.
- Recover from invalid files, wrong passwords, expired certificates, and missing identities.

Importing a certificate and saving server settings are separate lifecycle operations. Define what happens when the user imports an identity and then cancels the settings dialog; do not leave unintended bindings or undiscoverable orphan identities.

Add localized strings and keep private key material out of UI state.

### 6. Handle connection reuse and certificate changes

Chromium may cache certificate selections and reuse established TLS connections. Replacing or removing a binding must prevent new requests from continuing with the previous identity.

Verify the effect of closing session connections and reconnecting notifications. Do not assume `clearAuthCache()` clears TLS client certificate selection; its documented purpose is HTTP authentication caching. If available APIs cannot reliably invalidate client certificate state, require an application restart after changes in the initial release and communicate that requirement in the UI.

Normal account logout retains endpoint certificates and bindings. Explicit identity removal must remove dependent bindings, stop use on existing connections, and clean up backend material. If the same identity serves several endpoints, show that impact before removal.

### 7. Verify all relevant network paths

Test server discovery and configuration fetches, pre-login requests, identity/token requests, sync, attachment upload and download, icons where hosted behind the proxy, and notification WebSockets.

The server communication configuration services in `apps/desktop/src/platform/services/server-communication-config/` currently handle SSO cookie acquisition. mTLS must work before fetching server configuration, so certificate bootstrap cannot depend exclusively on configuration returned by the protected server.

External browser SSO flows use the browser's own certificate configuration. A certificate imported into Bitwarden's private store does not configure the browser. Document this when the deployment requires mTLS for browser login flows too.

## Flatpak packaging changes

After the storage prototype, update the Flatpak manifest and wrapper only as needed to initialize/select the private database or package an NSS helper. Confirm whether the Electron BaseApp already supplies required libraries; do not assume NSS management tools are bundled.

Keep build dependencies separate from runtime dependencies. Package the native helper for x86_64. Validate file chooser access and certificate persistence using the built Flatpak, not just an unpackaged Electron development run. If the distributed Flathub manifest is maintained separately, carry necessary packaging changes there as well.

Server trust remains separate from client identity import. With a publicly trusted proxy server certificate, no private server CA import should be necessary. Supporting a private server CA requires a separately defined trust configuration; do not disable TLS verification to make mTLS work.

## Implementation sequence

1. Build a disposable Flatpak prototype against a test reverse proxy requiring client certificates. Verify import, explicit selection, HTTPS, WebSockets, and restart persistence.
2. Resolve NSS database/identity ownership, empty-password store boundaries, controlled import without server trust changes, identity enumeration, fingerprint lookup, and deletion. Replacement requires restart in the initial design.
3. Implement the main process backend and persistent endpoint registry.
4. Add typed preload/IPC operations and certificate configuration UI.
5. Add lifecycle handling, localized errors, and focused automated tests.
6. Validate the packaged Flatpak and document user setup and certificate renewal.

The endpoint registry and Electron integration can be written for Linux generally while Flatpak remains the first validated package. Other packaging formats need separate storage and sandbox verification before claiming support.

## Acceptance criteria

- A fresh Flatpak install can import a password protected PKCS#12 identity before login.
- A proxy configured to require a certificate rejects the client without one and accepts the configured identity.
- Two accounts using the same endpoint share the identity, and it remains configured after either account logs out.
- Login, sync, attachment transfer, and live notification WebSockets work through the proxy.
- Certificate selection works again after application restart and host restart.
- A separate notification endpoint works when explicitly bound.
- Unconfigured endpoints and cross-origin redirects never receive an app-selected identity.
- Invalid files, wrong passwords, expired/missing identities, and server rejection produce useful errors.
- Replacement and removal prevent continued use of the previous identity, with a restart requirement if needed.
- Shared identities remain available when a single endpoint binding is removed.
- Private keys and passwords do not appear in renderer state, ordinary configuration, logs, or command arguments.
- Invalid server certificates are still rejected.

Use unit tests for endpoint normalization, selection policy, shared identity references, and IPC validation. Use integration tests against an mTLS reverse proxy for HTTPS and WebSockets, and a packaged Flatpak smoke test for persistence, portals, and process isolation.

## References

- [Electron app API: certificate import, selection, and password handler](https://www.electronjs.org/docs/latest/api/app)
- [Chromium Linux certificate management and NSS database locations](https://chromium.googlesource.com/chromium/src/+/master/docs/linux/cert_management.md)
- [Flatpak sandbox permissions](https://docs.flatpak.org/en/latest/sandbox-permissions.html)
- [iOS client certificate service](https://github.com/bitwarden/ios/blob/main/BitwardenShared/Core/Platform/Services/ClientCertificateService.swift)
- [iOS certificate HTTP client](https://github.com/bitwarden/ios/blob/main/BitwardenShared/Core/Platform/Services/CertificateHTTPClient.swift)

These references informed the analysis. Runtime behavior, particularly NSS storage and cached certificate selection inside Flatpak, still requires the prototype described above.

## Revised implementation priority

Protected NSS store support is deferred. Passwordless import and TLS operation passed in an isolated x86_64 Flatpak. The remaining backend work is controlled import that preserves server trust, enumeration/deletion, and coexistence with a pre-existing app-private NSS store. Client CA trust validation is not required: Authentik decides acceptance. Validate self-signed clients too. Then finish startup/IPC/UI integration and lifecycle, resource-load, concurrency, and persistence tests on x86_64. See the detailed concept for current contracts and evidence limits.
