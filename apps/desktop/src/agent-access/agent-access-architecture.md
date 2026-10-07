# Agent Access — Local Transport & Attestation Architecture

**Status:** implementation contract for Phase 1 of [agent-access-desktop-plan.md](./agent-access-desktop-plan.md).
Workstream owners implement against this document; deviations require updating it first.

## Decisions taken (from plan §7 open decisions)

1. **Local integration shape:** ~~CLI subprocess for v1~~ **MCP server** (`aac mcp`). See "MCP
   integration (M1/M2)" below — this supersedes the CLI-as-primary-interface decision. The CLI
   (`aac run`/`aac get`) remains a scripting escape hatch, not the story we tell. Attestation is
   unchanged: the MCP server is spawned by the agent (Claude Code/Cursor), so the parent-chain walk
   still identifies the real agent, and it does so from a stable long-lived process rather than a
   throwaway subprocess.
2. **Remote path:** survives v1 unchanged, explicitly labeled as requiring a present human.
   Hardening (W6) is a later phase.
3. **Raw-value release: cut.** Locally, `aac` never prints credential values. `aac get` returns a
   reference; `aac run` injects into a child process and scrubs its output.
4. **Relay ownership:** unchanged pre-merge blocker; out of scope here.
5. **Linux attestation:** path-only, shipped with explicit dialog copy stating the weaker
   guarantee.

## Component overview

```
aac (CLI, spawned by agent)                Bitwarden Desktop (main process)
┌──────────────────────────┐              ┌────────────────────────────────────┐
│ aac run -- <cmd>         │   UDS /      │ local_listener.rs (agent_access)   │
│ aac get --domain X       ├─ named pipe ─▶ peer PID at accept                 │
│  · JSON-line protocol    │              │ attestation.rs: pid→exe→signature, │
│  · env inject + scrub    │              │   parent-chain walk                │
└──────────────────────────┘              │        │                           │
                                          │        ▼                           │
        relay (unchanged) ────────────────▶ CredentialRequestHandler (client.rs│
                                          │   dispatch — single convergence)   │
                                          │        │ napi callback             │
                                          └────────┼───────────────────────────┘
                                                   ▼
                                          renderer: DesktopAgentAccessService
                                          grant check → first-use dialog →
                                          approval dialog (picker) → payload
```

**Single enforcement point:** every request — relay or local — becomes a `CredentialRequestData`
dispatched through the same `CredentialRequestHandler` under the same 60 s deny-by-default
timeout. Authorization (grant lookup, first-use prompt, per-request approval) happens exactly once,
in the renderer credential pipeline. The Rust local path additionally enforces _value stripping_
for reference-mode replies (defense in depth; never a second authorization decision).

## Local wire protocol v1

Transport: Unix domain socket / Windows named pipe. One connection per request; client sends one
JSON line (`\n`-terminated, UTF-8), server replies with one JSON line and closes. Server-side
approval can take up to 60 s; clients must use a read timeout ≥ 120 s. Max line length 64 KiB.

**Socket path (fixed, userData-independent — both sides hardcode the same defaults):**

- macOS/Linux: `~/.bitwarden-agent-access.sock` (mode 0600; stale file unlinked on bind)
- Windows: `\\.\pipe\bitwarden.agent-access.<sanitized-username>` (DACL: current user only)
- Override on both sides: `AAC_SOCKET` env var (aac) / config value (desktop), for tests.

**Request:**

```json
{
  "version": 1,
  "op": "credentialRequest",
  "query": { "type": "domain", "value": "github.com" },
  "delivery": "inject",
  "client": { "name": "aac", "version": "0.1.0" }
}
```

- `query.type`: `"domain" | "id" | "search"` (matches existing `CredentialQueryType`).
- `delivery`: `"inject"` (values returned to aac for exec-injection, never printed) or
  `"reference"` (no secret values in the reply, ever).

**Response (approved, inject):**

```json
{
  "version": 1,
  "status": "approved",
  "credential": {
    "username": "u",
    "password": "p",
    "totp": "123456",
    "uri": "https://github.com",
    "credentialId": "<uuid>"
  },
  "reference": "bw://item/<uuid>"
}
```

**Response (approved, reference):** same but `credential` omitted; includes
`"item":{"name":"GitHub","username":"u"}`.

**Response (everything else):**

```json
{ "version": 1, "status": "denied", "message": "Denied by user" }
```

`status`: `"approved" | "denied" | "notFound" | "locked" | "timeout" | "rateLimited" | "error"`.
`message` is free-form, human-readable, never contains vault data. Malformed requests get
`status:"error"` and the connection closed. Unknown JSON fields are ignored on both sides
(forward compatibility); `version` > 1 → `error`.

A **reference** is `bw://item/<credentialId>` — an opaque item pointer, not a capability. Redeeming
it (`aac run --ref …`) is a fresh `id`-query request with its own approval. No grant-handle store
exists in v1.

`notes` is never included in any local reply (plan W4; per-field opt-in arrives with scoped grants).

## Attestation model (W2a)

Captured at accept time by the listener (peer PID), resolved before dispatch:

```
LocalPeerInfo {
  pid, processName, exePath,              // immediate peer = aac
  parent?: { pid, processName, exePath }, // best-effort one-level walk; absent if reparented/exited
  signature?: {                            // of the ATTESTED process: parent if resolved, else peer
    kind: "macosTeamId" | "windowsPublisher" | "linuxPathOnly",
    identity,                              // e.g. "TEAMID123:com.anysphere.cursor" | publisher CN | canonical path
    valid: bool
  }
}
```

- macOS: `SecCodeCopyGuestWithAttributes(pid)` → `SecCodeCheckValidity` →
  `SecCodeCopySigningInformation` (team ID + signing identifier).
- Windows: Authenticode on the resolved exe path (`verifysign`, as in
  `chromium_importer/src/chromium/platform/windows/signature.rs`).
- Linux: canonical `/proc/<pid>/exe` path only. `signature.kind = "linuxPathOnly"`.
- Peer-info gathering is vendored into the `agent_access` crate (third copy, deliberate — see
  ssh_agent exploration: both existing copies are private, `desktop_core` is deprecated and heavy).
  The vendored copy **retains the full executable path** and drops the buggy `uid` field.

Attestation is defense-in-depth, not a boundary. Dialog copy states only what was verified
("signed by X" / "at path Y"), never "this is safe."

## Grant store (W2b)

Main-process-only, alongside existing keychain keys (`identity`, `connections`, `psks`) under
service `Bitwarden_agent_access`, new key `grants`:

```json
{"grants":[{"id":"<uuid>","signatureKind":"macosTeamId","signatureIdentity":"TEAMID:com.foo",
            "displayName":"Cursor","exePath":"/Applications/Cursor.app/…","scope":"allLogins",
            "createdAt":<unix-s>,"lastUsedAt":<unix-s>}]}
```

Keyed by `(signatureKind, signatureIdentity)`. Unsigned/invalid-signature peers are keyed by
canonical path and re-prompt if the binary changes identity kind. Renderer accesses grants only
via new IPC handlers (list/remove/upsert) — raw store never crosses IPC, matching the existing
storage invariant. First-use flow: no grant → first-use authorization dialog (identity facts +
Allow/Deny) → on Allow, grant persisted, then the normal per-request approval dialog proceeds.
Scope selection beyond `allLogins` is Phase 2 (W5); the schema field exists from day one.

## napi surface changes (W1a)

- `serve(config, …callbacks)` — first parameter becomes
  `AgentAccessConfig { relayUrl: string; socketPath?: string }` (was positional `relayUrl`).
- `CredentialRequestData`: `requesterFingerprint` becomes optional; new `origin: "relay" | "local"`;
  new optional `localPeer: LocalPeerInfo`.
- `CredentialResponseData`: new optional `reason?: "notFound" | "denied"` — mapped to local
  protocol `status`; ignored on the relay path until the SDK reply type carries it.
- `deliveryMode` rides on `CredentialRequestData` (`"inject" | "reference"`, absent for relay) so
  the renderer can display it; the Rust local path independently strips values for `reference`.

## SDK-side changes (W1b/W3a, repo `~/Documents/development/agent-access`)

- New local transport module in `ap-cli` (not `ap-client` — implementing `RelayClient` would keep
  the Noise layer for no benefit). Dispatcher at the `fetch_credential` seam
  (`crates/ap-cli/src/command/connect.rs:710`): local socket when reachable/requested, relay
  otherwise. `--socket <path>` flag + `AAC_SOCKET` env.
- `aac run`: add stdout/stderr scrubbing of secret values (password, totp, notes; plus all
  injected secret env values). Line-buffered with `len-1` tail carry for chunk-boundary matches.
  On by default; `--no-scrub` prints a warning to stderr. Exit code preserved.
- `aac get`/single-shot with local transport: `delivery:"reference"`, prints the `bw://item/…`
  reference and item name only — **no** credential values, no `--output json` credential body.
- `--search` flag added (query type exists; CLI flag was missing).

## MCP integration (M1/M2) — the local front door

Motivation: the goal is "the agent can use my logins," which has no human typing a command and no
pairing step. Claude Code / Cursor speak MCP natively, so the local integration is an **MCP server**
the agent launches and holds open, not a CLI the human invokes.

**M1 — `aac mcp` (SDK repo).** New subcommand: MCP over stdio (JSON-RPC 2.0). Minimal hand-rolled
protocol surface — `initialize`, `notifications/initialized`, `tools/list`, `tools/call` — no heavy
MCP crate. Tools (MVP):

- `find_logins({ query })` → `[{ name, reference: "bw://item/<id>", username }]`. No secret values,
  ever. Backed by a local-socket `delivery:"reference"` request per the wire protocol above.
- `run_with_credential({ query | reference, command: [...] })` → runs the command with the
  credential injected into its environment and scrubbed from stdout/stderr (reuses `run.rs`'s
  redactor), returns `{ exitCode, output }`. Backed by a `delivery:"inject"` request.

Each tool call opens a fresh local-socket connection (reusing `transport/local.rs` and the existing
one-request-per-connection protocol); desktop-side attestation + first-use + per-request approval
run per call, unchanged. The MCP tool **descriptions** must state that every call requires the user
to approve it in the desktop app, so the model sets user expectations correctly.

**M2 — onboarding (clients renderer + main).** The Agent Access page leads with "Connect your AI
assistant," not pairing:

- Build the MCP server config from the bundled `aac` path (`ipc.agentAccess.getBundledCliPath()`):
  `{ "mcpServers": { "bitwarden": { "command": "<aacPath>", "args": ["mcp"] } } }`.
- **"Add to Claude Code"** — one click, main-process JSON merge into `~/.claude.json`'s
  `mcpServers` (read-merge-write with a `.bak` backup; never clobber existing servers; new main IPC
  channel). Plus a **"Copy config"** block for Cursor/other clients.
- Pairing is demoted to a secondary "Connect an agent on another machine" action, not the front
  door. Local agents never pair.
- Connected local agents (from the grant store, `listGrants`) are the primary list content; remote
  paired agents are secondary.

Zero-knowledge invariant is unaffected: MCP tools carry references or injected-then-scrubbed values,
never raw secrets into the model's context; requester identity still comes from OS attestation, not
the MCP client's self-report.

### What "demoted" means for pairing

"Demoted" above means **ranked below the local path, not hidden behind it.** The Setup tab's first
implementation read it as the latter and collapsed remote pairing into a disclosure, which cost more
than it saved: the tab's two top-level paths rendered as a heading and a muted chevron, so a user who
came specifically to pair a remote agent couldn't see the page did that without opening it, and the
chevron sat at the same indentation as the connect UI's own "My agent isn't listed" disclosure —
making a sub-option of the local section look like a peer of the remote one.

The tab is now two peer `bit-section`s under one intro sentence stating the approval guarantee that
governs both: **"Agents on this computer"** (`AgentAccessConnectComponent`) above **"Agents on other
devices"** (`AgentAccessSetupComponent`, opening the pair dialog). Pairing earns its demotion by
ordering and by a quieter action — a small secondary button in the section header, or the empty
state's own call to action — never by being collapsed. Disclosures are reserved for genuine escape
hatches within a section ("My agent isn't listed"), which is the one that remains.

## M3 — multi-agent support

M2 shipped one agent (Claude Code, via a hardcoded `~/.claude.json` merge) plus a manual "Copy
config" escape hatch. M3 generalizes that to a declarative registry of five supported agents
(`models/agent-registry.ts`: Claude Code, Codex CLI, Gemini CLI, Cursor, GitHub Copilot) — a
detection probe list plus a registration strategy per agent — and a picker UI
(`AgentAccessConnectComponent`) that lets a user connect any number of them in one batch.

### Why there is no "run the agent's own CLI for us" strategy

The first version of M3 registered CLI-capable agents (Claude Code, Codex) by spawning `claude mcp
add ...` / `codex mcp add ...` directly, via `execFile` with a bare executable name resolved against
`process.env.PATH`. That broke for every user who launched the app normally: a macOS app launched
from the Dock or Finder inherits **launchd's** PATH, not the user's shell PATH — `launchctl getenv
PATH` is unset by default, i.e. just `/usr/bin:/bin:/usr/sbin:/sbin`. Neither `claude` (typically
under `~/.local/bin`) nor `codex` (typically under `/opt/homebrew/bin`) lives there, so registration
failed with `ENOENT` every time — except from a terminal-launched dev instance, which inherits the
developer's full shell environment and made the bug invisible in normal development.

Recovering the login PATH by executing the user's shell rc files (`$SHELL -ilc 'echo $PATH'`) was
considered and rejected: running a credential manager's own logic through arbitrary user shell
startup scripts is not an acceptable trade-off, and detection (`agent-detection.service.ts`) had
already made the identical call for the identical reason — presence is checked with a PATH scan,
never by executing a binary that happens to have the right name.

The fix removes CLI spawning from this app entirely, replacing the single `Cli` strategy with three:

- **`Deeplink`** — hand off to the vendor's own MCP install URI (Cursor, GitHub Copilot via VS
  Code's `vscode:mcp/install`). The vendor's own app shows its own confirmation UI, owns the
  handler, and keeps working across the vendor's own config-format changes — this app never touches
  the agent's config file.
- **`ManualCommand`** — render an exact copy-paste shell command (Claude Code, Codex CLI, Gemini
  CLI's `mcp add` subcommands) for the user to run in their own terminal. It runs with the user's
  real PATH already loaded, and the agent's own CLI — not this app — decides which config file and
  scope the entry lands in.
- **`FileMerge`** — merge directly into the agent's JSON config file, unchanged from M2's approach.
  Kept as the fallback where no better mechanism exists (today: none of the five agents' _primary_
  strategy is `FileMerge`; Copilot declares it as a secondary fallback for when VS Code isn't running
  to handle its install URI).

Both `Deeplink` and `ManualCommand` are pure, renderer-safe builders in `models/agent-registration
.ts` (`buildInstallDeeplink`, `buildManualSetupCommand`) — the renderer already has the bundled
`aac` path via `ipc.agentAccess.getBundledCliPath()`, so neither needs a main-process round trip.
The `registerWithAgent` IPC handler is therefore only ever reachable for a `FileMerge`-strategy
agent; called for anything else it returns a clear `Error` result without writing anything.

Because this app never performs the write for a `Deeplink`/`ManualCommand` agent, the read-only
status probe (`AgentDefinition.readOnlyStatusConfig`, resolved by
`AgentAccessRegistrationStatusService`) becomes the _only_ way to close the loop and show
"Connected" — every agent declares one, independent of its write strategy. An inconclusive read
(missing/unreadable/unparseable file) always resolves to `AgentRegistrationStatus.Unknown`, never a
guessed "not registered" — a false negative here would be actively misleading.

### Cross-platform config paths

`FileMergeConfigPathSpec`/`AgentPathProbe.base` supports `"home"` (`os.homedir()`) and `"appData"`
(Electron's `app.getPath("appData")`: `%APPDATA%` on Windows, `~/Library/Application Support` on
macOS, `$XDG_CONFIG_HOME`/`~/.config` on Linux). `"appData"` replaces what used to be hardcoded
per-platform guesses under `"home"` (`AppData\Roaming`, `.config`, ...) — those guesses were wrong
for a redirected `%APPDATA%` or a set `$XDG_CONFIG_HOME`, and are exactly the kind of drift this
registry's old comments flagged as unverified risk. VS Code's user profile directory
(`<appData>/Code/User`) is the same relative path on all three platforms, so Copilot's config path
collapses from three per-platform specs to one. Resolution happens exclusively in `../main/agent-
access-path-resolver.ts`, shared by detection, registration, and status — `models/` stays plain data
importable from the renderer (`apps/desktop/CLAUDE.md`).

### Verification discipline

Every mechanism above (deeplink URI formats, `mcp add` argv shapes and scope flags, config file
paths and top-level keys) is checked against the vendor's own current docs before being written into
the registry, and marked VERIFIED (with the doc URL) or UNVERIFIED inline in `models/agent-registry
.ts` and `models/agent-registration.ts`. An UNVERIFIED mechanism is never shipped as an agent's
primary strategy. This is a direct response to the bug that motivated the M3 rewrite: the deleted
`Cli` strategy shipped an unverified `-s`/`--scope` flag guess as _executable_ code, which is a much
higher blast radius than the same guess sitting in a detection probe (worst case: a missed "Detected"
badge) or a copy-paste command (worst case: the user's own terminal reports the error, nothing this
app controls has silently misbehaved).

## M4 — Secrets Manager secrets over user auth

Extends Agent Access so agents can request **Secrets Manager (SM) secrets** in addition to vault
login credentials. The decisive novelty vs. every existing SM client: **user authentication, not
machine access tokens.** The logged-in desktop user's bearer token is accepted by the SM API
(server policy `secrets` requires only scope `api` + the per-org `accesssecretsmanager` JWT claim;
per-user read checks run server-side against access policies), and the org symmetric key that
decrypts secrets already sits in `KeyService.orgKeys$` after sync. No `bws`, no `BWS_ACCESS_TOKEN`,
no service account.

**Fact base (recon 2026-08-11):**

- Server: `GET /organizations/{orgId}/secrets` lists (encrypted names, `read`/`write` flags, no
  values); `GET /secrets/{id}` and `POST /secrets/get-by-ids` return values. `Key`(=name)/`Value`/
  `Note` are standard type-`2.` EncStrings decryptable directly with the org key — no per-secret
  keys. `/secrets/sync` is service-account-only (400 for users); never call it.
- Web SM client (`bitwarden_license/bit-web/.../secret.service.ts`) decrypts with plain
  `EncryptService.decryptString(new EncString(raw), orgKey)`, org key via
  `accountService.activeAccount$ → keyService.orgKeys$(userId) → [orgId]`. All its deps are OSS libs.
- SM-access discovery: `Organization.canAccessSecretsManager` (= `useSecretsManager &&
accessSecretsManager`) in OSS `libs/common`. Caveat: the `accesssecretsmanager` claim is baked
  into the JWT at issuance — a token from before SM was enabled 404s on every SM route until
  refresh; surface this as a lookup miss, never a crash.
- `aac`'s existing `bws` cargo feature (access-token, in-process, listen-side provider) is prior
  art for naming/secrecy hygiene only; this feature does NOT extend it.

### Licensing placement (explicit decision)

`apps/**` may not import `bitwarden_license/**` (eslint blanket rule) and no `bit-desktop` overlay
exists. M4 therefore ships a **small, self-contained SM client written fresh in
`apps/desktop/src/agent-access/services/agent-access-secrets.service.ts`**, using only OSS libs
(`ApiService`, `EncryptService`, `KeyService`, `AccountService`, `OrganizationService`). It mirrors
the wire shapes of the SM API, imports nothing from `bitwarden_license`, and does not copy licensed
source. **Pre-merge TODO: product review of whether this belongs behind a future `bit-desktop`
overlay instead.**

### Wire protocol v1 — new op `secretRequest` (local socket ONLY)

Secrets never ride the relay: `aac` must not fall back to relay for secret requests (mirror `aac
mcp`'s no-fallback stance), and the desktop relay path never constructs secret requests. Same
framing, caps, timeouts, and status vocabulary as `credentialRequest`.

**Request:** `{"version":1,"op":"secretRequest","query":{"type":"name"|"id"|"search","value":"…"},
"delivery":"inject"|"reference","client":{…}}`

- `name` = exact key match, falling back to a unique case-insensitive match (bws prior art);
  `id` = secret UUID; `search` = substring, exact-name-first ranking.

**Response (approved, inject):**
`{"version":1,"status":"approved","secret":{"name":"DB_PASSWORD","value":"…","secretId":"<uuid>"},
"reference":"bw://secret/<uuid>"}`

**Response (approved, reference):**
`{"version":1,"status":"approved","reference":"bw://secret/<uuid>","item":{"name":"DB_PASSWORD"}}`
(`item.username` absent for secrets.)

Reference scheme is **`bw://secret/<id>`** — distinct from `bw://item/<id>`; redeeming it is a
fresh `id`-query with its own approval, exactly like items. **`note` is never released in any
reply** (the secrets analogue of the `notes` invariant). Reference-mode replies carry no `secret`
object by construction (Rust `build_approved` builds it only in the `Inject` arm).

### aac (SDK repo) — MCP tools + CLI

- `transport/local.rs`: parameterize `op` in `WireRequest::new`; add `WireSecretQuery`
  (`name|id|search`), `WireSecret` (redacting `Debug`, value `Zeroizing`), `request_secret()`
  sibling of `request_credential()`, `interpret_secret` (or a secret branch in `interpret`);
  `strip_secret_reference` for `bw://secret/<id>`.
- `command/mcp.rs`: two new tools —
  `find_secrets({query})` → `[{name, reference: "bw://secret/<id>"}]` (reference delivery, no
  values, ever); `run_with_secret({name?|reference?, env?, command})` → injects the value into the
  child env and scrubs stdout/stderr with the existing `Redactor`, returns `{exitCode, output}`.
  Default env var name = secret name uppercased with non-`[A-Z0-9_]` → `_`, `_`-prefixed if it
  starts with a digit; `env` arg overrides. Tool descriptions must state every call requires
  desktop-app approval. Reuse `resolve_endpoint`, `map_local_error_to_tool_message`,
  `run_child_captured`, `pump_scrubbed_to_vec`. Update the `tools.len() == 2` assertion.
- `command/connect.rs`: sibling `fetch_secret_dispatch` reusing `resolve_transport` — **no relay
  fallback**; local unreachable = hard error. Same inject/reference cross-check guards.
- CLI: `--secret <name|bw://secret/id>` on `aac get`-style single-shot (reference-only output) and
  `aac run` (`--secret-env NAME` override). `ConnectArgs` is constructed field-by-field in the
  top-level shorthand (`command/mod.rs`) — the exhaustive struct literal will force that update.

### Desktop Rust (`agent_access` crate) + napi

Single enforcement point unchanged: a secret request becomes the same `CredentialRequestData`
dispatched through the same `CredentialRequestHandler` under the same 60 s deny-by-default timeout,
after the same attestation.

- `callbacks.rs`: `ResourceKind { Credential, Secret }` (default `Credential`) on
  `CredentialRequestData`; `CredentialQueryKind` gains `Name`; `CredentialResponseData` gains
  `secret_value: Option<Zeroizing<String>>` + `secret_id: Option<String>` (redacting `Debug`
  covers `secret_value`).
- `local_protocol.rs`: accept `op == "secretRequest"` in `validate()` (op selects resource kind;
  `name` query type valid only for secrets, `domain` only for credentials); `WireSecret` response
  struct; `build_approved` secret arms (Inject → `secret` object; Reference → `bw://secret/<id>` +
  `item{name}`); `fields_shared_list` → `["value"]` for secrets.
- Relay path (`client.rs`): untouched — relay requests keep `ResourceKind::Credential`.
- napi (`agent_access.rs` + regenerated `index.d.ts`): `ResourceType` string enum on
  `CredentialRequestData` (`resourceType`), `CredentialQueryType` += `Name`,
  `CredentialResponseData` += `secretValue?`, `secretId?`.

### Desktop TS

- **Models** (`models/`): `CredentialQueryType` += `Name: "name"` (hand-mirror discipline);
  new `AgentAccessResourceType = { Credential: "credential", Secret: "secret" }`;
  `CredentialRequestActivity`/`CredentialRequestOutcome` += `resourceType?`, `secretId?` —
  **ids only, never names/values** (activity invariant).
- **Main** (`main-agent-access.service.ts`): `toCredentialQueryType` maps `"name"` (do NOT let it
  degrade to `Search`); activity rows record `resourceType` + `secretId` on `Shared`.
- **SM client** (`services/agent-access-secrets.service.ts`, new): `smOrganizations$(userId)`
  (enabled orgs with `canAccessSecretsManager`); list per org via
  `GET /organizations/{orgId}/secrets`, decrypt names with the org key; filter `read === true`;
  resolve matches per query type; fetch the value of **only the user-selected secret, after
  approval**, via `GET /secrets/{id}` (see M4c — the server writes a `Secret_Retrieved` audit
  event per value fetch, so pre-approval prefetch would forge a retrieval trail for secrets the
  user never released; the payload-prebuild invariant's purpose is released == displayed, and
  secret values are never displayed — approval fixes the secret's _identity_ by id, which a
  post-approval by-id fetch cannot be redirected from). A fetch failure after approval denies
  with a generic error + toast. API 404s (no SM access / stale JWT claim) resolve to an empty
  match list → `notFound`.
- **Renderer pipeline** (`desktop-agent-access.service.ts`): branch on `message.resourceType` at
  the lookup step; secret candidates carry the pre-built response (`secretValue`, `secretId`,
  `itemName`); everything upstream (enable gate, unlock gate with `take(1)`, grant/first-use) and
  downstream (deny paths, `concatMap` queueing) is shared, unchanged.
- **Approval dialog**: matches become a discriminated union —
  `{kind:"credential", cipherId, cipherName, username?, fieldsShared}` |
  `{kind:"secret", secretId, secretName, organizationName?}` — result `selectedId`; secrets render
  name + org and a fields-shared list of exactly "value"; new query-type caption branch for `name`.
  The activity component's exhaustive `Record<CredentialQueryType, string>` forces the new locale
  key.
- **Grants**: unchanged — a grant is the right to _ask_; scope stays `allLogins` (scoping is
  Phase 2/W5, now explicitly covering secrets too).
- **i18n**: new `agentAccess*` keys merged into the existing staged block of
  `locales/en/messages.json` (file is uncommitted — merge, never regenerate; `en` only).

### M4b — secret creation (`secretCreate`)

Motivation: agents migrating hardcoded credentials / `.env` files into SM need to _create_
secrets and get back UUIDs/references to wire into code (bws SDK, `run_with_secret`).
**Create-only — no update, no delete** (additive writes bound the prompt-injection blast radius:
an injected agent can propose new secrets pending human approval, never mutate or destroy
existing ones).

**Server facts (recon):** `POST /organizations/{orgId}/secrets`; a non-admin MUST send exactly
one `projectIds` entry for a project they have **Write** on (project-less creates are denied for
`AccessClientType.User`; >1 project is a 400); read-back is inherited from the project — no
creator auto-grant on the secret. Any SM user may `POST /organizations/{orgId}/projects`, and
project creation self-grants the creator read+write. `accessPoliciesRequests` may be omitted
(null). `GET /organizations/{orgId}/projects` returns org-key-encrypted `Name` + per-project
`Read`/`Write` flags. Admin detection mirrors the web dialog: `Organization.isAdmin` relaxes the
project requirement (an admin's project-less secret is admin-visible only — the dialog warns).

**Wire (local socket only):**

Request: `{"version":1,"op":"secretCreate","create":{"name":"DB_PASSWORD","value":"…",
"note":"…","project":"my-app"},"client":{…}}` — `name`/`value` required non-empty, `note`
optional, `project` an optional HINT (the dialog preselects a writable project whose decrypted
name matches exactly; never trusted silently — the user always sees and can change it). No
`query`, no `delivery`.

Response (approved): `{"version":1,"status":"approved","reference":"bw://secret/<uuid>",
"item":{"name":"DB_PASSWORD"}}` — no new response fields: the client derives the UUID via
`strip_secret_reference`. The stored value is NEVER echoed back. Other statuses as usual
(`notFound` does not apply; a server-side create failure after approval → `error` with a generic
message).

**aac:** `request_secret_create()` in `transport/local.rs` (value `Zeroizing`, redacting `Debug`);
MCP tool `create_secret({name, value, note?, project?})` → `{secretId, reference, name}`; its
description states the value is encrypted and stored in Bitwarden Secrets Manager, every call
requires desktop approval, and the returned reference works with `run_with_secret`.
`find_secrets` results additionally gain an explicit `secretId` field (derived client-side from
the reference). **No CLI create subcommand** — a plaintext secret value on argv/shell history is
the exact anti-pattern this feature exists to remove; MCP (and future stdin-based CLI) only.

**Desktop native:** `validate()` accepts op `secretCreate` → new `RequestOperation::Create`
(default `Request`) riding on `CredentialRequestData` alongside `resource`; incoming fields
`new_secret_name`, `new_secret_value` (`Zeroizing`), `new_secret_note`, `project_hint` — all
presence-only/redacted in `Debug`. Approved response built from `item_name` + `secret_id`
(reference + item only, never a secret object); missing either fails closed. napi mirrors:
`operation`, `newSecretName?`, `newSecretValue?`, `newSecretNote?`, `projectHint?` on
`CredentialRequestData`; `CredentialResponseData` needs NO new fields (`secretId` + `itemName`
suffice).

**Renderer:** pipeline branches on `operation === "create"` after the shared unlock +
grant/first-use gates; new creation-approval dialog shows requester identity, secret name, value
**masked with a reveal toggle**, note, org picker (SM orgs), project picker (writable projects,
decrypted names, "create new project" option, hint-preselect, session-remembered last choice),
project required unless `isAdmin` (with an admin-only-visibility warning when omitted). On
approve: SM service encrypts name/value/note with the org key, creates the new project first if
requested, `POST` with `projectIds:[id]`, omits `accessPoliciesRequests`; responds
`{approved, secretId, itemName}`. API failure after approval → deny with a generic error +
toast. Created names enter the renderer session cache for activity display.

**Activity/main:** `operation?: "request"|"create"` on the activity row; new status `Created`;
`secretId` copied on `Created` (like `Shared`); `queryType`/`queryValue` absent for creates —
the row never stores the secret name (ids only; names resolve from the renderer cache).

### M4c — server-side event logs (org admin audit, Teams/Enterprise)

The local Activity tab is the user's own view; the authoritative org audit trail is the standard
server event log (`GET /organizations/{id}/events`), visible to admins of orgs whose plan grants
`UseEvents` (Teams/Enterprise; server-supplied flag, no client-side plan logic).

**SM secrets — server-authored, mostly free.** The server already writes events for
user-authenticated SM calls (`SecretsController.LogSecretsEventAsync` branches on client type;
user branch since SM-1273): `GET /secrets/{id}` and `POST /secrets/get-by-ids` →
`Secret_Retrieved` (one row per secret), create → `Secret_Created` — all gated server-side on
`UseEvents`, surfaced in the org event log and the per-secret log. Clients cannot and must not
submit SM events via `/collect` (strict allowlist, no secret-id field). Consequences for this
feature:

1. **Value fetch is post-approval, single-secret** (see the SM client bullet in M4) — a
   pre-approval bulk fetch would write `Secret_Retrieved` rows for secrets the user never
   released. One approved release == one accurate event. List endpoints are unlogged
   server-side, so `find_secrets`/name lookups correctly produce no audit rows.
2. The create path needs nothing: `Secret_Created` is already written and attributed.
3. Known server-side gap (separate server change, reviewed independently): SM user events set
   `UserId` but not `ActingUserId`, so they are missing from the per-user event view
   (`/organizations/{orgId}/users/{id}/events`). Fix seam:
   `EventService.LogUserSecretsEventAsync` / `LogUserProjectsEventAsync`.
4. Orgs without `UseEvents` (Free/Families) silently get no SM server trail — the local
   Activity tab is the only record there.

**Agent-specific event types (coordinated server + clients change).** Admins must see
agent-mediated access as its own thing, not as ordinary user activity. Three new `EventType`
values, mirrored in both repos' enums (server `src/Core/Dirt/Enums/EventType.cs`, clients
`libs/common/.../event-type.enum.ts`):

- `Cipher_ClientSharedWithAgent = 1133` (11xx block free through 1299)
- `Secret_RetrievedByAgent = 2106`, `Secret_CreatedByAgent = 2107` (21xx free through 2199)

**Org vault credentials — client-emitted.** On an approved release of an **org-owned** cipher,
the renderer calls `EventCollectionService.collect(Cipher_ClientSharedWithAgent, cipher.id,
/*uploadImmediately*/ true)` at the release site — one event per release, reference- and
inject-mode alike (the event means "credential disclosed to an agent", not which fields).
Server: the type joins the existing shared `Cipher_Client*` case-label list in
`CollectController` (user-scoped cipher fetch is the permission check; unknown types still fall
through to `continue`). Personal-vault ciphers and non-`UseEvents` orgs are dropped by
`EventCollectionService`'s own gating — no caller-side checks. Desktop already wires the
collection/upload services (60 s interval + logout flush). A collect failure never fails the
release.

**SM secrets — server-authored, header-signaled.** The desktop marks its agent-mediated SM calls
with `Bitwarden-Agent-Mediated: 1` via `ApiService.send`'s `alterHeaders` (existing 7th
parameter; precedent `send-api.service.ts`) on exactly two calls: the post-approval
`GET /secrets/{id}` and the create `POST /organizations/{id}/secrets`. `SecretsController` reads
the header (permissive, Duo `Bitwarden-Client-Name` precedent: absent/unknown → normal types)
and logs `Secret_RetrievedByAgent`/`Secret_CreatedByAgent` instead of
`Secret_Retrieved`/`Secret_Created` for the user branch. Spoofing analysis: only the token
holder's own client can set the header, and it changes the event _flavor_ only — an agent
pretending to be a human (or vice versa) gains nothing security-relevant; the event row's
identity fields are server-derived from the token as before. `find_secrets`/list stays
unlogged (list endpoints write no events). Also fixed server-side while in that seam:
`LogUserSecretsEventAsync`/`LogUserProjectsEventAsync` now set `ActingUserId` (was unset — SM
events were invisible in the per-user event view `/organizations/{orgId}/users/{id}/events`).

**Humanization (clients, org admin console + SM log — one shared switch):**
`apps/web/src/app/dirt/event-logs/services/event.service.ts` gains cases for all three types
(+ `apps/web/src/locales/en/messages.json` keys, e.g. "Shared item {id} with an agent",
"Agent accessed secret {id}", "Agent created secret {id}"), and the `ItemEvents` category list
in `event-category.enum.ts` stays consistent. Unknown-type rows render blank (default: break),
so old clients degrade gracefully against new events.

**Which agent** is not in the server log — the `Event` table has no free-text column; per-agent
attribution stays in the local Activity tab. The server log's contract is the agent/not-agent
distinction per item, attributed to the user whose session mediated it.

### Invariants (additive)

1. Secret **values** appear only in inject-mode local replies after human approval; never in
   reference replies, never in MCP `find_secrets` output, never printed by the CLI.
2. Secret **notes** are never released through Agent Access.
3. Activity/main-process state stores `secretId` only; names resolve at render time in the
   renderer (same reference model as cipher names) — decrypted names come from the renderer-side
   SM service, nothing decrypted persists in main.
4. No SM request is ever made with anything but the user's own bearer token; server-side access
   policies remain the authority (client-side `read` filtering is UX, not enforcement).
5. `apps/desktop` imports nothing from `bitwarden_license/**`.
6. Secrets are local-transport-only; the relay protocol is untouched.
7. Writes are create-only. An incoming secret value is held transiently (renderer memory /
   `Zeroizing` in Rust), encrypted with the org key, and never logged, never persisted decrypted,
   and never echoed back in any reply.

## M5 — Browser fill delivery (`delivery: "fill"`)

Source plan: `~/Documents/development/agent-access/plans/browser-fill.md`. This section is the
binding cross-repo contract; where it differs from that plan, **this section wins** (deltas are
marked ∆). Core property: the credential value never enters the `aac` process — the desktop
resolves it and hands it to the browser extension over the existing desktop↔extension IPC channel;
`aac` receives only a status, a `bw://item/<id>` reference, and per-field outcomes.

### Decisions (recon-verified, resolving plan §10 open questions)

1. **Unlock assumption holds (plan Q1).** Neither channel handshake requires vault unlock;
   `doAutoFill` consumes an in-memory decrypted `CipherView` (precedent:
   `overlay.background.ts:2966` builds one from a plaintext generated password); content-script
   fill works while the extension is locked (`autofill-lifecycle.service.ts:256` requires only
   not-LoggedOut); shared unlock already pushes a decrypted user key into a locked extension over
   SDK IPC. No new human step.
2. **Transport = SDK IPC untyped JSON topics** (topic `"agent-fill"`), not the legacy encrypted
   biometric channel. The legacy channel's shared secret exists only after an extension-initiated
   `setupEncryption` (which only biometrics triggers) and its `onMessage` drops any inbound frame
   without a pending `messageId` callback (`nativeMessaging.background.ts:413-419`). SDK IPC is
   desktop-initiable (`NativeMessagingMain.sendTo` → `ipc.main.service.ts:53-64`), bidirectional,
   and carries the shared-unlock user key today — plaintext credential payloads over the same
   OS-protected local socket are within the established trust boundary (same-user peer; consistent
   with the biometric and SSH-agent models). No new encryption logic (repo rule); flag the channel
   choice to @bitwarden/team-key-management-dev on the PR.
3. **Origin verdict is computed desktop-side (∆ plan §10 Q2 preferred extension-side).** The
   renderer already holds the decrypted `CipherView`s and the same `LoginUriView.matchesUri`
   implementation the extension uses lives in shared `libs/common`
   (`login-uri.view.ts:143`), with the desktop's own `DomainSettingsService` supplying equivalent
   domains + default strategy. Single implementation is preserved without shipping URI lists to the
   extension. The extension re-verifies **string equality** of the origin it reported (and the
   field plan) at fill time — TOCTOU stays extension-side where the DOM is.
4. **The existing autofill engine ranks, it does not refuse (plan Q3 — confirmed).** Content-side
   `insertValueIntoField` has no input-type check, and `isLikePasswordField`
   (`inline-menu-field-qualification.service.ts:1030`) deliberately treats visible text fields
   named "password" as password fields. Agent fills therefore do NOT reuse
   `generateLoginFillScript`; a new constrained planner selects targets under the §4.1 invariants
   and a new content-script executor re-checks element type/visibility/origin at write time.
5. **Multiple matching items (∆ plan Q4 proposed refusal):** candidates are filtered to those whose
   saved URIs match the extension-reported origin, then flow through the **existing multi-match
   picker** in the approval dialog. Zero origin-matching candidates → `originMismatch`, no prompt.
6. **Non-active-tab fills (plan Q5):** unsupported, per plan.
7. **`submit` is cut from v1 (∆ resolves plan Q6 = no).** Not in the wire protocol, not in the MCP
   schema. The agent clicks submit with its own browser tooling.
8. **Multiple connected browsers:** v1 requires exactly one live extension endpoint. Zero →
   pre-prompt `error` ("extension not connected"); more than one → pre-prompt `error`
   ("multiple browsers connected") — both value-free and actionable. Documented v1 limitation.
9. **TOTP:** the desktop resolves the **current code** via `TotpService.getCode$` post-approval and
   sends the code, never the seed.

### Wire protocol v1 — `delivery: "fill"` + new op `describeFillTarget` (local socket ONLY)

Field names follow the code, not the plan's snippets: the op field is **`op`** and client info is
**`client`** (plan §2 wrote `type`/`clientInfo` — wrong).

**Request (fill):** a `credentialRequest` with `delivery: "fill"` and an optional `fill` object.
Credential resource only (`secretRequest` + fill is rejected). Query types `domain|id|search` as
today. Note what is absent: no tab id, no origin, no selector, no submit.

```jsonc
{
  "version": 1,
  "op": "credentialRequest",
  "query": { "type": "domain", "value": "bitnotes.io" },
  "delivery": "fill",
  "fill": {
    "fields": ["username", "password", "totp"], // optional; default: all present & safe
    "targetToken": "ft_...",
  }, // optional; from describeFillTarget
  "client": { "name": "aac", "version": "..." },
}
```

**Response (approved):** value-free. `status: "approved"` means _the user approved_; the `fill`
object carries execution outcome, including post-approval failures:

```jsonc
{
  "version": 1,
  "status": "approved",
  "item": { "name": "bitnotes.io", "username": "demo@bitnotes.io", "credentialId": "..." },
  "reference": "bw://item/<credentialId>",
  "fill": {
    "status": "filled", // filled | partial | target-changed | origin-changed
    //   | extension-unavailable
    "origin": "https://bitnotes.io", // extension-reported, never caller-supplied
    "fields": [
      { "role": "username", "status": "filled", "target": "input#email (login form)" },
      { "role": "password", "status": "filled", "target": "input[type=password]#pw" },
      { "role": "totp", "status": "skipped", "reason": "no one-time-code field" },
    ],
  },
}
```

**New pre-prompt terminal statuses** (desktop refuses mechanically, no dialog shown):

- `status: "originMismatch"` — no resolved item's saved URIs match the extension-reported
  active-tab origin. Response carries `fill.origin` + `item.name`s are NOT enumerated (value-free:
  message names the origin only).
- `status: "noSafeTarget"` — origin matched but no requested field has a §4.1-safe target.
  `message` carries the machine-readable reason (`looks-like-registration`, `ambiguous-target`,
  `no-password-field`, `hidden-field-only`, `cross-origin-frame`, `no-login-form`).
- Extension unreachable / ambiguous browser count pre-prompt → existing `status: "error"` with an
  actionable message ("The Bitwarden browser extension is not connected…").

`denied`, `timeout`, `locked`, `notFound` keep existing semantics. SDK gains
`LocalTransportError::OriginMismatch { origin, item_name }` and `::NoSafeTarget { reason }`, both
value-free by construction.

**New op `describeFillTarget`** — approval-free, vault-free, unlock-free (requires only feature
enabled + attested/granted peer + a single connected extension):

```jsonc
{ "version": 1, "op": "describeFillTarget", "client": {"name": "aac", "version": "..."} }
// →
{ "version": 1, "status": "approved",
  "fillTarget": {
    "origin": "https://bitnotes.io",
    "formClass": "login",   // login | registration | multi-step-username | multi-step-password
                            //   | none | ambiguous
    "candidates": [
      {"role": "username", "target": "input#email (login form)", "visible": true, "frame": "top"},
      {"role": "password", "target": "input[type=password]#pw",  "visible": true, "frame": "top"} ],
    "refusals": [],         // §4.1 reasons for roles with no safe target
    "targetToken": "ft_...", "expiresInMs": 30000 } }
```

An old desktop receiving `delivery:"fill"` or op `describeFillTarget` answers "unknown
operation/delivery" (validate() already fails closed) — correct behavior, no version bump.
`fill`/`fillTarget` are delivery-named sub-objects so a future `delivery:"assert"` (passkeys)
drops in without reshaping. Relay protocol untouched; fill is local-socket-only.

### aac (SDK repo) — MCP tools + CLI (M1)

Tools 7+8: `fill_credential` (args: exactly one of `domain` | `name` | `reference`; optional
`fields`, `target_token`; `name` maps to the wire `search` query) and `describe_fill_target`
(no args). Descriptions are a security control: state plainly that the value is never returned,
no workaround exists, the agent cannot choose tab/origin/field, and the flow is
navigate → preflight → fill. CLI: `aac fill [--domain|--name|--ref] [--fields ...]` and
`aac describe-fill-target`, same code path. New `WireDelivery::Fill` is request-side; interpret
gains fill/fillTarget parsing with per-field outcomes. Exhaustive-match chokepoints that must gain
arms: `exit_code_for_local_error` (output.rs:71), `map_local_error_to_tool_message` (mcp.rs:1368),
the three `match resp.status` interpreters, `is_tui_mode`, `Commands`/`process_command`.

### Desktop Rust (`agent_access` crate) + napi (M2a)

`WireDelivery::Fill`; `WireFill { fields, target_token }` on `WireRequest`;
`ValidatedRequest::Lookup` gains `fill: Option<FillParams>` (Credential resource only — the
validate() matrix rejects Secret+fill and fill+create); new
`ValidatedRequest::DescribeFillTarget { client }`. Response side: `WireFillResult`/`WireFillTarget`
serialized on `WireResponse` (skip-if-none); `WireStatus::{OriginMismatch, NoSafeTarget}`.
`CredentialRequestData` gains `delivery: Fill` + fill params + a `describe_target` operation kind;
`CredentialResponseData` gains value-free `fill_result`/`fill_target` JSON pass-throughs (the TS
side owns their shape; Rust validates value-absence by construction — no field of them is ever a
secret). Debug impls stay presence-only. napi mirrors + regenerated `index.d.ts`.
Fix while there: napi `From` reason-match (`napi/src/agent_access.rs:381-387`) accepts only
`"notFound"` while the TS model sends `"not_found"` — a no-match currently reaches the agent as
"Denied by user". Accept both spellings in Rust AND align the TS literal to `"notFound"`.

### Desktop TS (M2b)

Main: `describeFillTarget` + fill-delivery requests ride the existing pending-request pipeline;
activity rows get status `Filled` (stores `cipherId` + origin + `fieldsShared` — metadata only).
Renderer (`desktop-agent-access.service.ts`): fill branch after candidate lookup — (1) describe
round-trip to the extension (10s timeout), (2) origin filter via `LoginUriView.matchesUri` +
`DomainSettingsService`, (3) §4.1 pre-check from the description, (4) approval dialog (origin
visually dominant, field plan beneath, existing picker for multiple matches), (5) post-approval:
resolve TOTP code, push fill payload, await per-field outcomes, respond value-free.
`describeFillTarget` requests bypass the unlock gate (vault-free) but respect enable + grant gates.
Desktop↔extension plumbing: renderer subscribes `ipcService.messages$` topic `"agent-fill"`;
extension announces itself (hello on connect/reconnect); renderer keeps a live-endpoint registry
and correlates request/response by `requestId`. Message contract types live in
`libs/common/src/autofill/agent-fill/` (pure types, no Angular). New dialog variant mirrors
`CreateSecretRequestComponent` as a standalone sibling. i18n: `agentAccessFill*` keys in the
staged `en` block only.

### Extension (M3)

New `AgentFillBackground` (apps/browser): subscribes SDK IPC topic `"agent-fill"`, sends hello on
init/reconnect, handles `describeTarget` and `fill`. Planner: `collectPageDetailsFromTab$` on the
active tab (`BrowserApi.getTabFromCurrentWindow`), then §4.1-constrained selection — password role
only into `type="password"` (the `isLikePasswordField` legacy heuristic is excluded for agent
fills); hidden/`viewable:false` fields never; frames whose origin ≠ tab origin never;
login+confirm-password form → `looks-like-registration`; >1 candidate form/field per role →
`ambiguous-target`. `targetToken` = random id → in-memory `{tabId, origin, field opids +
signatures, 30s expiry, single-use}`. Fill: re-derive plan, compare origin (string equality) and
plan (opids + signatures) → `origin-changed`/`target-changed` on drift; dispatch a NEW content
command (`agentFillForm`) that re-checks element type/visibility/readonly at write time, inserts
via the existing insertion semantics, and returns per-field outcomes (never values — no
re-collection of page details post-fill, since `AutofillField.value` would carry the password).
The credential exists in extension memory only for the duration of the fill; nothing persists, no
`updateLastUsedDate`, no last-filled cache. Desktop-side event collection logs
`Cipher_ClientAutofilledByAgent = 1134` (server enum mirror, M4c pattern) — server repo gains the
enum value + CollectController case + humanization alongside the uncommitted M4c changes.

### Invariants (additive to M4's)

8. A fill reply on the local socket never carries a credential value, and the desktop→extension
   fill payload is the only place a value transits — renderer memory → IPC → extension memory →
   DOM write, never logged, never persisted, never echoed.
9. The agent never names a fill destination: no tab id, origin, selector, or frame in the request;
   the origin used for matching and shown in the prompt comes from the extension's report.
10. Origin mismatch and no-safe-target are mechanical refusals — no prompt is shown, so no human
    can be phished into overriding them.
11. A password is written only into `<input type="password">`, under every code path, with the
    check enforced at write time in the content script.
12. `describeFillTarget` touches no vault data and requires no approval; its reply describes the
    page only.

## M6 — Full Secrets Manager surface (update/delete/projects/generation)

Direction (Max, 2026-08-12): the MCP server should expose "pretty much all functions we have
available in sdk-sm" — the target flow is an agent that identifies hardcoded credentials, creates
or **generates** secrets in SM _without ever knowing the generated values_, and rewires code to
reference `bw://secret/<uuid>` + the bws SDK. This supersedes M4b's create-only stance; the
blast-radius bound moves from "additive writes only" to "every write is a separate, single-target,
human-approved operation with truthful consequence labeling."

Explicitly excluded, with reasons the tools' descriptions must NOT contradict:

- `/secrets/sync` — service-account-only on the server (400 for users).
- A standalone "generate a password and hand it to the agent" tool — plaintext to the agent is
  the anti-pattern this feature removes; generation exists only inside create/update.
- Bulk writes — the server has bulk delete endpoints; the wire deliberately carries ONE id per
  op so one approval == one consequence.
- Trash operations (restore / permanently delete) — org-admin-only server-side, and "agent
  empties the trash" has no remediation use case.
- Secret note read-back — notes remain write-only through Agent Access (M4 invariant 2).

**Server facts this section relies on (recon 2026-08-12):**

- `PUT /secrets/{id}` is FULL-REPLACE: `Key`/`Value`/`Note` all `[Required]` EncStrings (org
  key), `Note` must be the encryption of `""` when empty; `ProjectIds` ≤ 1 (400 otherwise).
  `ProjectIds` null/omitted ⇒ "no mapping change" (only secret Write needed); `[]` ⇒ strip all
  projects ⇒ **denied for non-admins**; `[newId]` (different from current) ⇒ move, requires
  Write on the NEW project. `valueChanged` is never sent (web parity; server would write a
  SecretVersion row and can 404 on missing OrganizationUser). `accessPoliciesRequests` omitted.
- `POST /secrets/delete` takes a bare JSON array of ids; response is per-id `{Id, Error}` —
  authz failure is an `Error` string, not an HTTP error. It is a **soft delete** (SM trash;
  restore/empty are org-admin-only).
- `GET /organizations/{orgId}/projects` (unlogged), `POST .../projects` (create, ANY SM user,
  self-grants read+write, Free-plan max-projects 400 possible), `PUT /projects/{id}` (rename
  only, needs project Write), `POST /projects/delete` (bare id array, per-id `{Id, Error}`,
  needs project Write) — project delete is a **HARD delete**: the Project row is removed and
  contained secrets survive project-less (invisible to non-admins without direct policies).
- `GET /projects/{projectId}/secrets` exists, is unlogged, and serves the orphan-count warning.
- Update/delete/project endpoints currently log hardcoded `Secret_Edited`/`Secret_Deleted`/
  `Project_*` — the agent-mediated header resolution only covers get/create (M4c); M6-E extends
  it.

### Wire protocol v1 — six new ops + `generate` on `secretCreate` (local socket ONLY)

Same framing, caps, timeout, and status vocabulary as before; none of these ops ride the relay.
Op string ⇒ (resource, operation): `secretRequest`=(Secret,Request), `secretCreate`=(Secret,
Create), `secretUpdate`=(Secret,Update), `secretDelete`=(Secret,Delete), `projectList`=(Project,
List), `projectCreate`=(Project,Create), `projectUpdate`=(Project,Update), `projectDelete`=
(Project,Delete). New reference scheme **`bw://project/<id>`**.

**`secretCreate` (extended):** `create.value` becomes optional; new alternative
`create.generate: {"length"?: int, "symbols"?: bool}` — EXACTLY ONE of `value`/`generate` must be
present (validate() error otherwise). `length` ∈ [12, 128], default 40; `symbols` default true;
charset is upper+lower+digits(+symbols). Out-of-range length is a validation error ("generate.length
must be between 12 and 128"), not a clamp. Response unchanged (reference + item, value NEVER echoed
— now it can't be: for generated creates the requester has nothing to echo).

**`secretUpdate`:**
`{"version":1,"op":"secretUpdate","target":{"id":"<uuid>"},"update":{"name"?,"value"?,
"generate"?:{...},"note"?,"project"?},"client":{...}}`

- `target.id` required non-empty; `update` requires ≥1 field; `value`/`generate` mutually
  exclusive; `generate` same shape/bounds as create.
- Field semantics: absent = unchanged. `name` = rename. `note: ""` = clear note (desktop encrypts
  `""`). `project` = move-to HINT (name string, same trust rules as create's hint: dialog
  preselects an exact decrypted-name match among writable projects, user always sees/changes it).
  There is deliberately NO "remove project" form (server denies it for non-admins anyway).
- Response (approved): `{"version":1,"status":"approved","reference":"bw://secret/<id>",
"item":{"name":"<post-update name>"}}`.

**`secretDelete`:** `{"version":1,"op":"secretDelete","target":{"id":"<uuid>"},"client":{...}}`
— no query/delivery/create/update/fill. Response (approved): reference + `item{name}` of the
deleted secret. A per-id `Error` in the server reply after approval ⇒ wire `error` with a generic
message (never the server's text verbatim — it can name policy internals).

**`projectList`:** `{"version":1,"op":"projectList","client":{...}}` — no query. ONE approval
releases the full readable project list across the user's SM orgs (names are org metadata, no
secret material; the dialog shows every name being shared). Response (approved):
`{"version":1,"status":"approved","projects":[{"name":"...","reference":"bw://project/<id>",
"write":true,"organization":"<org name>"}]}` — new top-level `projects` array, capped at 200
entries. This is the one list-shaped release; every other op stays single-target.

**`projectCreate`:** `{"version":1,"op":"projectCreate","create":{"name":"..."},"client":{...}}`
— `create.name` required non-empty; `value`/`generate`/`note`/`project` must be ABSENT (op
decides the shape; a stray `value` on a projectCreate is a validation error). Response:
`bw://project/<id>` + `item{name}`.

**`projectUpdate`:** `{"version":1,"op":"projectUpdate","target":{"id"},"update":{"name":"..."}}`
— rename only (mirrors the server). **`projectDelete`:**
`{"version":1,"op":"projectDelete","target":{"id"}}`. Responses: reference + `item{name}`.

### aac (SDK repo) — 7 new MCP tools (M6-A)

`transport/local.rs`: `PROJECT_REFERENCE_PREFIX = "bw://project/"` + `strip_project_reference`;
`WireTarget{id}`, `WireGenerateOptions{length,symbols}` (both optional on the wire, defaults
applied desktop-side; aac validates bounds before sending), `WireSecretUpdate` (redacting `Debug`:
`value` REDACTED, `note` presence-only, `name`/`project` verbatim — matches `WireSecretCreate`);
`WireSecretCreate.value` becomes `Option<Zeroizing<String>>` + `generate: Option<...>`; request
fns `request_secret_update`, `request_secret_delete`, `request_project_list`,
`request_project_create`, `request_project_update`, `request_project_delete`; `WireResponse`
gains `#[serde(default)] projects: Option<Vec<WireProjectEntry>>`
(`WireProjectEntry{name, reference, write, organization}` — plain `Debug` is fine, no secret
material); interpreters follow the existing per-op pattern (version check first, reference must
start with the right prefix, derived id non-empty). Delete outcomes parse reference + name.

`command/mcp.rs` — tool count 8 → **15**, definitions in this order after `create_secret`:

1. `generate_secret({name, note?, project?, length?, symbols?})` → `{secretId, reference, name}`.
   Description MUST state: the value is generated inside the Bitwarden desktop app and encrypted
   before storage; **it is never shown to you and cannot be retrieved through this interface**;
   use `run_with_secret` to use it and the reference/UUID to wire SDK integration; requires
   desktop approval.
2. `update_secret({secretId? | reference?, name?, value?, generate?, length?, symbols?, note?,
project?})` → `{secretId, reference, name}`. Exactly one of `secretId`/`reference`; ≥1 change
   field; `value` xor `generate` (a bare `generate: true` uses default options). Description: for
   rotation prefer `generate: true` so the new value never passes through you; renames/moves
   never expose the value to anyone.
3. `delete_secret({secretId? | reference?})` → `{deleted: true, secretId, name}`. Description
   MUST say: moves the secret to the Secrets Manager trash; an organization admin can restore it.
4. `list_projects({})` → `[{projectId, reference, name, write, organization}]`.
5. `create_project({name})` → `{projectId, reference, name}`.
6. `update_project({projectId? | reference?, name})` → `{projectId, reference, name}`.
7. `delete_project({projectId? | reference?})` → `{deleted: true, projectId, name}`. Description
   MUST warn: permanent; secrets inside are NOT deleted but lose the project and may become
   inaccessible to non-admin users.
   Every description states that each call requires approval in the Bitwarden desktop app (the
   existing "Bitwarden desktop" description test enforces this). NO new CLI subcommands (argv
   plaintext anti-pattern; MCP only). Update `SERVER_INSTRUCTIONS` with the remediation workflow
   (find hardcoded creds → `generate_secret`/`create_secret` into a project → replace literals with
   references/UUIDs → `run_with_secret` at runtime) and the count/name tests (`tools.len()==15`,
   required-field assertions per tool, value-never-in-output table tests for update mirroring
   `create_secret_value_never_in_output_on_every_status`).

### Desktop Rust + napi (M6-B)

`callbacks.rs`: `ResourceKind` += `Project`; `RequestOperation` += `Update`, `Delete`, `List`;
`CredentialRequestData` += `target_id: Option<String>`, `generate_value: bool`,
`generate_length: Option<u32>`, `generate_symbols: Option<bool>` (Debug: presence-only where it
isn't already; `target_id` may print verbatim — it's an id); `CredentialResponseData` +=
`project_id: Option<String>`, `projects: Option<Vec<ProjectEntry>>`
(`ProjectEntry{id, name, write, organization}` — names decrypt renderer-side and transit main
only inside this in-flight response, they are never buffered; plain Debug prints presence/count
only, not names).

`local_protocol.rs`: `WireTarget`, `WireGenerate`, `WireUpdate` structs (redacting Debug on
`WireUpdate.value`); validate() arms per the op table above — each arm rejects every foreign
top-level object (`query`/`delivery`/`fill`/`create`/`update`/`target` — whichever don't belong,
mirroring the existing per-arm rejections); `ValidatedRequest` gains `Update { target_id, name,
value: Option<Zeroizing<String>>, generate: Option<GenerateOptions>, note, project, client }`,
`Delete { resource, target_id, client }`, `List { resource, client }`, and Create gains
`value: Option<Zeroizing<String>>` + `generate: Option<GenerateOptions>` (exactly-one enforced in
validate()); `build_response` dispatch extends: `(Update, _)` / `(Delete, _)` → reference +
`item{name}` built from (`secret_id`|`project_id`) + `item_name`, fail-closed if either missing;
`(List, _)` → `projects` array from `ProjectEntry` vec, fail-closed if `projects.is_none()`;
reference prefix selected by `resource` (`bw://secret/` vs `bw://project/`).

**Invariant guard extension** (`local_listener/mod.rs`): the main-process buffer must never see
names for non-lookup ops — `query_value` is force-filled with: create → proposed name (existing),
update/delete → `target_id`, projectCreate → proposed name, list → `""`. Main TS keeps
queryType/queryValue OUT of the activity row for every `operation !== "request"` (existing
`isCreate` gate generalizes). Spec-assert both sides.

napi (`agent_access.rs` + `index.d.ts` — **the .d.ts additions are already hand-applied by the
architect; make the Rust match them exactly**): `OperationType` += `update|delete|list`,
`ResourceType` += `project`, request fields `targetId?`, `generateValue?`, `generateLength?`,
`generateSymbols?`; response fields `projectId?`, `projects?: Array<AgentAccessProjectEntry>`;
new `AgentAccessProjectEntry {id, name, write, organization}`. The napi `From` impls must
preserve EMPTY STRINGS on `newSecretNote` (note `""` = clear; do not collapse to None).

### Desktop TS main + models (M6-C)

Models (hand-mirror): `AgentAccessOperation` += `Update:"update"`, `Delete:"delete"`,
`List:"list"`; `AgentAccessResourceType` += `Project:"project"`; `AgentAccessRequestStatus` +=
`updated`, `deleted`, `listed`; `CredentialRequestActivity`/`CredentialRequestOutcome` +=
`projectId?` (ids only, invariant 3 of M4 unchanged). Main service: pass-through of the new
request fields to the renderer message (`targetId`, `generateValue`, `generateLength`,
`generateSymbols`); the activity-row query omission generalizes from `isCreate` to
`operation !== Request`; `resolveCredentialRequest` treats `updated`/`deleted`/`listed` as
resolved statuses, copying `secretId`/`projectId` on `updated`/`deleted` (like `Shared`/
`Created`); pending-timeout and one-way Pending→resolved rules unchanged.

### Desktop TS renderer (M6-D)

`agent-access-secrets.service.ts` new/changed methods (all propagate failures on post-approval
paths, degrade-to-empty on read paths, per existing convention):

- `getSecretForUpdate(secretId, organizationId, userId)` → `GET /secrets/{id}` **with the
  agent-mediated header**, returning `{ nameDecrypted, keyEncString, valueEncString,
noteEncString, currentProjectId? }` — Key decrypted for display; **Value and Note ciphertexts
  are passed through verbatim when unchanged, never decrypted** (the rename/move path touches no
  plaintext value at any layer).
- `updateSecret(...)` → `PUT /secrets/{id}` with header; body always carries key/value/note
  (changed fields freshly encrypted, unchanged fields = original ciphertexts; note cleared =
  encrypt `""`); `projectIds` OMITTED unless the user confirmed a move, then `[newProjectId]`.
- `deleteSecret(secretId, organizationId, userId)` → `POST /secrets/delete` with header, body
  `[secretId]`; a non-null per-id `error` throws (pipeline denies with generic error + toast).
- `updateProject` / `deleteProject` → `PUT /projects/{id}` / `POST /projects/delete` with header,
  same per-id error rule; `createProject` FIXED to send the header (existing gap).
- `countSecretsInProject(projectId, organizationId, userId)` → `GET /projects/{id}/secrets`,
  count only, degrade to `undefined` on failure (dialog then warns without a number).
- `generateSecretValue(options)` — thin wrapper over `PasswordGenerationServiceAbstraction
.generatePassword({length, uppercase, lowercase, number: true, minNumber: 1, special: symbols,
minSpecial: symbols ? 1 : 0})` (provided app-wide by JslibServicesModule; the deprecated façade
  is a deliberate choice over `CredentialGeneratorService.generate$`'s account-bound ceremony —
  comment this). Value lives only in the local scope of the create/update handler: generated at
  submit time, encrypted, POSTed, discarded.
- Project name cache sibling of `secretNameCache` + `resolveProjectName` for activity display.

Pipeline (`desktop-agent-access.service.ts`): the operation branch generalizes —
`create` (extended: `generateValue` requests show a "Bitwarden will generate a strong random
value; the agent never sees it" notice instead of the masked value field), `update` →
`handleUpdateRequest`, `delete` → `handleDeleteRequest`, `list` → `handleProjectListRequest`,
each after the SAME enable/unlock/grant gates, each resolving names/state BEFORE the dialog
(TOCTOU: what is approved is what was displayed) and calling the API only AFTER approval.
Unknown resource/operation combinations deny (fail-closed), never fall through to lookup.

Dialogs (params/results pinned so the pipeline and components can be built against this doc):

- `update-secret-request.component`: params `{requesterName?, requesterFingerprint?, secretName,
organizationName, currentProjectName?, changes: { name?: {from, to}, value?: "agent" |
"generated", note?: {to} , project?: {toHint} }, writableProjects?, preselectedProjectId?,
userId}`; result `{approved, projectId?}`. Agent-supplied values masked with reveal toggle
  (create-dialog pattern); generated values shown as the notice chip; project picker rendered
  ONLY when a move was requested.
- `confirm-delete-request.component` (shared secret/project): params `{requesterName?,
requesterFingerprint?, kind: "secret" | "project", itemName, organizationName?,
containedSecretCount?}`; result `{approved}`. Danger-styled submit. Secret copy: moved to SM
  trash, org-admin-restorable. Project copy: permanent, contained secrets lose their project and
  may become inaccessible to non-admins (count shown when known).
- `create-project-request.component`: params `{requesterName?, requesterFingerprint?,
projectName, organizations, lastOrganizationId?, userId}`; result `{approved,
organizationId?}`. (Rename reuses this shape with from→to copy via a `mode` param — D's
  choice, but ONE simple component for both is preferred over a fourth dialog.)
- `project-list-request.component`: params `{requesterName?, requesterFingerprint?, entries:
[{name, organizationName, write}]}`; result `{approved}` — the dialog lists every name being
  released.
  Activity component: exhaustive `REQUEST_STATUS_META` gains `updated`/`deleted`/`listed` (the
  Record type forces the locale keys); result labels resolve secret names via the existing cache
  and project names via the new one; `deleted` label must not degrade to a bare id when the cache
  misses — fall back like `Created` does. i18n: extend the staged `agentAccess*` block in
  `locales/en/messages.json` (merge, never regenerate; `en` only; follow the `agentAccessCreate*`
  family naming — new families `agentAccessUpdate*`, `agentAccessDelete*`, `agentAccessProject*`).

### Server + clients event mirror (M6-E)

Server (branch `prototype/agentic-event-logs`): `EventType.cs` += `Secret_EditedByAgent = 2108`,
`Secret_DeletedByAgent = 2109`, `Project_CreatedByAgent = 2204`, `Project_EditedByAgent = 2205`,
`Project_DeletedByAgent = 2206` (2108-2199 and 2204-2299 confirmed free). Factor the private
`AgentMediatedHeaderName`/`IsAgentMediatedRequest`/`ResolveAgentMediatedEventType` trio out of
`SecretsController` into a shared internal helper under `src/Api/SecretsManager/` and apply it
to: `PUT /secrets/{id}` (:241), `POST /secrets/delete` (:284), and in `ProjectsController` to
create (:98), update (:120), delete (:196). `Project_Retrieved` gets NO agent flavor (the
desktop never calls `GET /projects/{id}`; lists are unlogged). Tests mirror the committed
`SetAgentMediatedHeader` pattern. Clients mirror (same repo as C/D but disjoint files):
`libs/common/.../event-type.enum.ts` += the five values;
`apps/web/.../event.service.ts` + web locale keys humanize them ("Agent updated secret {id}",
etc.); `ItemEvents` category list consistency check.

The update flow writes TWO agent rows by construction (`Secret_RetrievedByAgent` from the merge
GET + `Secret_EditedByAgent` from the PUT) — accurate, since the desktop did retrieve the
ciphertexts; documented rather than suppressed.

### Invariants (additive to M4's and M5's)

13. No wire reply ever carries a secret value for ANY M6 op — update/delete/project responses
    are reference+name-shaped by construction; the only value-bearing reply remains
    inject-delivery `secretRequest`.
14. Generated values are born in the renderer at approval time, encrypted with the org key,
    POSTed, and discarded — never in a wire reply, never in main, never in `aac`, never logged,
    never shown to the agent by any path.
15. An update that does not change the value never decrypts it, at any layer (ciphertext
    passthrough).
16. One approval == one target: no bulk writes on the wire; `projectList` is the sole
    list-shaped release and carries names/ids/flags only.
17. Consequence labeling is truthful: secret delete says trash/restorable; project delete says
    permanent/orphaning. No dialog understates what the server will do.
18. Project hints (create AND update-move) are never trusted silently; the user sees and can
    change the target. Removing a secret's project via agent is unrepresentable on the wire.
19. All SM value-reads and mutations send `Bitwarden-Agent-Mediated: 1`; list endpoints are
    unlogged server-side and need no header.

## Sequencing & ownership

| #       | Work                                                          | Repo                        | Depends on          |
| ------- | ------------------------------------------------------------- | --------------------------- | ------------------- |
| W4      | Approval correctness (picker, not_found, notes)               | clients (TS renderer)       | —                   |
| W1a     | Local listener + protocol + napi config                       | clients (Rust/napi/main TS) | this doc            |
| W1b/W3a | aac local transport + run scrubbing                           | agent-access SDK            | this doc (protocol) |
| W2a     | Attestation module                                            | clients (Rust)              | W1a                 |
| W2b     | Grants, first-use dialog, remote-only pairing, locale rewrite | clients (TS)                | W2a                 |

Invariants that must survive every change (plan §2 "What is already correct"):
requester identity never self-reported; payload built before dialog, released payload = displayed
payload; deny-by-default on timeout/error; storage/grants main-process-local; activity events
metadata-only.

## §M8 OpenShell integration (binding)

**Status: BINDING.** Implementers on both repos build against this section. Any deviation means
updating this section first. The user's decisions (2026-10-06) are final and are written in below.
Nothing here is pending.

Bitwarden becomes an **optional external credential driver** for an
[NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell) gateway. The gateway asks Bitwarden for
provider credentials when a sandbox loads its provider environment. Every such request goes through
the existing single enforcement point (`CredentialRequestHandler`, then the renderer pipeline) and
gets a human approval that shows the sandbox identity and the endpoints the credential can reach.
The sandboxed agent only ever sees OpenShell placeholders, never the values.

Explicitly out of scope:

- Launching, stopping or managing sandboxes from desktop.
- Writing any OpenShell file, **except** the one-button setup of §M8.19 (edits `gateway.toml` and
  restarts the gateway, on an explicit button press only). The manual snippet remains as its fallback.
- Bundling any new binary. The driver is a subcommand of the `aac` we already bundle.
- Windows, Snap and AppImage.
- Supervisor middleware (option B in the brief). That is a possible later phase; see U9.

Upstream reference: `NVIDIA/OpenShell` at commit `0bca9fb8280045224c910610cba005b7fa5a6a83`
(v0.1.2 line). Every `file:line` citation in this section points at that commit.

### M8.1 Design selection (recorded)

Two designs were evaluated: A ("security-first") and B ("native-fit"). **B is the base.**

Why B wins:

- It is built on facts verified in the OpenShell source:
  - the gateway's 30 s driver RPC deadline (`crates/openshell-server/src/credentials.rs:60`);
  - one `ResolveCredentials` batch per provider (`:640-676`);
  - all-or-nothing batch responses with no per-item error (`:683-750`).
- It uses a **new op on a separate, toggle-gated socket** rather than a new field on
  `credentialRequest`. Unknown fields are ignored on the wire (§"Local wire protocol v1"), so an old
  desktop would silently drop a new field and fail _open_ into a plain local approval. An unknown op
  fails _closed_ (`"unknown operation"`), and no version bump is needed.
- Its single combined dialog fits the 25 s budget.
- Its separate `ap-openshell` crate can be tested without the sdk-sm sibling.

Ideas grafted from A:

1. **An empty endpoint set is refused.** A credential with no bound endpoint has nothing honest to
   approve.
2. **An unknown origin is denied in the renderer gate.** This replaces today's `origin !== "local"`
   skip, which would fail open for any new origin.
3. **Grants never cross-match between plain-local and OpenShell keys.** A `providerId` is part of the
   grant key.
4. **`StoreCredential` contacts nothing.** The gateway database only ever holds Bitwarden UUID
   handles.
5. **The activity buffer stores ids only.**
6. **Plaintext gateway auth is accepted only when the endpoint host is loopback.**

New in this contract, beyond both designs:

- User-configurable approval lifetime (§M8.6), backed by the `expiration_time` that the gateway and
  supervisor honour (U3).
- **Policy digest bound to the displayed endpoint list.** The renderer recomputes the digest, so the
  fingerprint the user approves is the list the user sees.
- An AppImage exclusion, because its mount path is not a stable `command`.

### M8.2 Topology and trust

```
openshell-gateway (user service: Homebrew / systemd --user)
  │ spawns per gateway.toml `command`:  aac openshell-driver --gateway <name> --bind-socket <driverSock>
  ▼
aac openshell-driver ── gRPC CredentialDriver over UDS (driverSock, 0600) ◀── gateway
  │  (read-only gateway API lookups over mTLS / loopback plaintext: sandbox, profile, policy)
  │  one JSON line: op "openshellResolve"
  ▼
~/.bitwarden-agent-access-openshell.sock  (desktop, exists ONLY while the toggle is on)
  │  ListenerKind::OpenShell → origin = OpenShell (from the listener, never from the wire)
  │  attestation precheck: peer basename `aac` (or an exact dev-build name, §M8.18),
  │  parent basename `openshell-gateway`
  ▼
CredentialRequestHandler (60 s cap, here min(60 s, deadlineMs)) → napi → main → renderer
  renderer: exhaustive origin switch → AgentAccessOpenShellService → combined approval dialog
  ▼ approved: values + lifetime
aac → ResolvedCredential{request_id, value, expiration_time} → gateway → supervisor memory
  → placeholder swap only on egress to bound endpoints. The agent sees placeholders only.
```

| Fact                                                                | Source                                                                                   | How it is presented                                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| The requesting process is `aac`, spawned by `openshell-gateway`     | OS attestation (existing `LocalPeerInfo` / `attest`)                                     | "Verified" with the same strength as today's local attestation. Path-only on Linux and likely on Homebrew (U7). |
| Sandbox id/name/image, provider, workspace, endpoints, advisor flag | Reported by the gateway, through aac                                                     | Always labelled "Reported by the OpenShell gateway, not verified by Bitwarden"                                  |
| `policy.digest`                                                     | Computed by aac, **recomputed by the desktop renderer** over the displayed endpoint list | Consistency of what is shown, not provenance                                                                    |
| `client`                                                            | Self-reported                                                                            | Diagnostic only, as today                                                                                       |

The human gate is the security boundary. Attestation and the gateway-reported context are defence
in depth only (see `attestation.rs:1-41`).

### M8.3 User reference and handle grammar (aac only; desktop never parses these)

User-facing references are passed as the credential value to
`openshell provider create --credential KEY=<ref>`.

| Reference (exact, case-sensitive, lowercase UUID) | Handle returned by `StoreCredential` | Target                                |
| ------------------------------------------------- | ------------------------------------ | ------------------------------------- |
| `bw://item/<uuid>#username`                       | `bw1:item:<uuid>:username`           | `{resource:"item", field:"username"}` |
| `bw://item/<uuid>#password`                       | `bw1:item:<uuid>:password`           | `{resource:"item", field:"password"}` |
| `bw://secret/<uuid>`                              | `bw1:secret:<uuid>:value`            | `{resource:"secret", field:"value"}`  |

Rules:

- `<uuid>` matches `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. Uppercase input
  is lowercased before validation, and nothing else is normalised.
- `#totp`, any other fragment, a query string, whitespace, an empty value, or anything else is
  rejected.
- **TAKEOVER (user decision 1):** this driver handles every provider credential on its gateway.
  `StoreCredential` with any value that is not a valid reference returns
  `INVALID_ARGUMENT "Bitwarden driver accepts only bw:// references"`. The error text never contains
  the value, any prefix of it, or its length.
- `CredentialHandle` = `{driver:"bitwarden", handle:"bw1:…", metadata:{"kind":"item"|"secret","field":"username"|"password"|"value"}}`.
- `ResolveCredentials` with a handle that fails to parse fails the **whole batch** with
  `INVALID_ARGUMENT "unrecognised Bitwarden handle"`. A handle not owned by this driver is never
  routed here (`driver_for_handle`).

### M8.4 Wire protocol: local protocol v1, two new ops, OpenShell socket only

`version` stays `1`. Neither op is accepted on the existing agent socket; it replies
`status:"error"`, `message:"operation not available on this socket"`. The OpenShell socket accepts
**only** these two ops; every other op gets the same error. Framing, the 64 KiB request line cap
and "one connection per request" are unchanged. Field names are camelCase as shown. JSON key order
is the order shown, and aac serializes in that order (the golden fixtures in §M8.11 depend on it).

#### `openshellResolve` request

```json
{
  "version": 1,
  "op": "openshellResolve",
  "openshell": {
    "deadlineMs": 25000,
    "gateway": { "name": "openshell", "endpoint": "https://127.0.0.1:17670" },
    "provider": {
      "id": "prov-7f3a",
      "name": "gh-agent-1",
      "profile": "github",
      "workspace": "default"
    },
    "sandbox": { "id": "sbx-01J9Z6", "name": "agent-1", "image": "ghcr.io/example/agent:1.2" },
    "endpoints": [{ "host": "api.github.com", "port": 443, "path": "/**", "source": "profile" }],
    "policy": {
      "digest": "sha256:998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020",
      "advisorEnabled": false
    },
    "targets": [
      {
        "credentialKey": "GITHUB_TOKEN",
        "resource": "item",
        "id": "3f1c2b9e-8a4d-4c7e-9b21-5d6f7a8b9c0d",
        "field": "password"
      },
      {
        "credentialKey": "DB_PASSWORD",
        "resource": "secret",
        "id": "a7e2d4c1-6b3f-4e8a-9d10-2c5b6a7f8e9d",
        "field": "value"
      }
    ]
  },
  "client": { "name": "aac-openshell-driver", "version": "<CARGO_PKG_VERSION>" }
}
```

Desktop validation is done by `validate_openshell_resolve`. aac must emit only what passes it. Any
failure gives `status:"error"`, the connection is closed, and nothing is dispatched.

| Field                                                                                   | Rule                                                                                                                                   |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `query`, `delivery`, `create`, `update`, `target`, `fill`, `generate` (foreign objects) | Present → reject                                                                                                                       |
| `openshell`                                                                             | Required                                                                                                                               |
| `deadlineMs`                                                                            | Required integer, 2000..=28000 (floor lowered from 5000 by §M8.18)                                                                     |
| `gateway.name`                                                                          | 1..=64 bytes, `^[A-Za-z0-9._-]+$`                                                                                                      |
| `gateway.endpoint`                                                                      | ≤ 256 bytes, starts with `https://` or `http://`. Display and grant key only.                                                          |
| `provider.id`, `sandbox.id`                                                             | Required, 1..=128 bytes, `^[A-Za-z0-9._:-]+$`                                                                                          |
| `provider.name`                                                                         | 1..=128 bytes                                                                                                                          |
| `provider.profile`, `provider.workspace`, `sandbox.name`                                | 0..=128 bytes (may be `""`)                                                                                                            |
| `sandbox.image`                                                                         | Optional (key omitted when unknown), ≤ 512 bytes                                                                                       |
| All strings                                                                             | Valid UTF-8, no control characters (`char::is_control`). Over-length → reject, never truncate.                                         |
| `endpoints`                                                                             | Required, **1..=64** entries. Empty → reject with `"openshell credential has no bound endpoints"`.                                     |
| `endpoints[].host`                                                                      | 1..=253 bytes, lowercase, `^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$`. IPv6 literals are rejected (U8). |
| `endpoints[].port`                                                                      | Integer 1..=65535                                                                                                                      |
| `endpoints[].path`                                                                      | Optional (key omitted when none), ≤ 512 bytes                                                                                          |
| `endpoints[].source`                                                                    | `"profile"` \| `"policyBinding"`                                                                                                       |
| endpoint uniqueness                                                                     | `(host, port, path)` must be unique, otherwise reject                                                                                  |
| `policy.digest`                                                                         | Required, `^sha256:[0-9a-f]{64}$`                                                                                                      |
| `policy.advisorEnabled`                                                                 | Optional bool (key omitted when unknown). Unknown is shown as if `true`.                                                               |
| `targets`                                                                               | 1..=16 entries                                                                                                                         |
| `targets[].credentialKey`                                                               | `^[A-Za-z_][A-Za-z0-9_]{0,127}$`, unique across targets                                                                                |
| `targets[].resource`                                                                    | `"item"` \| `"secret"`                                                                                                                 |
| `targets[].id`                                                                          | Lowercase UUID, same regex as §M8.3                                                                                                    |
| `targets[].field`                                                                       | `item` → `"username"` \| `"password"`; `secret` → `"value"`. Anything else (including `"totp"`) → reject.                              |
| `client`                                                                                | Optional, as today. Diagnostic only.                                                                                                   |

#### `openshellResolve` responses

Approved, all or nothing. `values` follow `targets` order exactly:

```json
{
  "version": 1,
  "status": "approved",
  "openshell": {
    "lifetime": { "mode": "ttl", "expiresAtMs": 1791234567890 },
    "values": [
      { "credentialKey": "GITHUB_TOKEN", "value": "…" },
      { "credentialKey": "DB_PASSWORD", "value": "…" }
    ]
  }
}
```

- `lifetime.mode` is one of `"perRequest"`, `"ttl"` or `"sandboxLifetime"`.
- `lifetime.expiresAtMs` is a JSON integer of Unix epoch milliseconds. It is **required** for
  `perRequest` and `ttl` and **must be absent** for `sandboxLifetime`.
- An approved reply never carries `message`, `credential`, `item`, `secret` or `reference`.

Before writing an approved reply, desktop Rust (`build_response`, OpenShell arm) checks all of the
following. If any check fails, it writes `{"version":1,"status":"error","message":"invalid approval
payload"}` instead and zeroizes the values.

- The value keys are exactly the requested `credentialKey` set: none missing, none extra, none
  duplicated, in target order.
- Each value is 1..=16384 bytes and contains no NUL.
- `perRequest`: `now < expiresAtMs ≤ now + 125 000`.
- `ttl`: `now + 30 000 ≤ expiresAtMs ≤ now + 86 400 000 + 5 000`.
- `sandboxLifetime`: `expiresAtMs` is absent.

Any other outcome uses the existing vocabulary, with a `message` that contains no vault data:

```json
{ "version": 1, "status": "denied", "message": "Denied by user" }
```

The statuses are `denied`, `notFound`, `locked`, `timeout`, `rateLimited` and `error`.

How aac maps them onto the **whole** gRPC batch (the gRPC status message must not contain vault
data):

| Wire status                                                                | gRPC code             |
| -------------------------------------------------------------------------- | --------------------- |
| `denied`                                                                   | `PERMISSION_DENIED`   |
| `timeout`                                                                  | `DEADLINE_EXCEEDED`   |
| `locked`                                                                   | `UNAVAILABLE`         |
| `rateLimited`                                                              | `RESOURCE_EXHAUSTED`  |
| `notFound`, `error`, connection refused or missing socket, malformed reply | `FAILED_PRECONDITION` |

A missing or refused socket gets the message `"Bitwarden desktop is not running or the OpenShell
integration is off"`.

#### `openshellHello` (value-free driver liveness)

Request:

```json
{
  "version": 1,
  "op": "openshellHello",
  "openshell": { "gateway": { "name": "openshell", "endpoint": "https://127.0.0.1:17670" } },
  "client": { "name": "aac-openshell-driver", "version": "<CARGO_PKG_VERSION>" }
}
```

- `openshell` may contain only `gateway`, validated as above.
- After the attestation precheck (§M8.5) passes, the reply is `{"version":1,"status":"approved"}`.
  The request is never dispatched to the handler, touches no vault data and opens no dialog.
- Desktop emits `AgentAccessEvent{kind:"openshellDriverSeen", timestampMs}` with no other fields.
  Main keeps only the last-seen timestamp.
- aac sends it once at driver start and ignores any failure.

#### Socket paths and timeouts

|                            | Path                                       | Notes                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Desktop OpenShell listener | `~/.bitwarden-agent-access-openshell.sock` | Mode 0600, stale file unlinked on bind. Computed in main, never taken from the renderer. aac override: `AAC_OPENSHELL_SOCKET` env var or `--desktop-socket`.                                                       |
| Driver socket              | `~/.bitwarden-openshell-driver.sock`       | Bound by aac at the gateway-supplied `--bind-socket` path, mode 0600, stale file unlinked. The parent directory must be owned by the current uid and not group- or world-writable, otherwise aac refuses to start. |

Timeouts:

- aac reads the desktop reply with a timeout of `deadlineMs + 2000` ms. It does not use the 120 s
  CLI default.
- The aac driver deadline for the whole `ResolveCredentials` call is 27 s, under the gateway's
  30 s, or the incoming `grpc-timeout` minus 3 s when that is shorter (§M8.18). `deadlineMs` is
  what is left of that budget minus 1 s, capped at 25 000. Below 2000 aac fails
  `DEADLINE_EXCEEDED` without contacting desktop; at or above it, it sends.
- Desktop dispatches with `min(CALLBACK_TIMEOUT, deadlineMs)`, and drops the dispatch (writing
  nothing) if aac hangs up first (§M8.18).
- The dialog countdown is the coalesced dialog's lifetime (§M8.18): the request's decision
  deadline plus a 15 s linger, extended when an identical retry attaches, capped at 60 s after
  opening. It auto-closes (`timeout`) at 0. Each request still answers by its own deadline.

### M8.5 Identity, attestation precheck, rate limiting

**Attestation precheck** runs in desktop Rust, on the OpenShell listener only, after `attest_peer`
and before dispatch. It can only deny, never approve. If it fails, the reply is
`{"version":1,"status":"error","message":"OpenShell gateway could not be verified"}` and nothing is
dispatched. Checks:

1. `peer.exe_path` canonical file name is exactly `aac`, or exactly one of the dev-build artifact
   names `aac.darwin-arm64`, `aac.darwin-x64`, `aac.linux-x64`, `aac.linux-arm64` (§M8.18). No
   prefix, suffix or glob matching.
2. `peer.parent` is resolved (`Some`), and its canonical exe file name is exactly
   `openshell-gateway`. There is no fallback to aac's own identity.
3. `peer.parent.signature` (or the signature field the existing code attests) is present.

This requires the snippet's `command` form, where the gateway spawns aac. A driver started any other
way has launchd, systemd or a shell as its parent and fails closed.

**Origin** comes from `ListenerKind::OpenShell`, never from the wire. It is
`CredentialRequestOrigin::OpenShell` in Rust and the string `"openshell"` in napi and TS.

**Rate limiting and concurrency** (desktop Rust, OpenShell listener):

- Per `provider.id`, only requests with one identical coalescing key may be in flight (at most 4;
  §M8.18). A concurrent request for that provider with any other key gets `rateLimited`
  immediately.
- After a `denied` outcome, or a dispatch the renderer never answered (Rust's own timeout), for
  `(sandbox.id, provider.id)`, every request for that pair gets `rateLimited` without dispatch for
  60 s. A renderer-reported `timeout` no longer starts it (§M8.18): it only means that request's
  deadline passed while the dialog may still be open for the next retry. Retry spam is now bounded
  by the renderer's coalescing.
- The existing `MAX_CONCURRENT_CONNECTIONS` cap applies per listener.

**Sandbox attribution (fail closed).** `ResolveCredentialsRequest` carries no sandbox id
(`proto/credential_driver.proto:98-112`). aac therefore derives the sandbox from the read-only
gateway API:

- `ListSandboxes` + `ListSandboxProviders` must find **exactly one** sandbox with `provider_id`
  attached.
- 0 or ≥ 2 sandboxes → `FAILED_PRECONDITION "bitwarden: provider must be attached to exactly one
sandbox"`, and desktop is never contacted.
- A batch that spans more than one `provider_id` fails the same way.
- Any lookup error, auth error or lookup timeout (3 s per RPC) fails closed the same way.

**Gateway auth for aac's lookups** (`--gateway <name>`):

- aac reads `<cfg>/gateways/<name>/metadata.json` (`gateway_endpoint`, `auth_mode`).
- `<cfg>` is `--openshell-config-dir`, else `$XDG_CONFIG_HOME/openshell`, else
  `~/.config/openshell`.
- `auth_mode == "mtls"`: aac uses `mtls/{ca.crt,tls.crt,tls.key}` as a rustls client. The key bytes
  are held in `Zeroizing<Vec<u8>>` and never logged.
- `auth_mode == "plaintext"`: allowed only when the endpoint host is `127.0.0.1`, `::1` or
  `localhost`.
- Anything else (`cloudflare_jwt`, OIDC, unknown, missing) → fail closed with `"unsupported gateway
auth mode"`.
- aac makes no write RPCs, ever.

**Endpoint set.** aac computes it as the union of two sources, deduplicated by `(host, port, path)`
with `profile` winning ties:

- the profile endpoints from `GetProviderProfile`, with `source:"profile"`;
- the effective-policy endpoints from `GetSandboxPolicyStatus` whose
  `credential_binding.provider == provider.name`, with `source:"policyBinding"`.

Hosts are lowercased. An empty set fails closed in aac, before desktop is asked.

**Policy digest** (pinned algorithm; both sides implement it):

1. For each endpoint, form the line
   `host + "\t" + decimal(port) + "\t" + (path ?? "") + "\t" + source + "\n"`.
2. Sort the lines by byte order.
3. Concatenate them.
4. SHA-256 the UTF-8 bytes.
5. The digest is `"sha256:" + lowercase hex`.

aac computes it with workspace `sha2`. The renderer recomputes it with the existing
`CryptoFunctionService.hash(canonical, "sha256")`. A mismatch gives an `error` reply with no dialog.
This is a fingerprint, not new encryption logic.

Test vectors:

| Endpoints (any order)                                                              | Digest                                                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `api.github.com 443 /** profile`                                                   | `sha256:998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020` |
| `api.github.com 443 /** profile`, `uploads.github.com 443 <no path> policyBinding` | `sha256:f098164656d916d933b9ad3ea24ce0c43cc84aa04300528a4e2e6ec2844e582d` |

**Grant key** (`models/agent-access-grant.ts`):

```ts
export const AgentAccessGrantScope = Object.freeze({
  AllLogins: "allLogins",
  OpenShellSandbox: "openshellSandbox",
} as const);

export interface AgentAccessOpenShellGrantKey {
  gatewayEndpoint: string;
  sandboxId: string;
  providerId: string;
}

export interface AgentAccessGrantKey {
  signatureKind: string;
  signatureIdentity: string;
  openshell?: AgentAccessOpenShellGrantKey;
}

export interface AgentAccessOpenShellGrantDetails extends AgentAccessOpenShellGrantKey {
  gatewayName: string;
  sandboxName: string;
  providerName: string;
  policyDigest: string; // "sha256:<64 hex>"
  lifetimeMode: OpenShellLifetimeMode;
  windowExpiresAtMs?: number; // ttl mode only: end of the current approval window
}

export interface AgentAccessGrant /* existing fields */ {
  openshell?: AgentAccessOpenShellGrantDetails;
}

export interface UpsertAgentAccessGrantInput /* existing fields */ {
  openshell?: AgentAccessOpenShellGrantDetails;
}
```

Grant store rules:

- `deriveAgentAccessAttestationKey(localPeer, openshell?)` returns the attested gateway identity
  (the parent signature kind and identity) plus `{gatewayEndpoint, sandboxId, providerId}` when
  `openshell` is given.
- `matchesKey` requires `openshell` to be present on both sides or absent on both, and all three
  OpenShell fields to be equal. So a plain-local grant never satisfies an OpenShell request, and
  the reverse is also true.
- `policyDigest` is **not** part of the key. A digest change selects the `policyChanged` dialog mode
  (§M8.6).
- `UPSERT_GRANT` validation in main (the renderer is untrusted):
  - `scope === "openshellSandbox"` if and only if `openshell` is present.
  - Every string field is checked for type and length, using the same limits as §M8.4.
  - `policyDigest` must match `^sha256:[0-9a-f]{64}$`.
  - `lifetimeMode` must be one of the three modes.
  - `windowExpiresAtMs` must be a finite integer, and only when `lifetimeMode === "ttl"`.
- **A grant is the right to ask.** Every credential load gets a human decision in the approval
  dialog. The grant only selects the dialog mode. Identical retries and the second resolve of the
  same load share one decision (§M8.18); nothing else does.

### M8.6 Approval lifetime (user decision 2)

OpenShell has **no per-HTTP-request credential hook** that can supply a value:

- Supervisor middleware runs per request but cannot write credential headers
  (`docs/extensibility/supervisor-middleware/`).
- `token_grant` needs SPIRE.

The driver is asked only when a supervisor loads its provider environment: at sandbox start, and
when the provider-env revision changes. What Bitwarden _can_ control is the `expiration_time` on
each released value.

What the source shows:

- The gateway drops an already-expired value at resolve time (`credentials.rs:708-742`).
- The gateway forwards `credential_expiration_times` to the supervisor (`proto/openshell.proto:2626-2639`).
- The supervisor's placeholder resolver refuses an expired value at injection time
  (`crates/openshell-core/src/secrets.rs:688-692`).

These were read from the source but not exercised live (U3). Nothing shows that the supervisor
**erases** an expired value from memory, or **re-fetches** when it expires. Bitwarden assumes
neither.

| Mode (setting value)                            | What one approval releases                                                                 | `expiresAtMs` sent     | UI label (truthful)                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------ |
| `perRequest`                                    | One environment load. Every load (sandbox start, provider change) asks again.              | `approvedAt + 120 000` | "Each time the sandbox loads it: usable for 2 minutes after you approve" |
| `ttl` (`ttlMinutes` ∈ {15, 60, 240, 480, 1440}) | Use until the window ends. Re-loads inside the window still ask, but **do not extend** it. | Window end (see below) | "For a set time: <duration> after you approve"                           |
| `sandboxLifetime`                               | Use until the sandbox stops or its provider config revision changes                        | absent (no expiration) | "Until the sandbox stops or its provider settings change"                |

**`perRequest` is the closest honest equivalent, not true per-request (U2).**

- OpenShell cannot ask per HTTP request, so "each request" means each credential load. Precisely
  (§M8.18): one load is one human decision. Its identical retries (while the dialog is open, or
  within 60 s of an undelivered decision) and OpenShell's second resolve of the same load (an
  identical-key resolve within 10 s of a delivered approval) share it. Any other resolve asks again.
- The 2-minute window covers the supervisor installing the value after the up-to-25 s approval, and
  then expires it.
- Fallback if U3 fails live (the supervisor ignores expiry): this mode degrades to
  `sandboxLifetime`. The label and the U2/U3 notes must then be changed to say so before release.
  The human gate per load still holds.

**TTL window rules** (renderer, `AgentAccessOpenShellService`):

- If the matching grant has `lifetimeMode === "ttl"`, `windowExpiresAtMs > now + 30 000` and an
  unchanged `policyDigest`:
  - the dialog mode is `previouslyApproved`;
  - on approve, the reply carries `expiresAtMs = windowExpiresAtMs` (not extended).
- Otherwise:
  - the dialog mode is `windowExpired`, `firstRequest` or `policyChanged`, and requires the inline
    acknowledgement (a fresh approval);
  - on approve, a new window opens: `expiresAtMs = now + ttlMinutes·60 000`, persisted as
    `windowExpiresAtMs`.
- Desktop never serves a resolve after expiry without a new dialog. No layer caches values: not the
  renderer, not main, not Rust and not aac. So "refuses re-resolve after expiry" holds by
  construction.
- Dialog copy states that after expiry the sandbox must reload credentials (a restart, or
  `openshell provider update`) to ask again, and that Bitwarden cannot confirm the sandbox discards
  the old value.

**Default: `ttl` with `ttlMinutes = 60`.**

- `sandboxLifetime` leaves a released value usable indefinitely, while the policy behind it can
  grow after approval (Advisor, `UpdateConfig`, U5).
- `perRequest` expires in 2 minutes, which breaks normal long-running agent sessions and teaches
  users to approve without reading.
- A 1-hour window bounds exposure to a single working session. It relies only on gateway and
  supervisor expiry behaviour visible in the source, and it still requires a human approval for
  every load.

Settings (`platform/services/desktop-settings.service.ts`, `KeyDefinition` on
`DESKTOP_SETTINGS_DISK`, the same pattern as `AGENT_ACCESS_ENABLED`):

```ts
export type OpenShellLifetimeMode = "perRequest" | "ttl" | "sandboxLifetime";
export interface OpenShellApprovalLifetime { mode: OpenShellLifetimeMode; ttlMinutes: 15 | 60 | 240 | 480 | 1440 }

AGENT_ACCESS_OPENSHELL_ENABLED: KeyDefinition<boolean>                      // key "agentAccessOpenShellEnabled", default false
AGENT_ACCESS_OPENSHELL_APPROVAL_LIFETIME: KeyDefinition<OpenShellApprovalLifetime>
                                                                            // key "agentAccessOpenShellApprovalLifetime",
                                                                            // default { mode: "ttl", ttlMinutes: 60 }
agentAccessOpenShellEnabled$: Observable<boolean>;           setAgentAccessOpenShellEnabled(v: boolean): Promise<void>;
agentAccessOpenShellApprovalLifetime$: Observable<OpenShellApprovalLifetime>; setAgentAccessOpenShellApprovalLifetime(v): Promise<void>;
```

When read, an invalid persisted lifetime value is coerced to the default. `OpenShellLifetimeMode`
and `OpenShellApprovalLifetime` live in `models/openshell.ts`. The settings service imports them
from there.

### M8.7 Rust and napi surface (clients)

`callbacks.rs` (all re-exported from `lib.rs`):

```rust
pub enum CredentialRequestOrigin { Relay, Local, OpenShell }
pub enum RequestOperation { /* existing */, ProviderResolve }
pub struct OpenShellEndpoint { pub host: String, pub port: u16, pub path: Option<String>, pub source: OpenShellEndpointSource }
pub enum OpenShellEndpointSource { Profile, PolicyBinding }
pub struct OpenShellContext {
    pub deadline: Duration, pub gateway_name: String, pub gateway_endpoint: String,
    pub provider_id: String, pub provider_name: String, pub provider_profile: String, pub workspace: String,
    pub sandbox_id: String, pub sandbox_name: String, pub sandbox_image: Option<String>,
    pub endpoints: Vec<OpenShellEndpoint>, pub policy_digest: String, pub advisor_enabled: Option<bool>,
}
pub enum ProviderField { Username, Password, Value }
pub struct ProviderTarget { pub credential_key: String, pub resource: ResourceKind /* Credential|Secret */, pub id: String, pub field: ProviderField }
pub enum OpenShellLifetimeMode { PerRequest, Ttl, SandboxLifetime }
pub struct OpenShellLifetime { pub mode: OpenShellLifetimeMode, pub expires_at_ms: Option<u64> }
pub struct ProviderValue { pub credential_key: String, pub value: Zeroizing<String> }  // manual Debug: key only
pub struct OpenShellResolution { pub lifetime: OpenShellLifetime, pub values: Vec<ProviderValue> } // manual Debug
// CredentialRequestData += openshell: Option<OpenShellContext>, provider_targets: Vec<ProviderTarget>  (manual Debug updated; value-free)
// CredentialResponseData += openshell: Option<OpenShellResolution>
// AgentAccessEvent kind "openshellDriverSeen" (timestamp only)
```

Wire `resource:"item"` maps to `ResourceKind::Credential`, and `"secret"` maps to `Secret`. For
`ProviderResolve`, `query_type` is `Id` and `query_value` carries only a value-free dispatch token
`openshell-dispatch:<n>` (§M8.18); no query rides it.
`delivery_mode` is `None`.

`local_listener`:

- `ListenerKind { Agent, OpenShell }`. `spawn(path, kind)`.
- `validate(request, kind)` gates ops per socket.
- The existing validators reject an `openshell` object as foreign.
- `client.rs` gains `start_openshell_listener(path)` and `stop_openshell_listener()`. Both are
  idempotent. `stop()` also stops the OpenShell listener.

napi (`napi/src/agent_access.rs`, mirrored in the generated `index.d.ts`; regenerate with
`npm run build-native`, never hand-edit):

```ts
export declare namespace agent_access {
  export class AgentAccessState {
    /* existing */
    /** Starts (path) or stops (null/undefined) the OpenShell listener. Idempotent. */
    setOpenShellListener(socketPath?: string | undefined | null): Promise<void>;
  }
  export const enum CredentialRequestOrigin {
    Relay = "relay",
    Local = "local",
    OpenShell = "openshell",
  }
  export const enum RequestOperation {
    /* existing */ ProviderResolve = "providerResolve",
  }
  export const enum OpenShellEndpointSource {
    Profile = "profile",
    PolicyBinding = "policyBinding",
  }
  export const enum ProviderField {
    Username = "username",
    Password = "password",
    Value = "value",
  }
  export const enum OpenShellLifetimeMode {
    PerRequest = "perRequest",
    Ttl = "ttl",
    SandboxLifetime = "sandboxLifetime",
  }
  export interface OpenShellEndpointData {
    host: string;
    port: number;
    path?: string;
    source: OpenShellEndpointSource;
  }
  export interface OpenShellContextData {
    deadlineMs: number;
    gatewayName: string;
    gatewayEndpoint: string;
    providerId: string;
    providerName: string;
    providerProfile: string;
    workspace: string;
    sandboxId: string;
    sandboxName: string;
    sandboxImage?: string;
    endpoints: Array<OpenShellEndpointData>;
    policyDigest: string;
    advisorEnabled?: boolean;
  }
  export interface ProviderTargetData {
    credentialKey: string;
    resourceType: ResourceType;
    id: string;
    field: ProviderField;
  }
  export interface CredentialRequestData {
    /* existing */ openshell?: OpenShellContextData;
    providerTargets?: Array<ProviderTargetData>;
  }
  export interface ProviderValueData {
    credentialKey: string;
    value: string;
  }
  /** expiresAtMs is a stringified u64, like timestampMs. */
  export interface OpenShellLifetimeData {
    mode: OpenShellLifetimeMode;
    expiresAtMs?: string;
  }
  export interface CredentialResponseData {
    /* existing */ openshellValues?: Array<ProviderValueData>;
    openshellLifetime?: OpenShellLifetimeData;
  }
}
```

The napi `CredentialResponseData` Debug redacts `openshellValues[].value`.

### M8.8 Main process, IPC and preload (clients)

`models/openshell.ts` (new; hand-mirrored types for the renderer and main):

```ts
export type OpenShellUnsupportedReason = "windows" | "snap" | "appImage";
export interface OpenShellGatewayInfo {
  name: string;
  endpoint: string;
  authMode: string;
  active: boolean;
  authSupported: boolean;
}
export interface OpenShellDetectionResult {
  present: boolean; // cliPath || gatewayBinaryPath || gatewayConfigPath || systemdUnitPath
  platformSupported: boolean; // darwin|linux, and no unsupportedReason
  unsupportedReason?: OpenShellUnsupportedReason;
  cliPath?: string;
  gatewayBinaryPath?: string;
  gatewayConfigPath?: string;
  systemdUnitPath?: string;
  gateways: OpenShellGatewayInfo[];
  gatewayConfigPathHint: string; // where the user should merge the snippet
}
export interface OpenShellSnippet {
  gatewayToml: string;
  providerExample: string;
  attachExample: string;
  gatewayName: string;
}
export interface SetOpenShellListenerResult {
  listening: boolean;
  refusedReason?: "notDetected" | "unsupportedPlatform" | "agentAccessNotRunning";
}
export interface OpenShellRequestContext {
  /* = OpenShellContextData, camelCase */
}
export interface OpenShellProviderTarget {
  credentialKey: string;
  resourceType: "credential" | "secret";
  id: string;
  field: "username" | "password" | "value";
}
export type OpenShellLifetimeMode = "perRequest" | "ttl" | "sandboxLifetime";
export interface OpenShellApprovalLifetime {
  mode: OpenShellLifetimeMode;
  ttlMinutes: 15 | 60 | 240 | 480 | 1440;
}
export const OPENSHELL_PER_REQUEST_WINDOW_MS = 120_000;
export const OPENSHELL_TTL_CHOICES_MINUTES = [15, 60, 240, 480, 1440] as const;
```

`main/openshell-detection.service.ts` (new). `detect(): Promise<OpenShellDetectionResult>`. It
**never spawns a process and never opens a network connection**.

- On `win32` it returns `{present:false, platformSupported:false, unsupportedReason:"windows", gateways:[]}`
  without probing anything.
- If `process.env.SNAP` is set, or `/snap/bin/openshell` is the only CLI found, the reason is
  `"snap"`.
- If `process.env.APPIMAGE` is set, the reason is `"appImage"`. The bundled aac path is an
  ephemeral mount, so it can't be a gateway `command`.
- It probes with `existsSync` / `PATH` scan, reusing `resolvePathSpec`:
  - `openshell` and `openshell-gateway` in `PATH`, `~/.local/bin`, `/usr/local/bin`, `/usr/bin`,
    `/opt/homebrew/bin` and `/opt/homebrew/opt/openshell/bin`;
  - gateway config: `$XDG_CONFIG_HOME/openshell/gateway.toml` or `~/.config/openshell/gateway.toml`,
    `/opt/homebrew/var/openshell/gateway.toml`, `/usr/local/var/openshell/gateway.toml`;
  - systemd user unit (Linux): `~/.config/systemd/user/openshell-gateway.service`,
    `/usr/lib/systemd/user/openshell-gateway.service`, `/etc/systemd/user/openshell-gateway.service`.
- It reads the client config dir (`$XDG_CONFIG_HOME/openshell` or `~/.config/openshell`):
  - `active_gateway`, and from each `gateways/*/metadata.json` **only** `gateway_endpoint` and
    `auth_mode`, each at most 64 KiB;
  - it **never** opens `mtls/*`, `edge_token` or `oidc_token.json`.
- `authSupported = authMode === "mtls" || (authMode === "plaintext" && loopback(endpoint))`.

`utils/openshell-config-snippet.util.ts` (new, pure).
`buildOpenShellSnippet({aacPath, gatewayName, driverSocketPath}): OpenShellSnippet | null`.

- Every interpolated value is a TOML basic string with `\` → `\\` and `"` → `\"`.
- A control character in any input returns `null`. Showing nothing beats showing a broken snippet.

`gatewayToml` is exactly:

```toml
[openshell.gateway]
credential_drivers = ["bitwarden"]

[openshell.credential_drivers.bitwarden]
transport = "uds"
socket_path = "<driverSocketPath>"
command = "<aacPath>"
args = ["openshell-driver", "--gateway", "<gatewayName>"]
startup_timeout_secs = 10
```

The two example commands are:

- `providerExample`: `openshell provider create --name <provider>-<sandbox> --type <profile> --credential GITHUB_TOKEN=bw://item/<item-uuid>#password`
- `attachExample`: `openshell sandbox provider attach <sandbox> <provider>-<sandbox>`

The inputs come from main:

- `aacPath` is `getBundledCliPath()`.
- `driverSocketPath` is `~/.bitwarden-openshell-driver.sock`.
- `gatewayName` is the active gateway, else the first detected gateway, else `"openshell"`.

IPC channels (`models/ipc-channels.ts`) and preload (`agent-access/preload.ts`):

| Channel constant                 | String                                     | Owner (main)                                                 | Preload method                                                                |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `DETECT_OPENSHELL`               | `"agentaccess.detectopenshell"`            | `main-agent-access-cli.service.ts`                           | `detectOpenShell(): Promise<OpenShellDetectionResult>`                        |
| `GET_OPENSHELL_SNIPPET`          | `"agentaccess.getopenshellsnippet"`        | `main-agent-access-cli.service.ts` (has `getBundledCliPath`) | `getOpenShellSnippet(): Promise<OpenShellSnippet \| null>`                    |
| `SET_OPENSHELL_LISTENER`         | `"agentaccess.setopenshelllistener"`       | `main-agent-access.service.ts` (owns `agentState`)           | `setOpenShellListener(enabled: boolean): Promise<SetOpenShellListenerResult>` |
| `GET_OPENSHELL_DRIVER_LAST_SEEN` | `"agentaccess.getopenshelldriverlastseen"` | `main-agent-access.service.ts`                               | `getOpenShellDriverLastSeen(): Promise<number \| null>`                       |

`SET_OPENSHELL_LISTENER(enabled)` behaviour:

- The argument must be a boolean, otherwise the call throws.
- On `true`, main **re-runs detection itself**. It refuses (`listening:false` with a reason) unless
  `present && platformSupported` and the agent-access server is running. Otherwise it calls
  `agentState.setOpenShellListener(getOpenShellSocketPath())`.
- On `false`, main calls `setOpenShellListener(null)`.
- Main also stops the listener when `stop()` runs.
- `getOpenShellSocketPath()` is main-owned and never takes a renderer value.

`main-agent-access.service.ts`:

- `requestCredential` forwards `origin:"openshell"`, `operation:"providerResolve"`, `openshell` and
  `providerTargets` on `CREDENTIAL_REQUEST`. It returns `openshellValues` and `openshellLifetime`
  from `CREDENTIAL_REQUEST_RESPONSE`.
- **Activity buffer for an OpenShell request stores exactly**
  `{origin:"openshell", operation:"providerResolve", sandboxId, providerId, policyDigest, targetIds: string[]}`
  plus the existing timestamp and status fields.
  - It stores no gateway, sandbox, provider or item names, no image, no endpoints and no values.
  - `agentName` comes from the existing display-name helper (the attested gateway binary).

### M8.9 Renderer (clients)

`services/desktop-agent-access.service.ts` changes:

- The local-only gate at ~`:432` becomes an **exhaustive switch on `origin`**:
  - `"relay"`: existing behaviour;
  - `"local"`: `authorizeLocalRequest`, as today;
  - `"openshell"`: `agentAccessOpenShellService.handle(message)`;
  - `default`: deny with reason `"error"`, no dialog.
- An `"openshell"` origin with any operation other than `"providerResolve"` is denied, and
  `"providerResolve"` from any other origin is denied.
- Lifecycle: `combineLatest([agentAccessEnabled$, agentAccessOpenShellEnabled$, serverRunning$])`
  drives `setOpenShellListener(a && b && running)`.

`services/agent-access-openshell.service.ts` (new; keeps the large service from growing).
`handle(message): Promise<CredentialRequestResponse>` does these steps in order. Any failure denies
or errors without a dialog unless noted.

1. If the setting is off, or the platform is not darwin/linux → reply `error` with "OpenShell
   integration is off".
2. If `message.openshell` or `providerTargets` is missing, or `localPeer.parent` /
   `localPeer.parent.signature` is missing → reply `error`.
3. Recompute the policy digest (§M8.5). On mismatch → reply `error` with "policy fingerprint
   mismatch".
4. Resolve every target **before** opening the dialog (payload built before dialog):
   - items go through the existing id lookup: login type, not deleted, a non-empty requested field;
   - secrets go through `AgentAccessSecretsService` by id;
   - an item with master-password reprompt → reply `denied` with "This item requires master
     password re-prompt and can't be used by OpenShell";
   - any miss → reply `notFound`, no dialog.
5. Look up the grant (`FIND_GRANT` with the OpenShell key). Then read the lifetime setting and pick
   the dialog mode:
   - `firstRequest` when there is no grant;
   - `policyChanged` when the grant's digest differs;
   - `windowExpired` when the grant is `ttl` and its window has ended or ends within 30 s;
   - `previouslyApproved` otherwise.
6. Open `ApproveOpenShellResolveComponent`, unless the identical request already has an open
   dialog or a carried decision (§M8.18), in which case attach to it or take it. The countdown
   follows §M8.4.
7. On approve:
   - compute the lifetime (§M8.6);
   - `UPSERT_GRANT` with scope `openshellSandbox` and the details;
   - reply `approved` with `openshellValues` in target order and `openshellLifetime`.
8. On deny, timeout or close → reply `denied` or `timeout`.

Values live only in that request's closure. They are never logged and never stored in component
state after the dialog closes.

`components/approve-openshell-resolve.component.{ts,html,spec.ts}` (new). It uses the Bitwarden
component library: `bit-dialog`, `bit-callout`, `bit-section`, `bit-item`, `bit-badge`, `bitButton`,
`bit-form-control` and `bitCheckbox`. Every Tailwind class has the `tw-` prefix.

Params:

```ts
export interface ApproveOpenShellResolveParams {
  mode: "firstRequest" | "policyChanged" | "windowExpired" | "previouslyApproved";
  gatewayIdentity: { signatureKind: string; signatureIdentity: string; exePath?: string }; // verified
  context: OpenShellRequestContext; // gateway-reported
  targets: Array<{ credentialKey: string; label: string; fieldLabel: string }>; // names resolved in renderer
  previousPolicyDigest?: string;
  lifetime: { mode: OpenShellLifetimeMode; expiresAtMs?: number };
  deadlineMs: number;
}
export type ApproveOpenShellResolveResult = "approved" | "denied" | "timeout";
```

Layout, top to bottom:

1. Title.
2. Verified gateway callout: signature kind, identity, exe path.
3. "Reported by the OpenShell gateway, not verified by Bitwarden" callout.
4. Sandbox: name, monospace id, image and workspace.
5. Gateway: name and endpoint.
6. Provider: name and profile.
7. Credentials list: env var → item name and field, or secret name.
8. Allowed endpoints: `host:port path` with a profile or policy badge.
9. Policy fingerprint: the first 12 hex characters, with the full value in `title`, and a badge for
   new / changed / unchanged. When changed, it also shows the old prefix.
10. An Advisor warning when `advisorEnabled !== false`.
11. Lifetime statement (§M8.6 label) plus the retention sentence.
12. In every mode except `previouslyApproved`, the inline first-use acknowledgement checkbox. Approve
    stays disabled until it is ticked.
13. Countdown, then Deny and Approve buttons.

`components/agent-access-setup.component.{ts,html,spec.ts}`: a new "OpenShell" `bit-section`.

- It is **not rendered** when Agent Access is off, when `!detection.present`, or on Windows.
- When `present && !platformSupported` (Snap or AppImage), it shows the reason text and **no
  toggle**.
- Otherwise it shows:
  - a toggle bound to `agentAccessOpenShellEnabled`;
  - when the toggle is on:
    - a lifetime picker (radio for the three modes, plus a TTL `bit-select` for the choices);
    - the gateway config path hint;
    - the copyable `gatewayToml` block, reusing the ManualCommand copy pattern from
      `agent-access-connect`;
    - a merge note for an existing `[openshell.gateway]` table;
    - the takeover warning;
    - the copyable provider and attach examples;
    - the one-provider-per-sandbox rule;
    - an unsupported-auth warning for any gateway with `authSupported === false`;
    - "Driver last seen", or "Driver not seen yet".
- The listener state follows the setting through the lifecycle above. The component calls nothing
  that writes files.

`components/agent-access-agents.component.{ts,html}`: OpenShell grant rows show the sandbox name,
gateway name, provider name, digest prefix and lifetime mode, with the existing remove action.

### M8.10 i18n keys (`apps/desktop/src/locales/en/messages.json`)

Placeholders follow the existing `$NAME$` convention.

| Key                                          | English message                                                                                                                                                                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agentAccessOpenShellTitle`                  | OpenShell                                                                                                                                                                                                                                    |
| `agentAccessOpenShellDesc`                   | Let OpenShell sandboxes use your Bitwarden logins and secrets. The agent inside the sandbox only sees placeholders.                                                                                                                          |
| `agentAccessOpenShellEnable`                 | Use Bitwarden as the OpenShell credential provider                                                                                                                                                                                           |
| `agentAccessOpenShellUnsupportedSnap`        | OpenShell integration isn't available for Snap installs.                                                                                                                                                                                     |
| `agentAccessOpenShellUnsupportedAppImage`    | OpenShell integration isn't available when Bitwarden runs as an AppImage.                                                                                                                                                                    |
| `agentAccessOpenShellLifetimeTitle`          | How long an approval lasts                                                                                                                                                                                                                   |
| `agentAccessOpenShellLifetimePerRequest`     | Each time the sandbox loads it: usable for 2 minutes after you approve                                                                                                                                                                       |
| `agentAccessOpenShellLifetimePerRequestHint` | OpenShell can't ask per web request. Bitwarden asks every time the sandbox loads credentials. OpenShell asks twice for each load, so a repeat of the same request within 10 seconds of your approval uses that approval. (amended by §M8.18) |
| `agentAccessOpenShellLifetimeTtl`            | For a set time after you approve                                                                                                                                                                                                             |
| `agentAccessOpenShellLifetimeTtlContinues`   | Continues your current approval for this sandbox. It is not extended.                                                                                                                                                                        |
| `agentAccessOpenShellLifetimeSandbox`        | Until the sandbox stops or its provider settings change                                                                                                                                                                                      |
| `agentAccessOpenShellTtlMinutes`             | $MINUTES$ minutes                                                                                                                                                                                                                            |
| `agentAccessOpenShellTtlHours`               | $HOURS$ hours                                                                                                                                                                                                                                |
| `agentAccessOpenShellConfigStep`             | Merge this into your gateway.toml, then restart the gateway                                                                                                                                                                                  |
| `agentAccessOpenShellConfigPathHint`         | Gateway configuration: $PATH$                                                                                                                                                                                                                |
| `agentAccessOpenShellMergeNote`              | If your file already has an [openshell.gateway] section, add the credential_drivers line to it instead of adding a second section.                                                                                                           |
| `agentAccessOpenShellTakeoverWarning`        | Bitwarden will handle every provider credential on this gateway. Credentials that aren't bw:// references will be rejected.                                                                                                                  |
| `agentAccessOpenShellProviderStep`           | Create a provider that points at a Bitwarden item or secret, then attach it to one sandbox                                                                                                                                                   |
| `agentAccessOpenShellOneSandboxRule`         | Attach each Bitwarden provider to exactly one sandbox. Requests from a provider attached to more than one sandbox are refused.                                                                                                               |
| `agentAccessOpenShellAuthUnsupported`        | Gateway $NAME$ uses an authentication method Bitwarden doesn't support. Use mTLS, or a local plaintext gateway.                                                                                                                              |
| `agentAccessOpenShellDriverLastSeen`         | Driver last connected $TIME$                                                                                                                                                                                                                 |
| `agentAccessOpenShellDriverNotSeen`          | Driver hasn't connected yet                                                                                                                                                                                                                  |
| `agentAccessOpenShellRequestTitle`           | OpenShell sandbox is requesting credentials                                                                                                                                                                                                  |
| `agentAccessOpenShellGatewayVerified`        | Requested through the OpenShell gateway on this computer                                                                                                                                                                                     |
| `agentAccessOpenShellReportedByGateway`      | The details below are reported by the OpenShell gateway, not verified by Bitwarden.                                                                                                                                                          |
| `agentAccessOpenShellSandbox`                | Sandbox                                                                                                                                                                                                                                      |
| `agentAccessOpenShellImage`                  | Image                                                                                                                                                                                                                                        |
| `agentAccessOpenShellWorkspace`              | Workspace                                                                                                                                                                                                                                    |
| `agentAccessOpenShellGateway`                | Gateway                                                                                                                                                                                                                                      |
| `agentAccessOpenShellProvider`               | Provider                                                                                                                                                                                                                                     |
| `agentAccessOpenShellCredentials`            | Credentials                                                                                                                                                                                                                                  |
| `agentAccessOpenShellAllowedEndpoints`       | Can only be sent to                                                                                                                                                                                                                          |
| `agentAccessOpenShellSourceProfile`          | Profile                                                                                                                                                                                                                                      |
| `agentAccessOpenShellSourcePolicy`           | Policy                                                                                                                                                                                                                                       |
| `agentAccessOpenShellPolicyFingerprint`      | Policy fingerprint                                                                                                                                                                                                                           |
| `agentAccessOpenShellPolicyNew`              | New                                                                                                                                                                                                                                          |
| `agentAccessOpenShellPolicyChanged`          | Changed since you last approved (was $PREFIX$)                                                                                                                                                                                               |
| `agentAccessOpenShellPolicyUnchanged`        | Unchanged                                                                                                                                                                                                                                    |
| `agentAccessOpenShellAdvisorWarning`         | This sandbox's policy may gain new destinations after you approve. Keep OpenShell Advisor auto-approve off.                                                                                                                                  |
| `agentAccessOpenShellRetention`              | The sandbox keeps these values in memory and may keep them after they stop working. The agent sees only placeholders.                                                                                                                        |
| `agentAccessOpenShellRetryNote`              | If the sandbox stops waiting before you answer, Bitwarden gives your answer to its next identical retry within 1 minute. Nothing is sent unless it asks again. (§M8.18)                                                                      |
| `agentAccessOpenShellExpiresAt`              | Stops working at $TIME$                                                                                                                                                                                                                      |
| `agentAccessOpenShellExpiryReload`           | After that, the sandbox must reload credentials to ask again.                                                                                                                                                                                |
| `agentAccessOpenShellWindowExpired`          | Your previous approval for this sandbox has expired.                                                                                                                                                                                         |
| `agentAccessOpenShellFirstUseAck`            | Allow this sandbox to request credentials from Bitwarden                                                                                                                                                                                     |
| `agentAccessOpenShellDeadline`               | Closes in $SECONDS$ seconds                                                                                                                                                                                                                  |
| `agentAccessOpenShellFieldUsername`          | Username                                                                                                                                                                                                                                     |
| `agentAccessOpenShellFieldPassword`          | Password                                                                                                                                                                                                                                     |
| `agentAccessOpenShellFieldSecret`            | Secret value                                                                                                                                                                                                                                 |
| `agentAccessOpenShellReprompt`               | This item requires master password re-prompt and can't be used by OpenShell.                                                                                                                                                                 |
| `agentAccessOpenShellGrantRow`               | $SANDBOX$ on $GATEWAY$                                                                                                                                                                                                                       |

### M8.11 Golden fixtures (byte-identical in both repos)

Each file is one line of compact JSON with a trailing `\n`, using the key order of §M8.4. The
clients copies live in `apps/desktop/desktop_native/agent_access/tests/fixtures/openshell/`. The
agent-access copies live in `crates/ap-openshell/tests/fixtures/`. The **content below is the
source of truth.** Copy it verbatim; the fixture version string is `0.0.0-fixture`.

`openshell-resolve.request.json`:

```
{"version":1,"op":"openshellResolve","openshell":{"deadlineMs":25000,"gateway":{"name":"openshell","endpoint":"https://127.0.0.1:17670"},"provider":{"id":"prov-7f3a","name":"gh-agent-1","profile":"github","workspace":"default"},"sandbox":{"id":"sbx-01J9Z6","name":"agent-1","image":"ghcr.io/example/agent:1.2"},"endpoints":[{"host":"api.github.com","port":443,"path":"/**","source":"profile"}],"policy":{"digest":"sha256:998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020","advisorEnabled":false},"targets":[{"credentialKey":"GITHUB_TOKEN","resource":"item","id":"3f1c2b9e-8a4d-4c7e-9b21-5d6f7a8b9c0d","field":"password"},{"credentialKey":"DB_PASSWORD","resource":"secret","id":"a7e2d4c1-6b3f-4e8a-9d10-2c5b6a7f8e9d","field":"value"}]},"client":{"name":"aac-openshell-driver","version":"0.0.0-fixture"}}
```

`openshell-resolve.approved-ttl.json` (the test clock is pinned to `1791230967890`, i.e.
`expiresAtMs − 3 600 000`):

```
{"version":1,"status":"approved","openshell":{"lifetime":{"mode":"ttl","expiresAtMs":1791234567890},"values":[{"credentialKey":"GITHUB_TOKEN","value":"fixture-password"},{"credentialKey":"DB_PASSWORD","value":"fixture-secret"}]}}
```

`openshell-resolve.approved-sandbox-lifetime.json`:

```
{"version":1,"status":"approved","openshell":{"lifetime":{"mode":"sandboxLifetime"},"values":[{"credentialKey":"GITHUB_TOKEN","value":"fixture-password"},{"credentialKey":"DB_PASSWORD","value":"fixture-secret"}]}}
```

`openshell-resolve.denied.json`:

```
{"version":1,"status":"denied","message":"Denied by user"}
```

`openshell-hello.request.json`:

```
{"version":1,"op":"openshellHello","openshell":{"gateway":{"name":"openshell","endpoint":"https://127.0.0.1:17670"}},"client":{"name":"aac-openshell-driver","version":"0.0.0-fixture"}}
```

`openshell-digest-vectors.json`:

```
{"vectors":[{"endpoints":[{"host":"api.github.com","port":443,"path":"/**","source":"profile"}],"digest":"sha256:998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020"},{"endpoints":[{"host":"uploads.github.com","port":443,"source":"policyBinding"},{"host":"api.github.com","port":443,"path":"/**","source":"profile"}],"digest":"sha256:f098164656d916d933b9ad3ea24ce0c43cc84aa04300528a4e2e6ec2844e582d"}]}
```

### M8.12 agent-access repo (aac): what to build

Edit or add files only. **No git operation of any kind** in that repo (it has unsaved uncommitted
work).

New crate `crates/ap-openshell` has **no dependency on ap-cli or sdk-sm**, so
`cargo test -p ap-openshell` runs without the sdk-sm sibling.

`Cargo.toml` dependencies:

- tonic (with `transport` and `tls-ring`), prost, prost-types;
- tokio (net, rt, macros, time, sync), tokio-stream (`net`), hyper-util;
- serde, serde_json, sha2 (workspace), zeroize, thiserror, tracing, clap (derive).

Build-deps: tonic-build and protox, so no system `protoc` is needed.

`build.rs`:

- compiles the vendored protos;
- uses `skip_debug` on `StoreCredentialRequest`, `ResolvedCredential` and
  `ResolveCredentialsResponse`, with hand-written redacting Debug impls for them;
- enables no message-level tracing.

`proto/` holds `credential_driver.proto`, `extension.proto`, `datamodel.proto` and the read-only
`openshell.proto` subset, plus `LICENSE` (Apache-2.0) and `NOTICE` citing upstream commit
`0bca9fb8280045224c910610cba005b7fa5a6a83`. Any file that is modified (the subset) carries a
"Modified by Bitwarden" header.

Modules:

- `handle.rs`: the §M8.3 grammar.
- `wire.rs`: §M8.4 serde types with the exact key order, a redacting Debug, and the UDS client to
  the desktop socket with the deadline-derived read timeout.
- `digest.rs`: §M8.5.
- `gateway_config.rs`: `metadata.json` plus the mTLS and loopback rules.
- `context.rs`: `trait GatewayInfo` (the five read-only lookups), its tonic implementation, and
  `build_context()` with the exactly-one-sandbox and non-empty-endpoint rules.
- `driver.rs`: the `CredentialDriver` implementation.
- `lib.rs`: `pub async fn run_driver(args: DriverArgs) -> Result<()>` and
  `pub trait DesktopResolver`.

`driver.rs` behaviour:

- `GetCapabilities` returns `{driver_name:"bitwarden", backend_kind:"bitwarden-desktop",
supports_list:false, supports_expires_at:true}`, with the `PeerMetadata`
  `implementation_name:"bitwarden-aac"` and the vendored major version.
- `StoreCredential` validates and encodes the reference. It has **no I/O**.
- `DeleteCredential` is a no-op that returns OK.
- `ListCredentials` returns `UNIMPLEMENTED`.
- `ResolveCredentials` does, in order:
  1. decode every handle;
  2. require a single provider;
  3. build the context;
  4. send one `openshellResolve`;
  5. map values back by `credential_key` to each `request_id`. Every `request_id` is answered
     exactly once.
  6. Set `expiration_time` from `lifetime.expiresAtMs`, or leave it unset for `sandboxLifetime`.
     A missing, past or incoherent lifetime gives `FAILED_PRECONDITION`.
  7. Zeroize.
     The whole call is bounded at 27 s.
- Requests are processed one at a time per driver (a mutex).

Edits to existing files:

- **Root `Cargo.toml`:** add `"crates/ap-openshell"` to `members`. This is an additive edit on top of
  the uncommitted changes.
- **`crates/ap-cli/Cargo.toml`:**
  - add the dependency `ap-openshell = { path = "../ap-openshell", optional = true }`;
  - add the feature `openshell = ["dep:ap-openshell"]`;
  - add `"openshell"` to `default`, so the aac bundled with desktop includes it.
- **`crates/ap-cli/src/command/openshell_driver.rs` (new):** a thin clap wrapper,
  `aac openshell-driver --gateway <name> --bind-socket <path> [--desktop-socket <path>] [--openshell-config-dir <dir>]`,
  that calls `ap_openshell::run_driver`. On non-Unix it exits with "openshell-driver is only
  supported on macOS and Linux".
- **`crates/ap-cli/src/command/mod.rs`:** register the subcommand behind
  `#[cfg(feature = "openshell")]`.

ap-cli keeps no wire types. They live in `ap-openshell::wire`.

Logging (aac): only `request_id`, `provider_id`, `sandbox_id`, status code and duration. Never
values, handles together with values, key material, or item or secret names.

Scope boundary: this is transport and identity context only. No Secrets Manager or vault logic is
in aac; items and secrets are resolved by desktop's existing services. Nothing goes in sdk-sm.

### M8.13 File ownership (disjoint)

**CLIENTS** (`/Users/demo/Documents/development/clients-openshell` only; never the main checkout;
no commit, no stash):

- `apps/desktop/desktop_native/agent_access/src/callbacks.rs`
- `apps/desktop/desktop_native/agent_access/src/lib.rs`
- `apps/desktop/desktop_native/agent_access/src/client.rs`
- `apps/desktop/desktop_native/agent_access/src/local_listener/mod.rs`
- `apps/desktop/desktop_native/agent_access/src/local_listener/local_protocol.rs`
- `apps/desktop/desktop_native/agent_access/tests/fixtures/openshell/*.json` (new, 6 files)
- `apps/desktop/desktop_native/napi/src/agent_access.rs`
- `apps/desktop/desktop_native/napi/index.d.ts` (regenerated only)
- `apps/desktop/src/agent-access/models/openshell.ts` (new)
- `apps/desktop/src/agent-access/models/ipc-channels.ts`
- `apps/desktop/src/agent-access/models/agent-access-grant.ts`
- `apps/desktop/src/agent-access/models/agent-access-operation.ts`
- `apps/desktop/src/agent-access/models/agent-access-activity.ts`
- `apps/desktop/src/agent-access/main/openshell-detection.service.ts` (+ `.spec.ts`, new)
- `apps/desktop/src/agent-access/main/main-agent-access-cli.service.ts` (+ spec)
- `apps/desktop/src/agent-access/main/main-agent-access.service.ts` (+ spec)
- `apps/desktop/src/agent-access/main/agent-access-grant-store.service.ts` (+ spec)
- `apps/desktop/src/agent-access/utils/openshell-config-snippet.util.ts` (+ `.spec.ts`, new)
- `apps/desktop/src/agent-access/utils/openshell-policy-digest.util.ts` (+ `.spec.ts`, new; canonical string + hex via `CryptoFunctionService`)
- `apps/desktop/src/agent-access/utils/agent-access-attestation.util.ts` (+ spec)
- `apps/desktop/src/agent-access/preload.ts`
- `apps/desktop/src/agent-access/services/desktop-agent-access.service.ts` (+ spec)
- `apps/desktop/src/agent-access/services/agent-access-openshell.service.ts` (+ `.spec.ts`, new)
- `apps/desktop/src/agent-access/components/approve-openshell-resolve.component.{ts,html,spec.ts}` (new)
- `apps/desktop/src/agent-access/components/agent-access-setup.component.{ts,html,spec.ts}`
- `apps/desktop/src/agent-access/components/agent-access-agents.component.{ts,html,spec.ts}`
- `apps/desktop/src/platform/services/desktop-settings.service.ts` (+ spec if present)
- `apps/desktop/src/locales/en/messages.json`
- `apps/desktop/src/agent-access/agent-access-architecture.md` (this section only)

Added during the clients build (still clients-only, still disjoint from AGENT_ACCESS; see
§M8.16):

- `apps/desktop/desktop_native/agent_access/src/local_listener/openshell.rs` (new: the §M8.4
  validators, the §M8.5 precheck and limiter, and the OpenShell reply builder)
- `apps/desktop/desktop_native/agent_access/src/local_listener/unix.rs` (test call site only)
- `apps/desktop/src/agent-access/components/agent-access-openshell-section.component.{ts,html,spec.ts}`
  (new: the Setup-tab "OpenShell" section, embedded by `agent-access-setup.component`)
- `apps/desktop/src/agent-access/components/agent-access-connected-agents.component.html`
  (lists local grants only)
- `apps/desktop/src/agent-access/components/agent-access-activity.component.{ts,html,spec.ts}`
  (an OpenShell row is captioned as OpenShell and shows the sandbox id)
- `apps/desktop/src/agent-access/services/agent-access-page-state.service.ts`
  (`localGrants` / `openShellGrants`)
- `apps/desktop/src/agent-access/models/credential-denial-reason.ts` (`timeout`, `locked`)
- `apps/desktop/src/platform/services/desktop-settings.service.spec.ts` (new)

**AGENT_ACCESS** (`/Users/demo/Documents/development/agent-access`; edit or add only; no git
commands):

- `Cargo.toml` (root: add workspace member only)
- `Cargo.lock` (updated by cargo only, never hand-edited)
- `crates/ap-openshell/**` (new: `Cargo.toml`, `build.rs`, `proto/**`, `src/{lib,driver,handle,wire,digest,context,gateway_config}.rs`, `tests/**`, `tests/fixtures/*.json`)
- `crates/ap-cli/Cargo.toml` (feature + optional dep only)
- `crates/ap-cli/src/command/openshell_driver.rs` (new)
- `crates/ap-cli/src/command/mod.rs` (register subcommand only)
- `plans/openshell-driver.md` (new operator note)

Nobody touches `crates/ap-cli/src/transport/local.rs`, `command/mcp.rs`, `command/run.rs`,
`sdk-sm`, or the main clients checkout.

### M8.14 Test expectations (each side asserts its half of the seam)

**ap-openshell** (`cargo test -p ap-openshell`; must run without sdk-sm):

- Handle round-trip for the three reference forms. Rejection of non-`bw://` input, `#totp`, a bad
  UUID, an empty value and trailing data. The `StoreCredential` error text contains no part of the
  input.
- `StoreCredential` never calls `DesktopResolver` (the mock panics).
- `wire`: serializing the fixture request with version `0.0.0-fixture` is **byte-equal** to
  `openshell-resolve.request.json`, and the same holds for the hello fixture. All three response
  fixtures parse. A denied response maps to `PERMISSION_DENIED`. Every status maps per the §M8.4
  table.
- Digest: both vectors in `openshell-digest-vectors.json` match, and the result is independent of
  input order.
- Context: 0 or 2 attached sandboxes → fail, 1 → ok. An empty endpoint set fails. Mixed providers
  fail. A lookup error fails. Plaintext to a non-loopback host fails, and `cloudflare_jwt` / OIDC
  fail.
- `ResolveCredentials`:
  - every `request_id` is answered exactly once;
  - a desktop denial fails the whole batch;
  - a lifetime of `ttl` sets `expiration_time` and `sandboxLifetime` leaves it unset;
  - a past or missing `expiresAtMs` fails;
  - a resolver delay over 27 s gives `DEADLINE_EXCEEDED`.
- `GetCapabilities` advertises `supports_expires_at:true`.
- Driver socket: mode 0600, and a group- or world-writable parent directory is refused.
- `format!("{:?}")` of every value-bearing type contains no value.
- A tokio integration test pairs an in-process tonic client with a fake desktop socket and asserts
  the full round trip.

**ap-cli:** `cargo check -p ap-cli --features openshell` and its tests need the sdk-sm sibling. Per
user decision 4 they are **skipped** and reported as not run. `cargo clippy -p ap-openshell
--all-targets -- -D warnings` and `cargo fmt --check -p ap-openshell` must pass.

**Desktop Rust** (`cargo test -p agent_access`, plus clippy `-D warnings` and fmt):

- Every fixture request is accepted. Every §M8.4 table row has a reject case: control characters,
  over-length strings, an empty endpoint set, duplicate endpoints, an uppercase host, `totp`, a
  wrong field for the resource, a duplicate `credentialKey`, `deadlineMs` out of range, a foreign
  object.
- Both directions of per-socket op gating are tested.
- Origin is `OpenShell` only from `ListenerKind::OpenShell`. A wire field cannot set it.
- Attestation precheck: no parent, a parent that isn't `openshell-gateway`, a peer that isn't `aac`
  and a missing signature are each rejected, with no dispatch.
- The reply builder produces byte-equal output to both approved fixtures under the pinned clock and
  to the denied fixture.
- The reply builder rejects an extra, missing, duplicated or reordered key, an empty value, a
  `perRequest` lifetime over 125 s, a `ttl` lifetime over 24 h, and `sandboxLifetime` with an
  expiry.
- Timeout clamp `min(60 s, deadline)`.
- 60 s deny cooldown and single in-flight request per provider.
- Second-listener start and stop are idempotent, and `stop()` closes it.
- Hello emits `openshellDriverSeen` with no peer fields and no dispatch.
- Debug redaction for `ProviderValue` and `OpenShellResolution`.

**napi:** conversion of the origin, operation, field, lifetime and context types. The regenerated
`index.d.ts` contains §M8.7 verbatim in shape, checked by `test:types`.

**TS main** (jest):

- Detection, with `fs` mocked: Homebrew, `~/.local/bin`, systemd unit only, config only, Snap,
  AppImage, win32 (asserts no fs probe), active versus inactive gateway. Assert that no
  `child_process` or `net` function is ever called and that no `mtls/`, `edge_token` or `oidc_token`
  path is ever read.
- Snippet: exact golden `gatewayToml`, escaping of `\` and `"`, `null` on a control character.
- `SET_OPENSHELL_LISTENER`: refuses when not detected, on an unsupported platform or when the
  server is stopped; rejects a non-boolean argument; computes the path in main.
- Grant store: `matchesKey` never cross-matches plain and OpenShell keys; any difference in
  `gatewayEndpoint`, `sandboxId` or `providerId` misses. UPSERT validation for each `openshell`
  field and the scope pairing.
- Activity buffer row for an OpenShell request has **exactly** the §M8.8 key set.

**TS renderer** (jest):

- Settings: enabled defaults to `false`, lifetime defaults to `{ttl, 60}`, and an invalid persisted
  lifetime is coerced.
- Pipeline switch: an unknown origin is denied without a dialog; `openshell` + non-`providerResolve`
  is denied; `providerResolve` from `local` is denied.
- OpenShell service:
  - setting off → error, no dialog;
  - missing parent or signature → error;
  - digest mismatch (using the vectors file) → error, no dialog;
  - a not-found target → `notFound`, no dialog;
  - a reprompt item → denied, no dialog;
  - each dialog mode is selected correctly (including a ttl window ending within 30 s →
    `windowExpired`);
  - approve returns values in target order with the correct lifetime per mode (`perRequest` =
    now + 120 000; ttl inside the window = the unchanged window end; a new ttl window = now + ttl;
    `sandboxLifetime` with no expiry) and upserts the grant;
  - deny or timeout returns no values.
- Dialog spec: the gateway-reported callout always renders; endpoints with source badges render;
  the Advisor warning shows when `advisorEnabled` is `undefined` or `true`; the acknowledgement
  checkbox gates Approve in every mode except `previouslyApproved`; the countdown starts at 24 for
  25 000 ms; the lifetime label matches the mode.
- Setup spec: hidden when not detected or Agent Access is off; no toggle on Snap or AppImage;
  toggle, lifetime picker, snippet and warnings shown when on; no IPC that writes files.

**Verification commands** (worktree; run `npm ci` first):

```
cd apps/desktop/desktop_native && cargo test -p agent_access && cargo clippy -p agent_access --all-targets -- -D warnings && cargo fmt --check
cd apps/desktop && npm run build-native
npm test -- apps/desktop/src/agent-access apps/desktop/src/platform/services
npm run test:types && npx tsc --noEmit -p apps/desktop/tsconfig.json
npm run lint:fix && npm run prettier && npx eslint apps/desktop/src/agent-access && npx prettier --check apps/desktop/src/agent-access apps/desktop/src/locales/en/messages.json
```

In `agent-access`:

```
cargo test -p ap-openshell && cargo clippy -p ap-openshell --all-targets -- -D warnings && cargo fmt --check -p ap-openshell
```

`ap-cli` is not run (needs sdk-sm).

### M8.15 UNVERIFIED OpenShell assumptions and fallbacks

| #   | Assumption                                                                                                                                                                                                       | Fallback if it is false                                                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | The gateway passes `StoreCredential.value` through unchanged, so a `bw://` string reaches the driver.                                                                                                            | The driver also accepts `bw1:` handle-shaped input. If the gateway rejects or transforms the value, the integration is disabled and the snippet copy says the gateway version is unsupported. Fail closed: no reference means no store.                                                                                                               |
| U2  | There is no per-HTTP-request credential hook. `perRequest` is approximated as "per environment load + 120 s expiry".                                                                                             | That is already the fallback. If a real hook appears upstream, the mode is re-implemented on it and the label updated.                                                                                                                                                                                                                                |
| U3  | The gateway and supervisor honour `expiration_time`: the gateway skips expired values and the supervisor refuses expired placeholders (read in `credentials.rs:708-742` and `secrets.rs:688-692`, not run live). | `perRequest` and `ttl` degrade to `sandboxLifetime` semantics. Labels must say so before release, and the per-load human gate remains. Bitwarden never claims eviction.                                                                                                                                                                               |
| U4  | The 30 s driver RPC deadline also bounds the startup `GetSandboxProviderEnvironment` path, and the supervisor tolerates a ~25 s resolve.                                                                         | **Refuted at start (live run).** The supervisor caps each startup fetch at 10 s, 5 attempts; the gateway still sends aac `grpc-timeout: 30S`, so the cap reaches aac only as a cancellation. Fixed by §M8.18: desktop detects the hang-up and coalesces the retries onto one dialog, carrying the decision to the next retry. Holds on attach/update. |
| U5  | Advisor and `UpdateConfig` can add endpoints after approval without a new resolve.                                                                                                                               | The dialog shows the Advisor warning, and the default lifetime is a 1 h ttl. Supervisor middleware (U9) is a later phase.                                                                                                                                                                                                                             |
| U6  | The gateway serves aac's read-only API lookups while its own driver RPC is outstanding (no re-entrancy deadlock), and it does not cache resolved values across environment loads beyond the expiry.              | A 3 s per-lookup timeout gives a fail-closed `FAILED_PRECONDITION`. For caching, the short `perRequest` and `ttl` expiries bound reuse, because the gateway drops expired values.                                                                                                                                                                     |
| U7  | On macOS the Homebrew `openshell-gateway` has an ad-hoc or path-only identity, and the gateway spawns `command` as a direct child.                                                                               | The precheck still requires the parent basename. If the gateway spawns through a shell wrapper, requests fail closed, and the snippet must change to a wrapper-free form before release.                                                                                                                                                              |
| U8  | Profile and policy endpoints are host + single port + optional path, with no IPv6 literals and no port ranges.                                                                                                   | aac expands multi-port endpoints into one entry per port, up to 64. Ranges over 64, IPv6 literals or unknown shapes fail closed in aac.                                                                                                                                                                                                               |
| U9  | Supervisor middleware is not needed for phase 1 (no per-HTTP-request enforcement by Bitwarden).                                                                                                                  | Phase 2 can add a middleware gate (TCP reachable from sandboxes, EdDSA JWT). Not in this build.                                                                                                                                                                                                                                                       |
| U10 | Homebrew and systemd user units run the gateway as the logged-in user, so the 0600 sockets in `~` are reachable.                                                                                                 | If the gateway runs as another user, aac can't reach the desktop socket and fails closed. Detection shows nothing special; the snippet copy names the requirement.                                                                                                                                                                                    |
| U11 | The detection paths (Homebrew `var/`, systemd unit locations) match real installs.                                                                                                                               | If they don't match, the section stays hidden (feature off, fail safe). The user can still be told the CLI paths from `PATH`. Detection never executes anything to find out.                                                                                                                                                                          |
| U12 | The `metadata.json` field names are `gateway_endpoint` and `auth_mode` (`crates/openshell-bootstrap/src/metadata.rs:15-45`).                                                                                     | An unparseable file is treated as `authSupported:false`, and aac fails closed.                                                                                                                                                                                                                                                                        |
| U13 | `GetProvider` returns the provider's `credential_handles` to an API client (the proto marks the map as internal gateway state).                                                                                  | **Refuted (live run):** `redact_provider_credentials` clears the map on every `GetProvider`/`ListProviders`. aac always takes the fallback: it skips the handle cross-check (§M8.17) and relies on the driver-socket peer check alone. When the map is present, any mismatch fails closed. §M8.18 changes none of this.                               |

### M8.16 Clients implementation notes (recorded deviations)

These are where the clients build differs from the letter of §M8.4–§M8.14. None changes the wire
bytes, the fixtures, or the aac half of the seam.

- **Secret values are fetched after approval, not before the dialog (§M8.9 step 4).** Before the
  dialog the renderer resolves each secret's existence and name by id, value-less. The value is
  fetched only after Approve, so one approved release is still exactly one server-side
  `Secret_Retrieved` event (M4c). A fetch failure after approval replies `error` and releases
  nothing. Item values are resolved before the dialog, as written.
- **ttl window reuse needs room for the dialog.** `previouslyApproved` reuses a ttl window only
  while it ends later than `now + 30 s + the remaining deadline`, so a reused window can never
  fall under the Rust builder's `now + 30 s` floor between approval and the reply. A window ending
  within 30 s is still `windowExpired`, as §M8.6 requires.
- **Deadline left at dialog time.** Main adds `receivedAtMs` to the live `CREDENTIAL_REQUEST`
  message for an OpenShell request (never to the activity row). The renderer pipeline is
  serialized, so a request can wait behind another dialog. The OpenShell service opens its dialog
  with the remaining deadline, and replies `timeout` with no dialog when less than 3 s is left.
- **Locked vault.** An OpenShell request that arrives while the vault is locked gets `locked` at
  once. It does not wait for an unlock, because the gateway's deadline (≤ 28 s) is shorter than
  the unlock wait.
- **`timeout` denial reason.** The renderer reports a dialog countdown expiry as reason
  `"timeout"`. This adds `CredentialDenialReason::Timeout` in Rust (mapped to the wire `timeout`
  on both sockets) and `"timeout"` in napi's reason mapping.
- **Dialog params.** `gatewayIdentity` gains an optional `signatureValid`. When it isn't `true`
  (path-only on Linux, or a failed signature), the verified callout also shows the existing
  "weaker guarantee" note. `lifetime` gains an optional `ttlMinutes` for the duration label. Every
  gateway-reported string is wrapped in `<bdi>`, so bidi control characters in a name can't
  reorder the text around it.
- **Service shape.** `AgentAccessOpenShellService.handle(message, userId)` returns
  `{ response, outcome, onDelivered? }`. `DesktopAgentAccessService` sends it, so the single
  response path to main is unchanged, and runs `onDelivered` only when main reports delivery
  (§M8.17).
- **napi naming.** The existing napi enum is `OperationType`, not `RequestOperation`. It gains
  `ProviderResolve = 'providerResolve'`. `CredentialRequestOrigin.OpenShell` uses an explicit
  `#[napi(value = "openshell")]`.
- **`index.d.ts`** was regenerated with the napi package's own `npm run build` (napi typegen),
  not the full `npm run build-native`. The full build also builds the bundled `aac` from the
  agent-access repo, which needs the sdk-sm sibling.
- **Reply builder.** The "OpenShell arm" of `build_response` is `openshell::build_reply`, which
  writes its own reply type with the §M8.4 key order. The agent socket's `build_response` fails
  closed for `ProviderResolve`. The serialized reply buffer is zeroized on drop.
- **Activity row on resolve.** A resolved OpenShell row keeps the §M8.8 key set and adds only
  `resolvedAtMs`. Nothing from the renderer's outcome (cipher ids, field names) is copied onto it.
- **Detection hardening.** `metadata.json` and `active_gateway` are read with `lstat`, so a
  symlinked file is refused (it could point at `mtls/*`). Relative `PATH` entries and a relative
  `XDG_CONFIG_HOME` are ignored.
- **Snippet.** `gatewayToml` is exactly the §M8.8 block, with no trailing newline.

### M8.17 Security review round 2 (binding)

Fixes from the second adversarial review. Each one tightens a rule above; none changes the wire
bytes or the fixtures.

- **Driver socket accepts only its spawning gateway (aac).** Every accepted connection on the
  driver socket is checked with the OS peer credentials (`SO_PEERCRED` on Linux,
  `getpeereid` + `LOCAL_PEEREPID` on macOS, via tokio `peer_cred`). The peer uid must equal
  `getuid()` and the peer pid must equal the `getppid()` captured at driver start. Anything else is
  dropped before tonic sees it. aac refuses to start when its parent pid is 0 or 1. This stops a
  same-uid process from laundering a `ResolveCredentials` through the real aac (whose parent passes
  the desktop precheck) and receiving the values itself.
- **Handle cross-check (aac, defence in depth).** When `GetProvider` reports
  `credential_handles`, every `(credential_key, handle)` in the batch must equal a stored handle
  with driver `bitwarden`, otherwise `FAILED_PRECONDITION "bitwarden: credential handles do not
match the provider's stored handles"`. See U13.
- **Desktop socket check (aac).** Before sending, aac requires the desktop socket path to be a
  socket (not a symlink), owned by `getuid()`, with no group or other permission bits, and the
  listening peer's uid to equal `getuid()`. Otherwise nothing is sent and the batch fails with
  `FAILED_PRECONDITION`. This closes cross-user squatting of the path while the toggle is off. A
  same-uid squatter is not distinguishable this way; same-uid code can already edit `gateway.toml`
  and is outside this layer's threat model (the human gate still applies to Bitwarden values).
- **macOS ad-hoc signatures are path-only (desktop attestation).** A signature with no certificate
  chain (ad hoc, including linker-signed and typical Homebrew builds) reports `valid:false`, and
  its identity is the canonical executable path, not the signer-chosen identifier. The OpenShell
  dialog therefore shows the weaker-guarantee note, and a binary at another path never shares the
  real gateway's grant key. This also applies to plain-local agents: an existing grant for an
  ad-hoc-signed agent stops matching and is asked for once more.
- **Hidden passwords are never released.** An item whose password the user can't view
  (`viewPassword !== true`, "Can view, except passwords") refuses a `password` target before any
  dialog, with `denied` and a value-free detail. The plain-local `request` payload omits the
  password and TOTP for such an item. Autofill (`fill`) keeps Bitwarden's existing autofill
  semantics.
- **Grant and release events only after confirmed delivery.** For an OpenShell request main
  records `replyByMs = receivedAt + min(60 s, deadlineMs) − 1 s`. `CREDENTIAL_REQUEST_RESPONSE`
  returns `true` only when the answer reached a request still pending before `replyByMs`. A later
  answer is settled as a value-free `timeout` (no values cross napi) and its activity row is marked
  denied. The renderer persists the grant (and so any new ttl window) and records release events
  only on `true`. The renderer also replies `timeout` with no values when the post-approval secret
  fetch ends after `receivedAtMs + deadlineMs − 1 s`.
- **Room for the secret fetch.** With a Secrets Manager target the dialog deadline is the remaining
  deadline minus 5 s, so its countdown ends before the fetch can outlast Rust's timeout. With item
  targets only it stays at the remaining deadline (countdown 24 for 25 000 ms).
- **`windowExpired` follows the grant.** An expired (or within-30 s) ttl grant always selects
  `windowExpired` and needs the acknowledgement, whatever the current setting; a ttl setting over
  a non-ttl grant still opens a new window the same way.
- **Truthful reused-window label.** When `previouslyApproved` reuses a ttl window, the dialog
  states only its end (`agentAccessOpenShellExpiresAt`) and the new key
  `agentAccessOpenShellLifetimeTtlContinues` ("Continues your current approval for this sandbox. It
  is not extended."), never the setting's duration. `lifetime.reusedWindow` marks this;
  `ttlMinutes` is set only when a new window opens.
- **Bundled aac includes the driver.** `desktop_native/build.js` builds `aac` with
  `--no-default-features --features openshell` on macOS and Linux (`bws` stays off), and after the
  copy runs `aac openshell-driver --help` when the binary is for the build host, failing the build
  if the subcommand is missing.

### M8.18 Live-run fixes (binding)

Three product issues found while preparing the live run against a real OpenShell 0.1.2 gateway
(`OPENSHELL-LIVE-RUN.md` §10). Each tightens or replaces a rule above; none changes the wire
bytes of the golden fixtures.

**1. Dev-build driver name (desktop precheck, §M8.5).** Packaging ships the driver as `aac`
(`electron-builder.json` `extraFiles`: macOS `Contents/MacOS/aac`, Linux `aac`, which main hard
links or copies to `<userData>/bin/aac`). An unpackaged dev build points the `gateway.toml`
snippet at the build artifact `desktop_native/dist/aac.<platform>-<nodeArch>`
(`getBundledCliPath`, `build.js`), whose name failed the `aac`-only check, so every dev request
was "could not be verified". The precheck now accepts the canonical file name (after symlink
resolution) only from the strict allowlist `AAC_EXECUTABLE_NAMES` = `aac`, `aac.darwin-arm64`,
`aac.darwin-x64`, `aac.linux-x64`, `aac.linux-arm64`, the exact `build.js` names for the two
supported platforms. No prefix, suffix or glob matching (`aac-evil`, `aac.darwin-arm64.bak`,
`aac.win32-x64.exe` and `AAC` all fail). The snippet and the precheck now agree for packaged and
dev builds on macOS and Linux; the snippet itself is unchanged.

**2. Startup deadline (U4 refuted).** At sandbox start the supervisor gives each provider
environment fetch 10 s, 5 attempts. The gateway nevertheless calls the driver with a fixed
`grpc-timeout: 30S` (`crates/openshell-server/src/credentials.rs:59` and `:1484-1494`), so the
10 s cap reaches aac only as a **cancellation** (stream reset), never as a deadline.

- _aac_ derives its whole-call budget from the incoming `grpc-timeout` minus a 3 s margin, capped
  at the existing 27 s (`call_budget`); a missing or unparseable header keeps 27 s. Against
  v0.1.2 that is still 27 s, so this only matters for a gateway that propagates a shorter
  deadline. The floor (`MIN_DEADLINE_MS`, also the desktop validator floor) drops from 5000 to
  **2000**: below it aac fails `DEADLINE_EXCEEDED` without contacting desktop; at or above it, aac
  **sends** the short deadline instead of refusing. Decision: sending is what lets a short retry
  be answered at once from a carried or just-delivered decision; desktop still never opens a
  new dialog with under 3 s left.
- _Desktop Rust_ detects the hang-up. aac never half-closes, so EOF (or an error, or more than
  64 KiB of trailing bytes) on the read side while a resolve is dispatched means aac dropped it.
  The listener then drops the dispatch, writes nothing, starts no cooldown, releases the in-flight
  slot and emits `AgentAccessEvent{kind:"openshellRequestAbandoned", detail:<dispatch token>}`.
  The token (`openshell-dispatch:<n>`, per process) rides `query_value` of that request (§M8.7).
  Main settles the matching pending request as a value-free `timeout` (also when the event
  arrives first; a bounded set of 64 early tokens covers that), so the renderer's later answer
  for it is reported **undelivered**. The event is never an activity row.
- _Desktop Rust limiter_: a renderer-reported `timeout` no longer starts the 60 s cooldown (a
  denial and a dispatch the renderer never answered still do), and per provider the in-flight
  slot admits up to 4 requests with the **identical** coalescing key (gateway name and endpoint,
  sandbox id, provider id, policy digest, sorted target set). Any other request for that
  provider is still `rateLimited`.
- _Renderer coalescing_ (`OpenShellResolveCoalescer`, owned by `AgentAccessOpenShellService`):
  - **Key** (`openShellCoalescingKey`): account id; the attested gateway signature kind,
    identity and exe path; gateway name and endpoint; sandbox id, name and image; provider id,
    name, profile and workspace; policy digest; Advisor flag; and the target set
    (`credentialKey, resourceType, id, field`) sorted. A strict superset of "(gateway, sandbox,
    provider, targets, digest)": any difference opens a new dialog. Steps 1–4 of §M8.9 (setting,
    context, digest recomputation, target resolution) still run for every request before the key
    is consulted, so a carried decision never skips a refusal.
  - **Attach.** While a dialog for a key is open, an identical request attaches to it instead of
    opening another, and each attached request replies by its own deadline (`timeout` when it
    passes). The dialog stays open until 15 s (`OPENSHELL_DIALOG_LINGER_MS`) after the latest
    attached request's decision deadline, capped at 60 s (`OPENSHELL_DIALOG_MAX_MS`) after it
    opened; the countdown is extended (never shortened) as retries attach.
  - **Carry.** A user decision is kept for its exact key for 60 s (`OPENSHELL_CARRY_WINDOW_MS`):
    an approval until its first confirmed delivery, a denial (Deny or closing the dialog) for
    the whole window. A retry inside the window is answered at once, with no dialog. An
    unanswered dialog (countdown ran out) carries nothing.
  - **Delivery.** The grant upsert (and so any new ttl window) and the release events are written
    only on a confirmed delivery (§M8.17), exactly once per decision (`markDelivered`), however
    many replies carry it. Server-side Secrets Manager retrievals still happen per released reply
    (the value is fetched for each reply, never cached).
  - **Values** are never stored: every reply resolves its items again and fetches its secrets
    again. The lifetime is fixed when the user approves (`perRequest` = approval + 120 s; a ttl
    window as §M8.6). A ttl window is reused only if it outlasts the longest span a decision can
    be used for (60 s dialog + 60 s carry + 10 s dedupe) plus the 30 s builder floor.
  - **Queueing.** The request that opened a dialog holds the serialized renderer pipeline until
    the dialog closes (after sending its own reply on time), so no other dialog stacks on it. An
    identical request whose key is already known (open dialog or carried decision) is handled at
    once outside the queue and may not open a dialog; if its dialog or decision vanished in the
    meantime it replies `timeout`.
  - **Reset.** All carried decisions are dropped and open coalesced dialogs closed (waiters time
    out, later dialog results ignored) on lock, logout, account switch, and when Agent Access or
    the OpenShell toggle goes off.
  - The dialog gains `deadlineUpdates` and states the carry in `agentAccessOpenShellRetryNote`.

**3. Double resolve.** OpenShell resolves twice per credential load (inside `UpdateProvider`,
then the supervisor; at start, two attempts). Coalescing covers simultaneous ones. In addition,
after a **delivered** approval an identical-key resolve within 10 s
(`OPENSHELL_DELIVERED_DEDUPE_MS`, measured from the delivery, never extended) is answered without
a dialog in every lifetime mode, including `perRequest`, with the same lifetime as the delivered
reply and no second grant or release event. This is the precise meaning of "each request" in
§M8.6 and in `agentAccessOpenShellLifetimePerRequestHint`.

**Residual (recorded).** Delivery is confirmed when main settles a request Rust is still waiting
for. A reply written in the instant between aac's cancellation and the listener noticing the
hang-up can still count as delivered; the window is the scheduler latency of one `select!`.

**Tests added.** Desktop Rust: allowlist accept/reject (incl. `.bak`, `-evil`, `AAC`, Windows
names), 2000 floor, identical-key coalescing up to the cap and refusal of any other key, the
coalescing key's field coverage, renderer `timeout` → no cooldown, hang-up → no reply, token
event, no cooldown, slot released. aac: `grpc-timeout` parsing, budget derivation, a 10 s caller
deadline shrinks `deadlineMs`, a short deadline above the floor is sent, below the floor desktop
is never contacted, whole call bounded by the shorter caller deadline. TS: coalescer unit spec,
key spec, service coalescing (attach, countdown extension, per-request timeout then carry, value
re-resolution, carry expiry, denial carry, unanswered carries nothing, every key difference opens
a new dialog, account isolation, delivered dedupe for 10 s only, reset, out-of-queue handling,
short-deadline retry), main abandon handling (incl. early event), pipeline hold and out-of-queue
retry, reset triggers, dialog countdown extension and retry note.

### Invariants (additive to M4–M6)

20. OpenShell ops exist only on the OpenShell socket. That socket exists only while Agent Access and
    the OpenShell toggle (default **off**) are both on, on macOS or Linux, outside Snap and AppImage.
    The agent socket rejects OpenShell ops, and the OpenShell socket rejects every other op.
21. Origin `openshell` is set by the listener kind, never by the wire. The renderer origin switch
    is exhaustive, and an unknown origin is denied.
22. Every credential load gets a human decision in an approval dialog. A grant only selects the
    dialog mode. Only the identical key may share a decision (§M8.18): retries of one load while
    its dialog is open or within the 60 s carry window, and its second resolve within 10 s of a
    delivered approval. No layer caches or re-serves a released value (values are resolved again
    for every reply), so after any expiry a new dialog is the only way to get a value again.
23. Refused before any dialog: a missing attested `openshell-gateway` parent or `aac` peer; missing
    context; zero endpoints; a sandbox attribution that is not exactly one; unsupported gateway
    auth; a policy digest that doesn't match the displayed endpoints; a missing target; a reprompt
    item; a password the user can't view.
24. Sandbox, provider, image, endpoint and policy data are always labelled as gateway-reported.
    Only the gateway process identity is labelled verified.
25. Values flow renderer → main → Rust → aac → gateway → supervisor, transiently. They are never in
    a log, the activity buffer, a grant, the gateway DB (which holds `bw1:` handles only), or the
    sandboxed agent's view (placeholders only). The activity buffer stores ids only.
26. Outside the §M8.19 setup (below), desktop never writes OpenShell files, never runs any OpenShell binary, never opens OpenShell
    credential material (`mtls/`, tokens), and never manages sandboxes. aac makes read-only gateway
    API calls only.
27. The approval lifetime label is truthful: `perRequest` is described as per credential load with
    a 2-minute window, a reused ttl window is described by its end only, and no copy claims the
    sandbox erases a value.
28. Only the `openshell-gateway` that spawned aac can call the driver socket; aac only talks to a
    private desktop socket owned by its own uid.
29. A grant (and its ttl window) and release events are recorded only for an approval that was
    delivered to a request Rust and aac were still waiting for, and exactly once per approval,
    however many coalesced replies carry it.
30. Carried and deduplicated decisions live in renderer memory only, hold no values, apply only to
    the identical coalescing key, and are dropped on lock, logout, account switch and when Agent
    Access or the OpenShell toggle goes off. Anything unexpected (no key, a vanished dialog for a
    request handled outside the queue) fails closed with a value-free timeout.

### M8.19 One-button setup (binding; supersedes the "user copies the snippet by hand" rule)

**Decision (Max, 2026-10-07):** the desktop app does the OpenShell setup itself. The user turns the
toggle on and presses **Set up OpenShell**. This reverses the earlier out-of-scope rule on
writing OpenShell files and managing the gateway, for exactly the actions below and nothing else.

What the button does (`OpenShellSetupService`, main process):

1. **Edit `gateway.toml`.** Adds the `bitwarden` credential driver table and lists it in
   `[openshell.gateway] credential_drivers`. A surgical text merge (`openshell-gateway-config.util.ts`),
   not a parse and reserialize, so comments, ordering and every other table survive. Idempotent.
   A file whose relevant settings are in a form the merge doesn't understand (multi-line or
   non-string `credential_drivers`, dotted keys under `[openshell]`, an inline `bitwarden` driver,
   duplicate tables or keys) is **left untouched** and reported as `unmergeable`; the UI then points
   at the manual snippet.
2. **Back up first.** The previous file is copied to `<gateway.toml>.bak-bitwarden-<YYYYMMDDHHMMSS>`
   (never overwriting an existing copy), then the new content is written to a sibling temp file and
   renamed over the original, keeping its permissions. A write failure leaves the original intact.
3. **Restart the gateway.** macOS: `brew services restart <name>` by absolute path, where `<name>`
   is the OpenShell service found by listing `brew services list --json` (never a hard-coded tap).
   Linux: `systemctl --user restart openshell-gateway.service`, only when detection found a
   user-level unit. Anything else is `manual`: the config is written, the UI says to restart the
   gateway, and the same watch below confirms it. No shell, a fixed `PATH`, a 60 s timeout.
4. **Confirm.** The renderer polls the driver "last seen" (`openshellHello`, §M8.4) and shows
   Connected only for a connection newer than the restart. 30 s without one shows a timeout message
   and a retry. After a failed or manual restart the watch continues, so a later manual restart is
   noticed.
5. **Remove.** The inverse merge takes the driver table and its list entry back out (with the same
   backup), then restarts the gateway.

Constraints, binding:

- The IPC channels (`GET_OPENSHELL_SETUP_STATUS`, `RUN_OPENSHELL_SETUP`, `REMOVE_OPENSHELL_SETUP`)
  take **no arguments**. Every path, command and service name is chosen in main: the config path from
  detection, the `command` is the bundled `aac`, the socket path is the fixed home-relative one.
- Only these writes and commands exist: read/copy/rename on the one `gateway.toml` and its backup
  siblings; the two restart commands above. No sandbox is started, stopped or attached, no OpenShell
  API is called and no OpenShell binary other than the service manager is run.
- Setup is unavailable (and the button disabled) on Windows, Snap, AppImage, and when there is no
  bundled `aac`, exactly as the toggle is.
- Provider creation and sandbox attach stay manual (the commands in the "Provider and attach"
  block). A guided form for them (vault-item picker, sandbox dropdown) is a later phase.
- Test seam: filesystem and process execution are injected, so specs never touch a real gateway
  config or run a real command.
- Unverified: whether a missing `gateway.toml` should also carry `[openshell] version = 2`. The
  merge creates only the two tables it owns; a gateway that requires the version key would reject a
  file created from scratch (the usual case is an existing file, which keeps its own).

### M8.20 OpenShell management page (binding)

**Decision (Max, 2026-10-07, FINAL):** a new **OpenShell** tab under Agent access gives complete
management of sandboxes and of the vault credentials each one can use. "Complete" means: list,
**create**, **start**, **stop** and **delete** sandboxes; list, **add** and **remove** the
credentials (providers) available to each sandbox, picking vault items and Secrets Manager secrets.
This widens §M8's out-of-scope line on managing sandboxes and §M8.19's list of allowed commands, for
exactly the operations below.

Contract file: `models/openshell-management.ts` (types, validators, `buildBitwardenReference`, the
`OpenShellManagementResult<T>` envelope). Channel names: `ipc-channels.ts`
`OPENSHELL_*` (management). Preload methods on `ipc.agentAccess`, same names as the table:

| Preload method                            | CLI (always `-o json` for reads, `--gateway <name>`)                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `listOpenShellSandboxes()`                | `sandbox list` then one `sandbox provider list <name>` per sandbox for `providerCount`                                                         |
| `openShellSandboxAction({action,name})`   | `sandbox start\|stop <name>`; `sandbox delete <name>`                                                                                          |
| `createOpenShellSandbox(request)`         | `sandbox create --detach --name=… --from=… --cpu=… --memory=… --provider=…` (`--detach`: without a command the CLI opens an interactive shell) |
| `listOpenShellProfiles()`                 | `provider list-profiles`                                                                                                                       |
| `listOpenShellCredentials({sandboxName})` | `sandbox provider list <name>`, merged with the managed-binding store                                                                          |
| `addOpenShellCredential(request)`         | `provider create --name --type <profile> --credential ENV=bw://…` then `sandbox provider attach`                                               |
| `removeOpenShellCredential(request)`      | `sandbox provider detach`, then `provider delete` if `deleteProvider` and managed                                                              |
| `getOpenShellApplyStatus({sandboxName})`  | `sandbox provider status <name> <provider>` for each attached provider (at most 8); `applied` only when all are                                |

Binding rules:

1. **Main builds every argument list.** The renderer sends only the typed request objects above.
   Each string is validated with the contract validators in main (no leading `-`, no whitespace, no
   shell metacharacters), then passed as one `--flag=value` argument or a bare validated positional.
   No shell, no string interpolation into a command line, a fixed `PATH`, a 60 s timeout for
   mutating commands and 15 s for reads. `openshell` is run by the absolute path detection found.
2. **Never a value.** The `bw://` reference is built in main from a validated id and field
   (`buildBitwardenReference`). Credential values are not read, logged, stored or returned. CLI
   stderr is scrubbed (any `bw://` reference, and anything shaped like a token) and truncated before
   it reaches the renderer or a log.
3. **Managed-binding store.** The gateway strips vault references when reporting a provider
   (§M8.18), so main keeps its own record of what it created: provider name, sandbox, env var,
   resource type, id, field and the item's display name at the time, **and the gateway name**. Ids
   and names only, never values, in a JSON file under `userData` written atomically. Every lookup
   and removal (`isManaged`, `getForSandbox`, `upsert`, `removeProvider`, `removeSandbox`) matches
   the gateway too, so the same names on another gateway are never treated as managed. An entry
   without a gateway (an older file) matches nothing: unmanaged for everything (fail closed). A
   provider that is not in the store is shown as **unmanaged** (name and profile only) and is never
   deleted by this app. Labels have control, bidi-control and zero-width characters (U+200B-U+200F,
   U+202A-U+202E, U+2066-U+2069, U+FEFF) stripped when built and when loaded.
4. **No live gateway in tests.** Process execution and the store's filesystem are injected, exactly
   as in `OpenShellSetupService`. No spec runs the real `openshell`.
5. **Destructive actions confirm.** Delete sandbox, remove credential and delete provider each go
   through `DialogService.openSimpleDialog` in the renderer before the IPC is sent. Delete-sandbox
   names the workspace loss in its copy.
6. **Availability.** Same gate as the toggle: not on Windows, Snap or AppImage, and the page only
   appears when OpenShell is enabled in Agent Access and set up (§M8.19 `configured`). The gate
   also requires the Agent Access OpenShell toggle to be **on**: `OpenShellEnabledState`
   (`main/openshell-enabled-state.ts`) is one instance, constructed in `main.ts` and shared by
   `MainAgentAccessService` (which sets it true only once the listener has started, false on
   disable, on stop and when the server is started again) and the management service. Every IPC
   returns `unsupported` when the gate fails.
7. **Data trust.** Sandbox names, phases, endpoints and profile text are gateway-reported and shown
   as text only, never as markup, never used to build a path or a command without re-validation.
8. **Unverified (U14):** the JSON shape of `provider get` / `sandbox provider list` with attached
   providers could not be captured (none exist on the dev gateway). Parse defensively: accept a
   provider as a bare name string or an object with `name`, optional `type` / `profile`; ignore
   unknown fields; an unparseable list is `failed`, not an empty list.

9. **Inputs, tightened.** `--from` is an OCI image reference only (`[host[:port]/]repo[/repo][:tag]`
   or `@sha256:<64 hex>`; lowercase repository path, tag `[A-Za-z0-9_][A-Za-z0-9._-]{0,127}`): no
   `..`, no leading `/` or `.`, no `.tar`/`.tgz`/`.tar.gz`. `addCredential` fetches
   `provider list-profiles` and requires the profile id to exist and every binding's env var to be
   one that profile's credentials declare; independently, `LD_PRELOAD`, `LD_LIBRARY_PATH`,
   `DYLD_*`, `NODE_OPTIONS`, `NODE_PATH`, `PATH`, `HOME`, `SHELL`, `IFS`, `BASH_ENV`, `ENV`,
   `PYTHONPATH`, `PYTHONSTARTUP`, `RUBYOPT`, `PERL5OPT`, `JAVA_TOOL_OPTIONS`, `HTTP_PROXY`,
   `HTTPS_PROXY`, `ALL_PROXY` and `NO_PROXY` (case-insensitive) are `invalidInput` even if a
   profile declares them.
10. **Provider delete is conservative.** Before `provider delete` main confirms that no other
    sandbox on the gateway has the provider (`sandbox list`, then `sandbox provider list` for each,
    at most 50 sandboxes). When that cannot be confirmed it only detaches and returns ok.
11. **Scrubbing.** Every message path (stderr and the apply-status detail) uses
    `scrubOpenShellMessage`: `bw://` references, runs of 20+ token characters, 16+ hex runs and any
    run of 12+ non-space characters mixing letters and digits become `[removed]`.
12. **Files.** The registry and `gateway.toml` are replaced through a sibling temp file with a
    random suffix and flag `wx`, the target is `lstat`ed and a symlink or non-regular file is
    refused (never written through), and the mode is set with `chmod` (registry `0o600`;
    `gateway.toml` keeps its mode, `0o644` for a new file).
13. **Process execution.** `killSignal: "SIGKILL"` on timeout; a mutation that times out is
    `failed` ("The command timed out; check the sandbox's state before retrying."), not
    `gatewayUnreachable` (reads may be). Fixed `PATH` is `/opt/homebrew/bin:/usr/bin:/bin`. An
    `openshell` binary that is group- or world-writable, or whose directory is world-writable, is not
    run (`failed`, "The openshell binary location is writable by other users."). A group-writable
    directory is allowed: Homebrew installs `bin` as `drwxrwxr-x user:admin`. Gateway-reported strings are
    truncated (phase 64, id 128, name 64, createdAt 64, profile display name 120, description 300,
    host 255). `listSandboxes` counts providers for the first 50 sandboxes only (concurrency 4);
    apply status asks at most 8 providers.
14. **Permission profiles (gateway-wide).** `createProfile`, `updateProfile` and `deleteProfile`
    change provider profiles, which belong to the gateway, not to a sandbox: an edit applies to every
    sandbox that uses the profile. Only custom profiles (`source: user`, `editable` in the contract)
    are touched; `updateProfile` and `deleteProfile` run `profile export <id> -o json` first and
    refuse anything else (`unsupported`). Inputs are validated before any process: id as a resource
    name; hosts as hostnames with at most a leading `*.` (never a bare `*`, scheme, path or port);
    ports 1-65535; access `read-only`/`read-write`; programs absolute paths without `..`, whitespace
    or control characters (at most 20, endpoints at most 50); the same host and port with two
    different access levels is `invalidInput`; display text loses control and bidi characters. An
    update changes only name, description, endpoints and programs of the exported profile: an
    endpoint with the same host and port keeps its other fields (protocol, enforcement, TLS), a new
    one gets `rest`/`enforce`, and every other field including `resource_version` is kept. `create`
    adds one bearer-token credential (`api_token`, `Authorization`), refuses an id that already
    exists (import would replace it) and imports at platform scope; `--global` is passed to
    lint/update/delete only when the exported profile's scope is `platform`. The profile JSON is
    written to a fresh `0700` directory as a `wx` `0600` file with a random name, checked with
    `profile lint --file` (create only: `lint` refuses an id that already exists, so an update is not
    linted; the live test of 2026-10-07 confirmed `update` accepts the exported JSON including
    `resource_version`, `source` and `scope`, and that `import`, `update` and `delete` all work with
    `--global` on a platform-scoped profile), applied, and always removed. A lint rejection is
    `invalidInput` with the scrubbed reason. The profile file holds no credential value. Widening what a permission allows
    is confirmed in the renderer (naming the sandboxes affected); main enforces only the validators
    and the user-source rule.

15. **Open a shell and port forwards (per sandbox, route `ports`, header button "Open").** Six
    channels, all through `OpenShellPortsService` (`main/openshell-ports.service.ts`, contract
    `models/openshell-ports.ts`, saved list `main/openshell-saved-ports.service.ts`), all with the
    §M8.20 gate (`unsupported` unless the toggle is on and OpenShell is set up), the result envelope,
    argument arrays only, a fixed `PATH`, the same binary-location check, scrubbed messages, and no
    throw across IPC. The renderer sends a sandbox name, a port number, and a name to remember; never
    a path, a command, an address, a URL or a bind address.
    - `listOpenShellForwards({sandboxName})` -> `openshell forward list --gateway=<g> -o json`
      (read, 15 s). Parsed defensively (a list, or `{forwards: []}`; `sandbox`/`sandbox_name`/`name`,
      `port`/`local_port`/`local` as `[bind:]port`, `bind_address`, `pid`) and filtered to the sandbox.
      Unparseable output, or a non-empty list that never names a sandbox, is `failed`, not empty.
    - `startOpenShellForward({sandboxName, port})` -> `openshell forward start --gateway=<g>
--background 127.0.0.1:<port> <sandbox>`; `stopOpenShellForward` -> `forward stop --gateway=<g>
<port> <sandbox>`. Ports are integers 1-65535 (`isOpenShellPort`), the sandbox a resource name.
      The bind address is always the literal `127.0.0.1`: `0.0.0.0` is not offered and a caller-supplied
      address is ignored. The CLI forwards the same port number locally and in the sandbox, so the UI
      has one port field, not a local/target pair. The renderer re-lists after every start or stop
      rather than assuming it worked, and flags (badge "Open to network") a forward the CLI reports as
      bound to anything other than loopback, e.g. one started outside the app.
    - `openOpenShellShell({sandboxName, action})`: `copyCommand` only builds the text
      `<openshell> sandbox connect --gateway=<g> <sandbox>` (each word single-quoted only when it is
      not plainly safe) and runs nothing; the renderer copies it. `openTerminal` is macOS only
      (`unsupported` elsewhere, and the menu item is hidden): main writes
      `#!/bin/sh` / `rm -rf -- "$(dirname -- "$0")"` / `exec <command>` to a `.command` file, mode
      `0700`, in a fresh `mkdtemp` `0700` directory (random name, `wx`), and runs `/usr/bin/open -a
Terminal <file>` (argument array, no shell, no AppleScript, so there is nothing to escape beyond
      the POSIX quoting of the command). The script deletes its own directory first thing; main also
      deletes it after 60 s, or at once when the launch fails. A CLI path with control characters is
      refused. The command holds a path, a gateway name and a sandbox name; no credential.
    - Saved ports: `getOpenShellSavedPorts` / `setOpenShellSavedPorts({sandboxName, ports})` keep
      `{port, name}` per gateway and sandbox in `userData/openshell-saved-ports.json` (version 1, atomic
      write, `0600`, never through a symlink, tolerant read like the credential registry). At most 20
      per sandbox and 500 entries in all; duplicate ports collapse; the friendly name loses control,
      bidi and zero-width characters (same cleaner as credential labels) and is cut to 40. "Start all
      saved" starts, one by one and stopping at the first failure, the saved ports that are not already
      forwarded. Saved entries for a deleted sandbox are not removed (harmless, capped).
    - "Open in browser" opens `http://localhost:<port>` (port validated by `openShellForwardUrl`) with
      `PlatformUtilsService.launchUri`, the same path the other Agent Access pages use for external
      links. The "Ports" tab count is kept by `AgentAccessOpenShellPortsCountService` (numbers only,
      renderer memory), seeded once per sandbox by the sandbox page and updated by the tab.
    - **Verified (read-only, openshell 0.1.2, 2026-10-07):** `forward list -o json` prints `[]` and the
      table form prints `No active forwards.` with none; `forward start [OPTIONS] <PORT> [NAME]` takes
      `[bind_address:]port` and `-d/--background`; `forward stop <PORT> [NAME]`; `forward service
--target-port N --local [bind:]port [NAME]` can map to a different local port but has no
      background flag, so it is not used; `sandbox connect [NAME]` opens an interactive shell and
      `--gateway` is accepted.
    - **Unverified:** the JSON of a non-empty `forward list` (no forward was created: starting one
      would have touched the shared gateway), so the field names above are guesses with fallbacks;
      what `forward start --background` prints and returns on a busy port (error mapping is by
      message text, defaulting to `failed`); that `sandbox connect --gateway=<g>` is accepted in the
      `--flag=value` form (every other command here uses it, and `--gateway <GATEWAY>` is in its
      help); the actual launch in Terminal (`open -a Terminal` on a `.command` file is the standard
      route but was not run here, since it would have connected to a live sandbox).

16. **Agent permission requests (per sandbox, route `requests`).** OpenShell records a pending network
    rule (a "chunk") for each outbound request its proxy blocked; this tab lists them in plain words and
    lets the user decide. Contract `models/openshell-requests.ts`, service
    `main/openshell-requests.service.ts` (`OpenShellRequestsService`, same gate, binary check, fixed
    `PATH`, argument arrays and `OpenShellManagementResult` envelope as rule 1; it reuses `nodeExec`
    and `mapFailure` from the management service). Channels `OPENSHELL_LIST_REQUESTS`,
    `OPENSHELL_APPROVE_REQUEST`, `OPENSHELL_REJECT_REQUEST`; preload `listOpenShellRequests`,
    `approveOpenShellRequest`, `rejectOpenShellRequest`, each taking one plain request object:
    `{sandboxName, status?}`, `{sandboxName, chunkId, confirmFlagged?}`, `{sandboxName, chunkId,
reason?}`.
    - **Commands (always `--gateway=<name>`, no shell):** list = `rule get --status=<pending|approved|
rejected> <sandbox>` (no filter flag when `status` is omitted); approve = `rule approve
--chunk-id=<id> <sandbox>`; reject = `rule reject --chunk-id=<id> [--reason=<text>] <sandbox>`.
      Reads use the 15 s timeout, approve and reject the 60 s one.
    - **Never built:** `rule approve-all`, `--include-security-flagged` and `rule clear`. No approve-all
      exists in the contract, the preload or the UI. A flagged request can only be approved one at a
      time and only with `confirmFlagged: true`, which the renderer sends after a second, explicit
      confirmation dialog ("Approve anyway").
    - **Validation before any process:** sandbox name as a resource name (rule 1); `status` one of the
      three words; `chunkId` a UUID (`8-4-4-4-12` hex), so never a flag, a path or free text; `reason`
      a string, cleaned (control, bidi and zero-width characters removed, whitespace collapsed) and cut
      to 200, omitted when empty, and passed as the single argument `--reason=<text>` (a value that
      looks like a flag stays the value of `--reason`). Anything else is `invalidInput`.
    - **Approve re-reads first.** Main runs `rule get --status=pending` and requires the chunk to still
      be there (`notFound` otherwise, so a stale or forged id never reaches `rule approve`), and refuses
      a flagged chunk without `confirmFlagged: true` (`invalidInput`) regardless of what the renderer
      did. The approve itself runs only after both checks.
    - **All gateway text is untrusted** (the agent writes the rationale; host and binary are whatever it
      tried). Every string is cleaned by `cleanOpenShellRequestText` (control characters, U+2028/2029,
      bidi controls, zero-width and soft-hyphen characters removed) and capped: rationale 500, host 255,
      program 255, rule 128, flag note 300, 10 endpoints, 10 programs, 100 requests. A chunk whose id or
      status does not validate is dropped (it could not be acted on). The renderer shows it as text
      bindings only (never markup) and sends back only the chunk id. A listing that cannot be recognised
      is `failed`, never an empty list.
    - **Flagged is fail-closed.** A request is flagged when its `Prover:` line is anything other than a
      plain "no (new) findings" (or is empty), or when any line whose key mentions security, flag, risk
      or warning has a value other than none/no/false.
    - **Renderer.** "Requests" tab with a number badge (the pending count, `OpenShellRequestsCountService`,
      read once when the sandbox page opens and kept current by the tab). While the tab is open and the
      window visible it re-reads every 10 s (timer outside the Angular zone, cleared on destroy, paused
      while an action runs; a failed background refresh keeps the last list). Each request reads as "An
      agent in this sandbox tried to reach api.stripe.com using curl", with the reason below, a warning
      callout when flagged, and buttons Approve, Deny and "Create permission instead", which opens the
      permission dialog (rule 14) prefilled with host, port and the first program
      (`prefill: {host, port, program?}`, create mode only, validated like typed input). A Waiting /
      History switch shows decided requests (approved plus rejected, no buttons). Empty state: "No
      requests. If an agent is blocked from reaching something, it shows up here."
    - **Verified (read-only, openshell 0.1.2, 2026-10-07):** `openshell rule --help` lists `get`,
      `approve`, `reject`, `approve-all`, `clear`, `history`; `rule get [--status <pending|approved|
rejected>] [NAME]`; `rule approve --chunk-id <ID> [NAME]`; `rule reject --chunk-id <ID> [--reason
<R>] [NAME]`; `rule approve-all [--include-security-flagged] [NAME]`. `rule get` has **no
      `-o json`** (rejected as an unexpected argument), so the text output is parsed: `Network Rules:
(version N, M chunk[s])`, then per chunk indented `Chunk:`, `Status:`, `Rule:`, `Binary:`,
      `Confidence:`, `Rationale:`, `Prover:`, `Candidate:`, `Endpoints: host:port [L7 rest,
access=read-only]`, `Binaries:`, `Hits: N (first seen …, last seen …)`; `No network rules for
sandbox '<name>'` when empty. Captured from a real pending chunk (a blocked `curl` to
      httpbin.org:443). `rule history` prints `Rule History:` lines (not used).
    - **Unverified:** what a security-flagged chunk prints (none existed; the reading above is a
      deliberate over-approximation of "flagged"); whether `rule approve` of a flagged chunk by
      `--chunk-id` is refused by the gateway without `--include-security-flagged` (main never relies on
      it); the exact output and exit code of `rule approve` and `rule reject` (never run: the gateway is
      shared), including what a second approve of the same chunk returns; whether a chunk id is always a
      UUID (all observed ones are; a non-UUID id would be hidden rather than approved); that
      `--reason=<text>` and `--chunk-id=<id>` are accepted in the `=` form (clap accepts it for every
      other command here, but these two were not run); whether approving applies to the live sandbox
      immediately or after the gateway reloads its policy (the UI re-reads and does not claim it is in
      effect).

17. **Environments, secret sets and sandbox details (app-side metadata).** Three small stores in one
    JSON file, `<userData>/openshell-environments.json` (`main/openshell-environments-store.ts`, mode
    `0o600`, written through the same no-follow atomic replace as the credential registry), keyed by
    **gateway name** exactly like the managed-binding store (rule 3): another gateway never sees
    them, and an entry under an invalid gateway name is never read or written. Contract:
    `models/openshell-environments.ts`; service: `main/openshell-environments.service.ts`. **No
    `openshell` process is ever started for any of this and nothing is read from the vault**: the
    store holds ids, names, env-var names, display text and resource sizes, never a credential value
    and never a `bw://` string (a ref has no value field; unknown fields are dropped on every write
    and every load).
    - **IPC** (all through `handleManagement`, so a payload that is not a plain object is
      `invalidInput` before the service sees it, and none throws; each is `unsupported` behind the
      rule-6 gate): `listOpenShellEnvironments` / `saveOpenShellEnvironment` /
      `deleteOpenShellEnvironment` (`OPENSHELL_ENV_LIST/SAVE/DELETE`), `listOpenShellSecretSets` /
      `saveOpenShellSecretSet` / `deleteOpenShellSecretSet` (`OPENSHELL_SET_*`),
      `getOpenShellSandboxMeta` / `setOpenShellSandboxMeta` (`OPENSHELL_META_GET/SET`). A save without
      `id` creates (main assigns a random UUID; the renderer never chooses one); with an `id` it
      replaces that item (`notFound` when it does not exist). Limits per gateway: 100 environments,
      100 sets, 30 refs per set, 500 sandbox entries.
    - **Secret ref** `{resourceType, id, field, label, profileId, envVar}`: id is a lowercase vault
      UUID, `field` fits the type (`item`: username|password, `secret`: value; checked with
      `buildBitwardenReference`), `profileId` a resource name, `envVar` an env-var name that is not
      in the rule-9 deny list; a label is cleaned (control, bidi, zero-width) and cut to 120; two refs
      of one set or environment may not share an env var. Anything invalid is `invalidInput`; a
      stored ref that fails this on load is dropped (the store is re-validated per entry on read,
      and a corrupt or oversized file is an empty store with a warning, never an exception).
    - **Secret set** `{id, name, secrets[1..30]}`; names are 1-60 cleaned characters, unique per
      gateway ignoring case (`alreadyExists`). Deleting a set an environment points at is refused
      (`failed`, "This set is used by N environment(s).") rather than silently stripping those
      environments. Sets are only created from a sandbox's Secrets tab ("Save as set", which keeps the
      credentials this app created with exactly one binding and tells the user how many it left out,
      because the gateway strips vault references from anything else, rule 3); they are renamed and
      deleted on the Environments view; the Add secrets dialog adds a set's rows through the same
      `addOpenShellCredentialUnique` path as hand-picked ones, so main's rule-9 checks (profile exists,
      env var declared by the profile, deny list) apply to every row, and the rows stay editable.
    - **Environment** `{id, name, description<=200, from | template, cpu, memory, secretSetId | secrets}`
      validated with the same validators as `createSandbox` (image reference grammar with no path or
      archive, resource names, cpu and memory quantities); `from` and `template` are mutually
      exclusive, and so are `secretSetId` (must exist) and inline `secrets`. The renderer's Create
      sandbox dialog has a first field "Start from environment" (None by default) that only
      **prefills** the form (the user can change every value, and what is sent is the form, which main
      validates as for any create). After `sandbox create` succeeds the dialog adds the environment's
      secrets one by one with `addOpenShellCredentialUnique`; a failure does not stop the rest and
      the dialog stays open listing each secret that failed (label and scrubbed message) with "Open
      sandbox"; a set deleted since the list was read is reported the same way, after the sandbox
      exists. This is not transactional: the sandbox is never rolled back. "Save as environment"
      (sandbox page menu) captures that sandbox's secrets as inline refs; the gateway record has no
      image or size, so the user enters those.
    - **Sandbox details** `{name, purpose, color}` by sandbox name: purpose is one line (line breaks
      and tabs become spaces, control/bidi/zero-width removed), at most 120 characters; color is one
      of a fixed palette (`blue|green|amber|red|gray`, mapped to static Tailwind classes in the
      renderer). Setting an empty purpose and no color removes the entry; the renderer does that
      best effort after a successful sandbox delete (a failure is ignored and the entry is overwritten
      by the next sandbox of that name). Shown as text only (`<bdi>`, never markup) under the name in the
      list and under the title on the sandbox page; edited from "Edit details" in the page's header
      menu.
    - **Routes:** the list page and `/agent-access/openshell/_environments` share a
      Sandboxes | Environments switch (`bit-toggle-group`). The environments route starts with an
      underscore, which can never be a sandbox name (rule 1's validator), so it cannot shadow `:name`.
    - **Verified:** by unit tests only (models, store, service with an injected filesystem and
      detection, IPC wiring, renderer components). **No `openshell` command was run for this
      feature**, because none is used. **Unverified:** an end-to-end run of "create from environment"
      against a live gateway (it composes `sandbox create` and `provider create`/`sandbox provider
attach`, each verified under rules 1 and 8, but not run together here); and the app's behavior
      if two Desktop windows write the store at once (writes are serialized within one process only).

18. **Activity tab (per sandbox, route `activity`).** Answers "what has the agent done in this
    sandbox?" from the one source that is real and sandbox-attributed: the OpenShell credential-resolve
    rows main already records (§M8.8: `origin: "openshell"`, `sandboxId`, status, timestamp,
    `targetIds`). `listOpenShellActivity({sandboxId})` (`OPENSHELL_LIST_ACTIVITY`,
    `main/openshell-activity.service.ts`, contract `models/openshell-activity.ts`) validates the id
    (`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`, no process is ever started), applies the management gate
    (`unsupported` when closed), filters the buffer to that sandbox's rows and returns a reduced copy:
    `{id, atMs, agentName, outcome: allowed|denied|notFound|pending, secretCount}`, newest first, at
    most 200. Provider ids, policy digests, item/secret ids and every name stay in main. The agent name
    loses control, bidi and zero-width characters and is cut to 64. Main gets the buffer through
    `MainAgentAccessService.getActivityEntries()` (a copy), wired in `main.ts` with
    `MainAgentAccessCliService.setOpenShellActivitySource`. The renderer finds the sandbox's gateway id
    from `listOpenShellSandboxes` by name, shows plain-language rows ("openshell-gateway used 2 secret(s)
    from your vault", result badge, relative time), filters All / Allowed / Denied, has empty, filtered
    -empty and error states, refreshes every 10 s, renders text only.
    - **Not available, deliberately not invented:** which secret (name), which host, which program and
      the exact API call. The buffer holds ids only (never names) and records no destination; Desktop
      does not see the proxied request, the sandbox's network egress or its use of an already-resolved
      value. A row like "Used GitHub token to call api.github.com" therefore cannot be built from
      Desktop data. What it would take: aac would have to report, per resolve or per use, the provider
      _name_, the destination host and the calling binary (the gateway knows them at resolve time), and
      main would have to persist them (the buffer is in-memory, 200 rows, cleared on logout or account
      switch, so the tab shows this session only).
    - **Verified (read-only, 2026-10-07):** `openshell logs <sandbox> -n N [--since D] [--source
gateway|sandbox|all] [--level L]` works and returns lines such as `[epoch] [sandbox] [OCSF ]
[ocsf] NET:OPEN [INFO] host:port`, `CONFIG:LOADED`, `CONFIG:FAIL_CLOSED [HIGH]`; `openshell
policy list <sandbox>` returns version, hash, status. `sandbox list -o json` reports the
      sandbox `id` (UUID) and `name` at the top level.
    - **Unverified:** that the `sandboxId` aac sends on a resolve equals the `id` in `sandbox list` (same
      UUID shape; not observed end to end, because no resolve ran). The format of OCSF network
      allow/deny lines (the dev gateway's logs only had listener, config and fail-closed lines, no
      egress decisions), so the logs are not parsed and not shown; a later phase can add a "sandbox
      log" section once an allow and a deny line are captured.

Page structure: the tab is `/agent-access/openshell`. The sandbox list is the page. Selecting a
sandbox opens its credentials in a side panel or a detail view (implementer's choice, one level
deep). Create sandbox and add credential are dialogs.

File ownership (disjoint; see the build prompt for each owner):

- **Main:** `main/openshell-management.service(.spec).ts`,
  `main/openshell-credential-registry.service(.spec).ts`, the IPC handlers in
  `main/main-agent-access-cli.service.ts`, `preload.ts`.
- **Page:** `components/agent-access-openshell-page.component.*`,
  `components/agent-access-openshell-create-sandbox-dialog.component.*`, the route in
  `app/app-routing.module.ts`, the tab link in `components/agent-access.component.html`.
- **Credentials:** `components/agent-access-openshell-credentials.component.*`,
  `components/agent-access-openshell-add-credential-dialog.component.*`.
- **i18n:** each renderer owner writes its keys to its own fragment file (never to
  `messages.json` directly); the lead merges them.
