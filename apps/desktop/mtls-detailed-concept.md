# Flatpak desktop mTLS: detailed requirements and design

Status: design specification for the implemented Linux x86_64 Flatpak integration. See [mtls-prototype-report.md](mtls-prototype-report.md) for the current implementation, user retest, packaged bundle, and remaining validation gates. Some sections describe design contracts and release gates beyond the verified checkpoint.

## 1. Product behavior

The Linux Flatpak client must connect to a self-hosted server through a reverse proxy requiring TLS client authentication. A certificate belongs to a TLS endpoint and is shared by all accounts on that endpoint. It remains available before login, while the vault is locked, and after logout.

```mermaid
sequenceDiagram
    participant Client as Bitwarden Flatpak
    participant Proxy as TLS reverse proxy
    participant Vault as Vaultwarden
    Client->>Proxy: TLS handshake with configured client identity
    Proxy->>Proxy: Verify client certificate and proof of private key possession
    Proxy-->>Client: Establish TLS connection
    Client->>Proxy: Login, sync, or notification connection
    Proxy->>Vault: Forward application traffic
    Vault-->>Proxy: Application response
    Proxy-->>Client: Response over TLS
```

The proxy performs mTLS verification. Vaultwarden performs its existing account authentication. There is no requirement to forward the client certificate to Vaultwarden or to change its API.

### Requirements

| ID  | Requirement                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------- |
| R01 | Import password protected `.p12` and `.pfx` identities before login.                                                             |
| R02 | Use one identity for each normalized hostname and port; all accounts share it.                                                   |
| R03 | Support browser fetch, XMLHttpRequest, resource loads, and notification WebSockets using the application session.                |
| R04 | Select an identity only for explicitly configured endpoints.                                                                     |
| R05 | Preserve server certificate and hostname validation.                                                                             |
| R06 | Persist the identity and bindings across application and host restarts.                                                          |
| R07 | Restrict private key storage to app-private files; an NSS store password is not required. Never persist the input file password. |
| R08 | Support explicit replacement, unbinding, and removal independently of account logout.                                            |
| R09 | Display actionable local import and selection errors without claiming knowledge of remote TLS failures.                          |
| R10 | Keep private key material out of renderer APIs; keep import passwords transient.                                                 |
| R11 | Existing installations without mTLS configuration continue to start and connect normally.                                        |
| R12 | Validate the packaged Flatpak on x86_64 before claiming support. aarch64 is outside this release scope.                          |

Initial exclusions: hardware tokens, automatic enrollment/renewal, account-specific identities on one endpoint, wildcard bindings, private server CA management, and browser certificate configuration. Unprotected PKCS#12 input may be supported later; it is not required for the initial release. Public CA certificates embedded in the input bundle must not acquire server trust automatically.

## 2. Design decisions

| Topic                 | Baseline                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Networking            | Keep Chromium networking and the shared `persist:bitwarden` session.                          |
| Binding ownership     | Desktop installation, independently of account state and logout.                              |
| Identity identifier   | Lowercase SHA-256 hex of the leaf certificate DER.                                            |
| Registry              | Dedicated main-process-owned JSON file with atomic writes and schema validation.              |
| Private key store     | NSS software database with an empty token password in persistent app-private Flatpak storage. |
| Database secret       | No store unlock secret or secret-service dependency for mTLS in this version.                 |
| NSS management        | Dedicated packaged helper process using NSS, with a narrow pipe protocol.                     |
| Certificate selection | App-level event handler with exact endpoint and fingerprint matching.                         |
| Change activation     | Restart the application after any identity or binding change.                                 |
| Shared UI             | Optional capability service with an unsupported default outside this implementation.          |

The isolated x86_64 probe confirmed the XDG NSS store path and passwordless TLS signing. Store ownership, lifecycle, and real application startup remain gates. Protected-store import/signing did not work in the recorded probe; resolving it is deferred and is not a prerequisite. The preferred current Chromium path is `${XDG_DATA_HOME}/pki/nssdb`, using Flatpak's app-private XDG data location. Chromium's existing `~/.pki/nssdb` compatibility path takes precedence when present. Confirm the behavior of the exact Chromium shipped by this checkout's Electron version. Do not implement an assumed `NSS_SHARED_DB_PATH` override or change `HOME` to force a path.

If a host override or legacy database prevents exclusive app ownership, show `store-location-unsupported` and disable mTLS management until a supported private location is established. Preserve ordinary app startup. Never initialize, change the password of, or delete an existing database with unknown ownership.

Use a helper process to contain NSS initialization and cleanup separately from Electron's NSS globals. This is a proposed architecture, subject to library availability and concurrency tests; it avoids making the TypeScript layer responsible for private key parsing. Electron remains responsible for TLS signing with identities in that same store.

## 3. Endpoints and identity selection

### Normalization

Accept an absolute `https:` URL or `wss:` URL. Reject userinfo, an empty hostname, malformed URLs, and other schemes. Use the WHATWG URL parser for lowercase and IDNA hostname normalization. Remove one terminal DNS dot to establish a consistent canonical DNS name. Preserve IPv6 URL brackets in the endpoint key. Use the parser's port or `443`; validate ports in the range 1–65535. Ignore path, query, and fragment for matching; do not store them in bindings.

Define `EndpointKey` as `${canonicalHostname}:${effectivePort}`. Scheme does not distinguish `https` and `wss` on the same TLS endpoint. IP and DNS names remain distinct; do not resolve names to create equivalence.

| Input                                   | Key/result           |
| --------------------------------------- | -------------------- |
| `https://VAULT.example/api`             | `vault.example:443`  |
| `wss://vault.example/notifications/hub` | `vault.example:443`  |
| `https://vault.example:8443/`           | `vault.example:8443` |
| `https://vault.example./`               | `vault.example:443`  |
| `https://[::1]:8443/`                   | `[::1]:8443`         |
| `https://user:password@vault.example/`  | Reject               |
| `http://vault.example/`                 | Reject               |

### Selection algorithm

1. Always prevent default certificate selection for challenges controlled by the application. Install the app handler before creating renderer windows.

   Loading mTLS configuration performs asynchronous I/O and can finish after Electron has emitted `ready`. Window/session initialization must use `app.whenReady()` rather than registering a late `app.on("ready")` listener. Initialize the managed session, reconcile cleanup, create the window, and resolve initialization so menu, messaging, and tray setup can proceed. Propagate initialization failures through that promise. Verify startup with Electron already ready, not only with an event emitted after listener registration.

2. Verify that the request belongs to the managed application session using the main window's native `WebContents.id`, its attached session, and the local bundle URL. Avoid using JavaScript wrapper identity or a separately retained session field as the renderer's authority. Reject unrelated, destroyed, or remote web contents. Main-process requests have no web contents; permit only explicitly routed requests using the managed session, or decline until provenance is established. Log which ownership condition failed without including full renderer URLs, certificate contents, or secrets.
3. Normalize the challenge destination. Electron 43 on Linux supplies an authority such as `vault.example:443` or `[::1]:8443`; support that explicit host/port form as well as HTTPS/WSS URLs. Parse authority challenges separately from user-entered endpoint URLs, rejecting credentials, paths, malformed ports, and insecure schemes. For an absent binding, return the callback without a certificate.
4. Read the binding from the immutable registry snapshot for this process run.
5. Compute SHA-256 from each offered certificate's PEM/DER using Node's `X509Certificate` or equivalent verified parsing. Do not assume Electron's `fingerprint` field is SHA-256.
6. Select only an offered certificate with the configured fingerprint, within its validity period. Do not substitute another identity signed by the same CA.
7. Complete the callback exactly once; catch errors and decline. Publish sanitized endpoint status for the UI.

Return `identity-not-offered` if Chromium does not offer the configured identity. Possible causes include a missing private key or mismatch with the proxy's accepted issuers; the app cannot determine the cause from the callback alone. Expired/not-yet-valid local identities produce explicit local errors. Remote revocation and authorization decisions belong to the proxy.

A connection may reuse an already selected identity, so this callback is not a per-request authorization hook. Bindings never change in the running process. Unknown redirect destinations remain unbound; a redirect to an already bound endpoint uses that endpoint's own binding. Cross-origin redirects do not inherit source permissions.

## 4. Persistence and types

Proposed shared types in `apps/desktop/src/platform/models/mtls.ts`:

```ts
type Fingerprint = string; // Validate exactly 64 lowercase hex characters.
type EndpointKey = string; // Produce only through normalizeEndpoint().

interface IdentityMetadata {
  fingerprint: Fingerprint;
  label: string;
  subject: string;
  issuer: string;
  notBefore: string; // ISO UTC
  notAfter: string; // ISO UTC
  importedAt: string;
}

interface MtlsConfiguration {
  version: 1;
  revision: number;
  storeId: string; // Random identifier tying registry and app-managed identity ownership.
  identities: Record<Fingerprint, IdentityMetadata>;
  bindings: Record<EndpointKey, Fingerprint>;
  cleanup: Fingerprint[]; // App-owned identities scheduled for deletion.
}

type MtlsErrorCode =
  | "unsupported"
  | "cancelled"
  | "invalid-endpoint"
  | "invalid-file"
  | "invalid-password"
  | "unsupported-bundle"
  | "certificate-expired"
  | "certificate-not-yet-valid"
  | "identity-missing"
  | "identity-not-offered"
  | "store-password-unsupported"
  | "store-location-unsupported"
  | "store-corrupt"
  | "storage-failed"
  | "backend-failed"
  | "conflict";

type MtlsResult<T> = { ok: true; value: T } | { ok: false; error: { code: MtlsErrorCode } };
```

Store the registry at `path.join(app.getPath("userData"), "mtls", "registry.json")`. Do not put it in generic `storageService` state: that service exposes save/remove operations to renderers. Validate data read from disk and every IPC payload; TypeScript types are not runtime validation.

Create directories with mode `0700` and files with `0600`. Write a temporary file in the same directory, flush it, atomically rename it, and flush the directory before acknowledging durable success. Never treat the existing debounced storage service's save promise as proof of durability. Serialize mutations and enforce optimistic revision checks.

Keep an in-memory `activeConfiguration` loaded once at startup and a durable `nextConfiguration`. Mutation responses return `restartRequired: true`; selection uses only `activeConfiguration`. Do not let renderer state replace either object.

Never automatically erase a corrupt registry. Disable mTLS selection and show a recoverable status with options to restore configuration or reimport. Unknown future schema versions behave similarly. A missing file means an empty configuration.

## 5. NSS backend and storage protection

Package a small Linux helper at a fixed app-controlled path. Invoke it directly with `shell: false`. Use a bounded length-prefixed pipe protocol for operations and binary input. Keep PKCS#12 import passwords out of arguments, environment variables, temporary files, and helper output. The token uses an empty password and needs no stored unlock secret. Define a protocol version, request ID, limits, and sanitized response codes.

Proposed internal operations: `initialize`, `inspectBundle`, `importIdentity`, `listOwnedIdentities`, `deleteIdentity`, and `verifyStore`. Database path comes only from startup configuration. File selection paths and raw certificate bytes never come from renderer-supplied strings. The helper must not provide private key export.

For import/deletion, initialize NSS with `NSS_InitReadWrite` (or an equivalent writable `NSS_Initialize`/context configuration). `NSS_Init` opens the databases read-only and caused the recorded `SEC_ERROR_PKCS12_UNABLE_TO_IMPORT_KEY` failure. The corrected probe imports the key and preserves CA trust in disposable host tests; see the prototype report. Keep a regression case that distinguishes read-only enumeration from writable mutation. Neither CA target-token placement nor successful key import alone proves browser server-trust isolation.

Import policy:

- Limit input to 10 MiB and require a regular file. Parse contents; filename extensions are only chooser filters.
- Accept exactly one usable leaf identity with its private key. Reject multiple identities instead of guessing.
- Reject expired or not-yet-valid leaves. Require compatibility with TLS client authentication, allowing absent extended key usage where appropriate; reject explicit incompatible usage.
- Accept self-signed identities and identities issued by any CA. Do not build or validate a client trust chain, check client issuer trust, or perform client revocation lookups locally; Authentik or the configured TLS terminator decides acceptance. Chromium may filter offered identities according to the server challenge; report a missing match without guessing another identity.
- Preserve bundled chain certificates as untrusted chain material where needed. Do not set trusted CA flags from a client bundle. This is about keeping server trust unchanged, not validating the client CA.
- Label app-owned identities with a stable internal nickname derived from their fingerprint; display labels are separate metadata.
- Importing an already owned fingerprint returns the existing identity and does not create another key.
- Deleting an identity must delete its owned key too, only when no remaining app-owned certificate needs that key. Retain shared chain certificates or perform conservative app-owned reference cleanup.

Initialize a newly created app-private NSS software token with an empty password. This relaxation is explicitly accepted for the first version. No mTLS database password is generated, persisted, or requested. GNOME Keyring/KWallet availability must not block import or use. Protected-store support can be investigated separately later.

The key has no meaningful protection from a secret store unlock password. Treat the NSS database as sensitive key material: enforce `0700` directories and `0600` database files, avoid symlinks and host/shared database access, and preserve the sandbox boundary. These measures do not prevent the same host user, root, or another process granted access to the files from using/extracting keys. Vault lock/logout does not encrypt or remove the identity. The UI/setup documentation should disclose this once during import, without describing the store as password encrypted or hardware protected. Full disk encryption is an independent host protection.

Do not remove an existing store password or reset an existing database automatically. If the selected store is password protected, return `store-password-unsupported`; explain that this version needs a supported app-private store. Any deliberate reset requires a separate recovery workflow and explicit confirmation of data loss. An existing app-private NSS database may predate this feature; coexist without treating all its identities or trust entries as feature-owned. Track and delete only identities that this feature imports and records. If database provenance/path safety cannot be established, reject management rather than changing another store.

Do not install a password-returning retry loop. An unexpected token password request must be cancelled using the verified Electron cancellation behavior (its NSS delegate treats an empty string as cancellation), report unsupported store status, and keep the app usable. Test this behavior with the actual runtime. Never terminate the production application as the disposable probe does on retry.

The already implemented mTLS secret namespace reservation may stay as defense for future use; the accepted baseline does not require a secret entry or generic credential IPC changes to function. The old `secret-store-unavailable` and `secret-store-locked` DTO values may temporarily remain unused for compatibility, but must not be surfaced as mTLS runtime prerequisites.

Prompted import passwords necessarily pass briefly through the trusted UI and IPC; clear the input on completion/cancellation and minimize retained references. JavaScript strings cannot guarantee memory zeroization. Private keys never cross the preload interface. NSS/helper buffers should use the strongest practical cleanup available.

### Controlled import without client CA validation

The recorded probe found that `app.importCertificate()` imported a bundled CA with `CT,c,c` trust and then accepted a server signed by it. Do not pass arbitrary user bundles directly to that API in production.

The preferred helper imports the client identity/private key and chain explicitly, assigning no additional server trust. If Electron import is retained as an implementation option, first sanitize the PKCS#12 to contain only the selected identity and required untrusted chain material, and prove the resulting trust behavior; stripping only the root does not establish that intermediates are safe. Check the before/after trust flags of every affected certificate, preserving pre-existing server trust exactly. Never clear a previously trusted CA merely because it appears in a client bundle. A self-signed client leaf also must not become a trusted server certificate.

Backend/helper validation checks format, password, private key match, number of identities, validity dates, and applicable key usage. It does not require a trusted issuer or a complete client chain. This distinction must appear in tests and errors. Remote acceptance remains the proxy's decision.

## 6. Management API and UI

Expose `ipc.platform.mtls` through `apps/desktop/src/platform/preload.ts`. Define named channels rather than accepting arbitrary commands:

```ts
interface MtlsManagementApi {
  status(): Promise<MtlsResult<MtlsStatus>>;
  list(): Promise<MtlsResult<MtlsView>>;
  chooseFile(): Promise<MtlsResult<{ selectionId: string; fileName: string }>>;
  inspect(
    selectionId: string,
    password: string,
  ): Promise<MtlsResult<{ draftId: string; identity: IdentityMetadata }>>;
  commit(request: {
    draftId: string;
    expectedRevision: number;
    endpointUrls: string[];
    replaceExisting: boolean;
  }): Promise<MtlsResult<{ revision: number; restartRequired: true }>>;
  bind(request: {
    fingerprint: Fingerprint;
    endpointUrls: string[];
    expectedRevision: number;
    replaceExisting: boolean;
  }): Promise<MtlsResult<{ revision: number; restartRequired: true }>>;
  unbind(
    endpointUrl: string,
    expectedRevision: number,
  ): Promise<MtlsResult<{ revision: number; restartRequired: true }>>;
  remove(
    fingerprint: Fingerprint,
    expectedRevision: number,
  ): Promise<MtlsResult<{ revision: number; restartRequired: true }>>;
  cancelDraft(draftId: string): Promise<MtlsResult<void>>;
  restart(): Promise<MtlsResult<void>>;
}
```

`MtlsStatus` distinguishes unsupported, ready, unavailable, and restart pending. `MtlsView` returns non-secret identity details, endpoint bindings, current revision, and pending-change status. Do not expose database paths or backend IDs when the user does not need them.

Selection and draft IDs are random opaque capabilities tied to the originating web contents. Expire them after five minutes or when that window closes. Hold input bytes/passwords only in main/helper memory during the draft; do not persist them. Allow one draft per window and serialize backend operations. Invalid passwords leave the file selection available for retry; expiry requires selecting again.

Validate the sender against an owned application window and its expected local application origin/frame. Reject child frames, unrelated web contents, and forwarded browser/native-messaging requests. Bound payload sizes: passwords at most 4096 UTF-8 bytes, labels at most 128 characters, and at most 32 endpoint URLs per mutation. Never log payloads.

Add `ClientCertificateSettingsService` in the shared Angular auth area, with a default unsupported implementation and a desktop adapter registered in `apps/desktop/src/app/services/services.module.ts`. This keeps imports from desktop out of shared libraries. The self-hosted dialog opens a dedicated certificate manager; shared platforms without the capability omit that action.

The certificate manager is a separate committed workflow. It lists existing identities and endpoint bindings, offers import/reuse/replace/remove, and shows the restart banner. Closing the outer server URL dialog does not undo completed certificate management; state this visibly when opening the manager. Closing the manager before commit discards its draft.

Suggest endpoints from the entered self-hosted URLs, deduplicate them, and show the exact hostname and port list for confirmation. The base URL alone creates one binding. Additional server-advertised endpoints are suggestions requiring confirmation. Display affected endpoints when replacing a conflicting binding or removing an identity. Never silently replace another identity.

After a successful change, show “Certificate settings saved. Restart Bitwarden to apply them.” Offer Restart now and Later. Show both current and pending identity where they differ. While pending, existing requests continue with the current configuration; no connection test may claim to test pending settings.

For first-time setup, persist the server URL draft through the existing environment settings workflow before restarting, without requiring a successful server discovery request. If that workflow currently couples saving to a protected network request, add a save-only path and defer discovery until startup. On choosing Later, show that login to the newly configured endpoint may remain unavailable until restart. Ensure a successful restart restores the entered server URLs along with the certificate binding.

In the outer self-hosted server dialog, a pending certificate change replaces the primary Save action with “Save and restart”. Save the current URL fields before requesting restart and keep the dialog open if restart fails. Read pending status when reopening the dialog, so closing and reopening it cannot offer an ordinary Save for an inactive binding. A restart is required by this implementation's startup snapshot; removing that requirement needs verified NSS discovery of newly imported keys, selection-state replacement, and connection/cache invalidation in a running Electron session.

Set the main-process quitting flag synchronously in Electron's `before-quit` handler, before awaiting any biometric cleanup. Window close handlers must recheck that flag after asynchronous settings reads. Tray tooltips must have a valid string even before tray initialization. These requirements prevent certificate-triggered restart from entering the background/tray path during shutdown.

Bound backend operations to 30 seconds and file/password dialogs to the five-minute draft lifetime. Treat a timed-out mutation as uncertain: reconcile durable registry and backend state before retrying, rather than issuing a duplicate import. Cancellation must not terminate an atomic registry write halfway through; complete or reconcile it and report the resulting revision.

## 7. Transactions and lifecycle

| Action                      | Durable effect                                           | Effect during current run                |
| --------------------------- | -------------------------------------------------------- | ---------------------------------------- |
| Inspect import              | None; creates memory draft                               | No TLS change                            |
| Cancel draft                | None; releases memory                                    | No TLS change                            |
| Commit new identity/binding | Import identity, persist next configuration              | Restart pending                          |
| Replace binding             | Persist new identity reference                           | Old binding remains active until restart |
| Unbind endpoint             | Remove next binding                                      | Old binding remains active until restart |
| Remove identity             | Remove all next bindings, enqueue owned identity cleanup | Old identity retained until restart      |
| Logout or lock vault        | None                                                     | Same certificate available               |
| Restart                     | Reconcile cleanup; activate persisted bindings           | New TLS sessions use new configuration   |

Import order: validate draft and revision; verify the passwordless owned store; import/deduplicate; verify fingerprint and private key availability; atomically persist metadata/bindings; return success. If persistence fails, roll back only an identity newly imported by that transaction and not referenced by either active or durable configuration. If rollback fails, record/reconcile app-owned orphan metadata on startup; never bind it automatically.

Removal order: durably remove bindings and enqueue cleanup, then require restart. The UI must explicitly say that the certificate can remain in use until the restart. If the user needs immediate removal, Restart now completes the operation. Do not claim Later revokes an established connection or erases the key immediately.

At startup, before opening windows or network traffic, load the registry, verify store ownership, and process queued deletion for identities unreferenced by the next configuration. Failed cleanup remains queued and visible, but the removed binding stays inactive. An unbound identity can remain in the manager for explicit reuse; unbinding is not deletion.

Handle crashes between each import/removal step through reconciliation using owned fingerprints and the registry. Never delete an identity active in another live app process. Reuse the application's single-instance ownership and add an exclusive management lock for helper mutations. Reject a second helper/store writer. Do not copy live SQLite database files as an update mechanism.

Startup and mTLS usage do not require a desktop keyring. Detect a protected token as unsupported and cancel unlock attempts promptly. An error in mTLS initialization must not prevent access to the offline vault or unrelated accounts.

## 8. Concrete integration map

| File/location                                                           | Proposed change                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/desktop/src/platform/models/mtls.ts`                              | Types, API DTOs, error codes.                                                               |
| `apps/desktop/src/platform/main/mtls/endpoint.ts`                       | Pure URL normalization and tests.                                                           |
| `apps/desktop/src/platform/main/mtls/mtls-registry.ts`                  | Atomic file persistence, revisions, active/next snapshots.                                  |
| `apps/desktop/src/platform/main/mtls/mtls-backend.ts`                   | Helper client and protocol validation.                                                      |
| `apps/desktop/src/platform/main/mtls/mtls-main.ts`                      | Startup, selection handler, management IPC, transactions.                                   |
| `apps/desktop/src/platform/main/desktop-credential-storage-listener.ts` | Existing reserved mTLS namespace can remain; no unlock-secret dependency.                   |
| `apps/desktop/src/main.ts`                                              | Construct/init mTLS before `windowMain.init()`; dispose callbacks and drafts on quit.       |
| `apps/desktop/src/main/window.main.ts`                                  | Supply managed session/window ownership and ensure handlers precede renderer requests.      |
| `apps/desktop/src/platform/preload.ts`                                  | Typed `mtls` bridge and event subscription cleanup if status notifications are used.        |
| Shared Angular auth library                                             | Capability service, unsupported default, manager component, self-hosted dialog entry point. |
| `apps/desktop/src/app/services/services.module.ts`                      | Desktop capability adapter provider.                                                        |
| Desktop account/settings UI                                             | Entry to the same manager after login.                                                      |
| `apps/desktop/desktop_native/mtls_helper/`                              | C helper executable using NSS, with lifecycle and protocol tests.                           |
| Native workspace/build scripts                                          | Build/package helper for Linux architectures; omit unsupported platforms.                   |
| `apps/desktop/resources/com.bitwarden.desktop.devel.yaml`               | Package helper/NSS runtime dependencies when needed; preserve restricted file access.       |
| `apps/desktop/resources/linux-wrapper.sh`                               | Only verified initialization/environment changes; no speculative NSS override.              |
| Localization assets                                                     | Import, endpoint review, errors, expiration, shared ownership, restart messages.            |
| `scripts/mtls-test-proxy/`                                              | Isolated test proxy and fixture generation; proposed new test harness.                      |

Do not add account-owned fingerprint fields to shared `EnvironmentUrls` for this design. The registry is authoritative across all accounts. Keep initial capability enabled only for Linux Flatpak until another package is validated.

## 9. Prototype gates

Use G1/G2/G3 evidence to begin the backend work. Complete G4/G5/G6/G7 while implementing the helper and integration, before enabling the feature for release. The prototype report is a living record, not a prerequisite that must prove unimplemented lifecycle code. Record exact Electron/Chromium versions, runtime architecture, Flatpak runtime, commands, observations, and selected database path in this document or a linked prototype report.

| Gate                  | Experiment                                                                                | Pass condition                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| G1 Store location     | Fresh sandbox, inspect XDG paths, import a disposable identity                            | Helper, import, and TLS all use one persistent app-private store.                                |
| G2 Storage boundary   | Use empty-password app-private token; inspect permissions; test protected-store detection | TLS works without keyring; permissions are restrictive; existing protected store is never reset. |
| G3 Selection coverage | HTTPS fetch, XHR, image request, `wss` against mTLS proxy                                 | Correct endpoint and offered identity reach the handler on every required path.                  |
| G4 Trust isolation    | Import bundle containing a test CA, connect to a server signed only by it                 | Client import does not make that CA trusted for server verification.                             |
| G5 Lifecycle          | Import, restart, replace, restart, remove, restart                                        | New identity is used after restart; removed identity and owned key are gone.                     |
| G6 Runtime            | Run with normal Zypak/process isolation on x86_64                                         | Portals, helper, and TLS work without a keyring dependency in the packaged app.                  |
| G7 Concurrency        | Parallel HTTPS and WebSocket requests, helper mutation, forced termination                | No DB corruption, accidental selection, or callbacks left pending.                               |

Use a trusted test server certificate. A separate disposable test CA may be provisioned into the test sandbox as explicit test setup; never implement `--ignore-certificate-errors` as the feature's solution. The existing reverse-proxy emulator targets cookie authentication and is not sufficient evidence for mTLS.

If a gate fails, document the failure and revise the backend design. Do not replace the architecture with Node HTTP only, broaden sandbox permissions, or use plaintext key files without reviewing the resulting requirements. Backend uncertainty is confined to these gates; normalization, UI contracts, registry semantics, and tests can proceed independently using a fake backend.

## 10. Verification specification

Generate disposable client CA, valid client A/B, expired client, future-dated client, wrong-issuer client, corrupt bundle, bundle without a private key, and multiple-identity bundle. Include a chain with an intermediate. Do not commit production secrets or personal certificates.

The test proxy must require and verify client certificates for every route, including `/api/config` and WebSocket upgrades, and expose only the observed public certificate fingerprint to the test driver. Use distinct TLS endpoints with separate certificates; the backend may be an echo service for transport tests and Vaultwarden for end-to-end flows. Proxy logs, rather than Vaultwarden logs, establish which certificate authenticated the connection.

| Test                                             | Expected evidence                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| No identity                                      | Proxy rejects handshake; no config bypass.                                                   |
| Correct A on endpoint 1                          | HTTPS/XHR/WSS accepted; proxy sees A.                                                        |
| Account 1 and 2 on endpoint 1                    | Proxy sees A for both and after either logs out.                                             |
| Endpoint 2 unbound                               | No automatic selection, even with same issuer.                                               |
| Endpoint 2 bound to B                            | Proxy sees B, including redirect destinations.                                               |
| Self-signed client accepted by proxy             | Import and selection work; no local issuer-trust rejection or server-trust promotion.        |
| Duplicate import A                               | One owned identity/key and multiple explicit bindings allowed.                               |
| Wrong password/corrupt input/multiple identities | Specific sanitized error; durable configuration unchanged.                                   |
| Expired/future client                            | Import refused; existing identity becoming invalid is not selected.                          |
| Server wrong hostname/untrusted chain            | Connection rejected despite valid client identity.                                           |
| Replace A with B, choose Later                   | UI reports pending state; current process may still use A.                                   |
| Replace and restart                              | Every new connection uses B; no old selection reused.                                        |
| Remove and restart                               | Binding absent, key deleted when unreferenced, handshake fails.                              |
| Cancel import/draft expiry                       | No binding; no untracked imported key.                                                       |
| Secret service locked/unavailable                | Passwordless mTLS still works; no new secret service entry or unlock prompt.                 |
| Disk full/crash at transaction boundary          | Previous or new valid registry survives; no half-written config or automatic orphan binding. |
| Malicious IPC or generic secret retrieval        | Rejected sender/payload; no private-key export or arbitrary-file operation.                  |
| Flatpak restart/reboot                           | Private store and bindings persist; certificate source file need not remain.                 |

Unit tests must exercise endpoint normalization, DER SHA-256 matching, validity boundaries, exactly-once callbacks, revision conflicts, durable-write failures, reference-aware deletion, reserved secret namespace, and draft ownership/expiration. Avoid tests that merely duplicate private implementation steps; assert observable contracts.

Suggested commands once the named files exist, from repository root:

```sh
npm test -- --runInBand --testPathPatterns=mtls
npm exec prettier -- --check apps/desktop/mtls-detailed-concept.md apps/desktop/mtls-implementation-plan.md
npm exec eslint -- apps/desktop/src/platform/main/mtls apps/desktop/src/platform/models/mtls.ts
```

Expand focused tests to the changed Angular components and credential listener, and use existing desktop build/native checks for changed targets. `npm run flatpak:dev --workspace @bitwarden/desktop` is the existing development packaging entry point; run it only in a disposable test setup because it installs/runs the development package. Record exact final smoke-test commands after implementing the harness.

## 11. Current evidence and missing work

Read [mtls-prototype-report.md](mtls-prototype-report.md) as historical observations, with this concept defining the revised requirements.

- Implemented foundations: endpoint normalization, offered-certificate selection, atomic registry, and tests. They are not wired into app startup.
- Verified by the report: isolated x86_64 Flatpak import and fetch/XHR/WebSocket authentication using the app-private XDG NSS store with an empty password.
- Deferred: protected-store signing and unlocking. The reported `-702` is generic PKCS#12 import failure, not proof of a wrong password or absence of support in every Electron version.
- Optional diagnostic if protected support is revisited: the probe returns the password file's raw UTF-8 contents. NSS command-line password files can consume a line terminator differently. Identical file digests do not establish identical effective password strings. Test a known ASCII secret with no terminal newline, never log it, and record NSS errors before attributing retry behavior to Electron. This is a hypothesis, not a demonstrated root cause, and must not block the accepted passwordless version.
- Still required: controlled import without server trust promotion, identity enumeration/key deletion, app-owned identity tracking in pre-existing private databases, image/resource loads, restart/reboot persistence, concurrency/crash behavior, and real application integration/UI.

- The subsequent direct decoder import blocker is resolved: switching `NSS_Init` to `NSS_InitReadWrite` made host import succeed. Fresh CA trust remained `,,`, and existing `C,,` trust was preserved. The next backend gate is repeating controlled import and browser trust-isolation tests inside Flatpak, rather than another host private-key import investigation.
- Extend fixture generation to include a self-signed client and a chain bundle. Configure the disposable proxy/Authentik test policy to accept each explicitly and prove the client does not reject its issuer. A publicly trusted proxy server certificate avoids confusing this with server trust setup.

The user acceptance of an empty store password removes the old G2 blocker. It does not mark the revised storage-boundary or safe-import tests passed automatically. Implement P3/P4 against the new baseline instead of continuing the protected-token investigation as a prerequisite.

## 12. Work packages and handoff

| Package | Deliverable                                                                  | Depends on    |
| ------- | ---------------------------------------------------------------------------- | ------------- |
| P0      | Prototype report with G1–G7 observations and resolved backend/path decisions | None          |
| P1      | DTOs, normalizer, pure selection policy with fake backend tests              | Specification |
| P2      | Durable registry, revisions, active/next state, reconciliation tests         | P1            |
| P3      | Passwordless NSS helper, safe import, ownership and deletion                 | P0            |
| P4      | Main controller, IPC and sender validation, startup integration              | P1–P3         |
| P5      | Capability abstraction, manager UI, localization, shared account behavior    | P1, P4        |
| P6      | Packaged transport tests and Vaultwarden flow validation                     | P0–P5         |

A simpler model can implement P1 and P2 against these contracts, and P5 once IPC is stable. P3 can proceed from the existing x86_64 passwordless P0 evidence; finish controlled-import and ownership tests within P3. P4 needs those backend contracts and tests. Lifecycle and packaging gates finish in P4/P6 rather than blocking all implementation upfront. Finishing the specification does not constitute passing P0.

Completion means R01–R12 have evidence, G1–G7 pass, and the acceptance tests run against the packaged Flatpak. Remaining support limitations must be reflected in the UI/setup documentation rather than hidden behind successful unit tests.

## 13. Sources and evidence limits

- [Electron app APIs](https://www.electronjs.org/docs/latest/api/app): Linux PKCS#12 import, certificate selection callback, and token password handler.
- [Electron Certificate structure](https://www.electronjs.org/docs/latest/api/structures/certificate): offered certificate metadata; use certificate data to compute the chosen digest.
- [Chromium NSS initialization source](https://github.com/chromium/chromium/blob/main/crypto/nss_util.cc): current upstream prefers an existing home NSS directory, otherwise the XDG data location. Verify the bundled revision.
- [Chromium Linux certificate management](https://chromium.googlesource.com/chromium/src/+/master/docs/linux/cert_management.md): NSS database and PKCS#12 client identity support.
- [Flatpak sandbox permissions](https://docs.flatpak.org/en/latest/sandbox-permissions.html): app-private storage and filesystem permissions.
- [Chromium error codes](https://github.com/chromium/chromium/blob/main/net/base/net_error_list.h): `-702` is a generic PKCS#12 import failure.
- [Electron NSS password delegate](https://github.com/electron/electron/blob/main/shell/browser/electron_crypto_module_delegate_nss.cc): cancellation and password callback behavior; verify the bundled version.
- [iOS certificate service](https://github.com/bitwarden/ios/blob/main/BitwardenShared/Core/Platform/Services/ClientCertificateService.swift): identity import, fingerprinting, and lifecycle reference.

Passwordless fetch/XHR/WebSocket operation in an isolated x86_64 Flatpak is recorded in the prototype report. Controlled import, helper operations, ownership checks, process provenance, and full application lifecycle remain to be verified. The design does not claim current Electron import alone provides the full management or security lifecycle.
