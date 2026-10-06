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
  encrypt `""`); `projectIds` carries `[newProjectId]` on a confirmed move, else
  `[currentProjectId]` — and is omitted ONLY when the secret has no project at all. Omitting it for
  a project-assigned secret does **not** mean "unchanged": the server
  (`SecretUpdateRequestModel.ToSecret`) treats the association as unchanged only when the incoming
  first project id equals the stored one, so a null `ProjectIds` falls through to `Projects = []`
  and silently UNASSIGNS the secret. Re-sending the current id is the "no change" sentinel.
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

## M7 — `bws run` parity: project-scoped bulk secret injection (`projectSecretsRequest`)

Direction (Max, 2026-08-12): integrate the `bws run` command into the MCP server and the desktop
app. `bws run` (sdk-sm `crates/bws/src/command/run.rs`) lists a project's (or the whole org's)
secrets, fetches all values, injects each as an environment variable named by the secret key, and
spawns a shell command. M7 is the agent-access analogue: **one human approval releases the
enumerated secret set of exactly one project for injection into one command**, values flowing only
desktop → `aac` → child-process environment, never to the agent conversationally.

Deltas vs `bws run`, with reasons the tool description must not contradict:

- **Project is REQUIRED** — `bws run` without `--project-id` injects every org secret; an
  unscoped all-org release is an unbounded blast radius behind a single click. Agents that want
  org-wide behavior see it fail and must pick a project (via `list_projects`).
- **No `--shell` / stdin-command / `--no-inherit-env` forms** — `aac` already has its own child
  spawn model (`run_child_captured`: argv array, captured+scrubbed output). We keep it; the tool
  takes `command: string[]` like `run_with_secret`, not a shell string.
- **Duplicate env names fail closed** (bws bails too unless `--uuids-as-keynames`); the
  `uuidsAsKeynames` escape hatch is kept, applied `aac`-side (wire already carries `secretId`).
- Values are born on the desktop, transit the local socket once, and exist in `aac` only as
  `Zeroizing` strings feeding the child env + Redactor scrub list. `run_with_secret`'s honesty
  caveat applies unchanged: a child that re-encodes a value defeats scrubbing; the dialog copy
  must say values are _injected into the command's environment_, not "never visible".

### Wire protocol v1 — new op `projectSecretsRequest` (local socket ONLY)

Op string ⇒ (resource, operation): `projectSecretsRequest` = (Secret, **BulkRequest**). Same
framing, caps, 60 s deny-by-default timeout, attestation, and status vocabulary. Never rides the
relay.

**Request:** `{"version":1,"op":"projectSecretsRequest","project":{"id":"<uuid>"} |
{"name":"…"},"client":{…}}`

- Exactly one of `project.id` / `project.name`, non-empty (validation error otherwise). `id` is a
  bare UUID — `aac` strips `bw://project/` before sending (existing `strip_project_reference`).
- NO `query`, `delivery`, `fill`, `create`, `update`, or `target` objects — each is a validation
  error on this op (per-arm foreign-object rejection, existing pattern). Delivery is implicitly
  inject; there is no reference form (reference-shaped discovery is `find_secrets`/`list_projects`).
- `project.name` resolution (desktop, pre-dialog): exact decrypted-name match among the user's
  readable projects across SM orgs, falling back to a unique case-insensitive match (bws prior
  art, same rule as secret `name` queries). Zero or >1 matches ⇒ `notFound` (generic; the agent
  is told to use `list_projects` and pass the reference). A project with zero readable secrets ⇒
  `notFound` (consistent with name-query misses; no dialog is shown for a release of nothing).

**Response (approved):**
`{"version":1,"status":"approved","reference":"bw://project/<uuid>","item":{"name":"<project
name>"},"secrets":[{"name":"DB_PASSWORD","value":"…","secretId":"<uuid>"}, …]}` — new top-level
`secrets` array (each entry shaped exactly like M4's single `secret` object). Capped at **200**
entries; a project over the cap ⇒ wire `error` with a generic "too many secrets" message
(pre-dialog — don't ask a human to approve a release we won't perform). `note` is never present
(M4 invariant 2).

### aac (SDK repo) — MCP tool + CLI (M7-A)

`transport/local.rs`: `ProjectQueryInput { Id(String) | Name(String) }` +
`project_query_from_flag` (sibling of `secret_query_from_flag`, strips `bw://project/`);
`request_project_secrets(endpoint, &query) -> ProjectSecretsOutcome { project_name, reference,
secrets: Vec<WireSecret> }` — reuses `WireSecret` (already `Zeroizing` value + redacting `Debug`);
`WireResponse` gains `#[serde(default)] secrets: Option<Vec<WireSecret>>`; interpreter checks
version, `bw://project/` prefix, non-empty derived id, and **rejects an approved reply with a
missing `secrets` array** (fail closed — an empty-but-present array is impossible by the desktop's
zero-secrets ⇒ `notFound` rule, treat it as an error too).

`command/mcp.rs` — tool count 15 → **16**: `run_with_project_secrets({project, command,
uuidsAsKeynames?})` → `{exitCode, output: {stdout, stderr}, injected: ["DB_PASSWORD", …]}`.

- `project`: name, bare UUID, or `bw://project/<id>` reference; `command`: non-empty string array.
- Env naming: per secret, `secret_env_var_name(name)` (the pinned uppercase/`_` algorithm above),
  or `uuid_to_posix`-style `_`-prefixed hyphens-to-underscores UUID form when
  `uuidsAsKeynames: true` (mirror bws `util::uuid_to_posix`: `_<uuid with '-'→'_'>`).
- **Collision check before spawn**: two secrets mapping to the same env name ⇒ tool error naming
  the colliding _env var name_ (never values), child never spawned. `uuidsAsKeynames` cannot
  collide.
- Every non-empty value joins the Redactor scrub list; `injected` lists env var _names_ only
  (names were displayed to the user in the approval dialog; no values, ever, on any status —
  extend the value-never-in-output table tests to the new tool).
- Description MUST state: requires approval in the Bitwarden desktop app; the user sees the full
  list of secret names before approving; values are injected into the command's environment and
  scrubbed from captured output, never returned to you; prefer this over N `run_with_secret`
  calls when a command needs a whole project's secrets (one approval instead of N).
- Update `SERVER_INSTRUCTIONS` (runtime step of the remediation workflow: a service consuming a
  whole project runs under `run_with_project_secrets`) and the count/name/required-field tests.

CLI: `aac run --project <name|uuid|bw://project/id>` — conflicts with
`domain`/`id`/`search`/`reference`/`secret`/`env_mappings`/`env_all` and with `--secret-env`
(per-secret override is meaningless for a set; runtime-validated like `--secret-env` itself).
`--uuids-as-keynames` flag valid only with `--project` (runtime-validated). Local transport only,
no relay fallback (`fetch_project_secrets_dispatch` sibling in `connect.rs`). No new single-shot
print form — a reference-mode project fetch is `list_projects`' job; `--project` exists for `run`
only.

### Desktop Rust + napi (M7-B)

`callbacks.rs`: `RequestOperation` += `BulkRequest`; `CredentialRequestData` += nothing new
(`target_id` carries `project.id`, `query_value` carries the name form — see force-fill below);
`CredentialResponseData` += `secrets: Option<Vec<SecretEntry>>`
(`SecretEntry { id, name, value: Zeroizing<String> }`, `Debug` prints count/presence only —
names AND values redacted: unlike `ProjectEntry` this rides next to values, keep the whole entry
dark). Entries transit main only inside the in-flight response, never buffered.

`local_protocol.rs`: `WireProjectSelector { id?, name? }` (exactly-one in validate);
`ValidatedRequest::BulkRequest { project_id: Option<String>, project_name: Option<String>,
client }`; `build_response` `(BulkRequest, _)` arm → approved reply from `project_id` +
`item_name` + `secrets` vec, **fail-closed if any of the three is missing/empty**; response
`WireSecretEntry` serialization identical to M4's `secret` object (`name`/`value`/`secretId`).

**Force-fill** (`local_listener/mod.rs`): `query_type` omitted, `query_value` = `project.id` if
present else `project.name` (the target selector, same spirit as update/delete's `target_id`);
`target_id` = `project.id` when id-form. Main TS keeps queryType/queryValue out of the activity
row (`operation !== "request"` gate, unchanged). Spec-assert.

napi: `OperationType` += `bulkRequest`; `CredentialRequestData` unchanged shape-wise (reuses
`targetId?`; name-form arrives via a new `projectName?: string` field — presence-only in `Debug`);
`CredentialResponseData` += `secrets?: Array<AgentAccessSecretEntry>`;
`AgentAccessSecretEntry { id, name, value }`. The `.d.ts` additions are hand-applied by the
architect; make the Rust match exactly.

### Desktop TS main + models (M7-C)

Models: `AgentAccessOperation` += `BulkRequest: "bulkRequest"`;
`CredentialRequestActivity`/`CredentialRequestOutcome` += `secretIds?: string[]` (ids only —
invariant 3 unchanged; `projectId?` exists since M6). Main service: pass `targetId`/`projectName`
through to the renderer message; activity row for `bulkRequest` carries no query fields (existing
gate); `resolveCredentialRequest` copies `projectId` + `secretIds` on `Shared` for `bulkRequest`
rows (status vocabulary unchanged — an approved bulk release IS `Shared`). Pending-timeout,
one-way Pending→resolved, ids-only buffer: unchanged, spec-asserted for the new op.

### Desktop TS renderer (M7-D)

`agent-access-secrets.service.ts`:

- `listSecretsInProject(projectId, organizationId, userId)` → `GET /projects/{id}/secrets`
  (unlogged), decrypt names with the org key, filter `read === true`, return
  `[{secretId, name}]`. Degrade-to-empty on read failures (existing convention).
- `resolveProjectSelector({id?, name?}, userId)` → reuse `listProjects` across SM orgs; id ⇒
  direct lookup; name ⇒ exact-then-unique-case-insensitive match; returns
  `{projectId, projectName, organizationId, organizationName}` or null.
- `getSecretValuesByIds(ids, organizationId, userId)` → **post-approval** `POST
/secrets/get-by-ids` **with the agent-mediated header** (this reintroduces the bulk fetch M4c
  removed — the difference is it now runs AFTER approval, so every `Secret_RetrievedByAgent` row
  the server writes corresponds to a secret the user saw in the dialog and released). **Filter
  the response to the approved id set** (never release more than was displayed); a failed call
  denies with a generic error + toast. Decrypt values (and names for the reply) with the org
  key. Server facts (VERIFIED against `SecretsController.GetSecretsByIdsAsync`): the response
  is `ListResponseModel<BaseSecretResponseModel>` — wrapper property `data`, NOT the `secrets`
  wrapper the org/project list endpoints use — and the server 404s the WHOLE call when any
  requested id is missing (`secrets.Count != request.Ids.Count()`), so a TOCTOU-deleted secret
  surfaces as a call failure → post-approval generic denial, never a silently smaller release.
  The header treatment on this action already existed server-side (pre-M6); M7-E was a no-op.

Pipeline (`desktop-agent-access.service.ts`): `operation === "bulkRequest"` →
`handleProjectSecretsRequest` after the same enable/unlock/grant gates. Resolve selector →
`listSecretsInProject` → zero secrets or unresolvable selector ⇒ `notFound`; >200 ⇒ generic
error; else dialog. On approve: `getSecretValuesByIds`, respond `{approved, projectId,
secretIds, secrets: [{id, name, value}], itemName: projectName}`. Names enter the session cache
for activity display (secrets and project both).

Dialog `project-secrets-request.component`: params `{requesterName?, requesterFingerprint?,
projectName, organizationName, entries: [{name}]}`; result `{approved}`. Copy: the agent will run
a command with **all N secrets of project X** injected as environment variables; the full name
list is shown (scrollable, like `project-list-request`); values are not displayed and are not
returned to the agent, but the command it runs can read them (truthful consequence labeling —
this is `run_with_secret`'s trust model × N, say so plainly). Danger-adjacent primary style not
required; this is a read release.

Activity: `bulkRequest` + `Shared` renders "Shared N secrets from project {name}" — project name
via cache with id fallback (like `Created`); the count comes from `secretIds.length`. i18n: new
`agentAccessBulk*` family in the staged `agentAccess*` block (merge, never regenerate; `en` only).

### Server (M7-E, branch `prototype/agentic-event-logs`)

`SecretsController.GetSecretsByIds` currently logs hardcoded `Secret_Retrieved` per secret for
the user branch; apply the existing `AgentMediation` helper (`ResolveAgentMediatedEventType`) so
a header-marked call logs `Secret_RetrievedByAgent = 2106` per secret instead. No new event
types, no client enum changes. Tests mirror the committed `SetAgentMediatedHeader` pattern on the
get-by-ids action.

### Invariants (additive to M4/M5/M6's)

20. Invariant 16 is amended, not broken: `projectSecretsRequest` is the sole bulk **read**
    release; it is single-target (one project), fully enumerated in the dialog (released set ==
    displayed set, by ids fixed at approval), capped at 200, and carries no write semantics.
    Bulk writes remain unrepresentable on the wire.
21. The `secrets` array appears only in an approved `projectSecretsRequest` reply on the local
    socket; never in any other op's reply, never in `find_secrets`/tool output, never in main's
    activity buffer (ids only), never logged (presence/count-only `Debug` at every layer).
22. The bulk value fetch is post-approval and id-filtered: the server sees exactly one
    agent-mediated `get-by-ids` per approved release, covering only displayed ids — one event row
    per released secret, none for secrets the user never approved.
23. Whole-org (project-less) bulk release is unrepresentable on the wire.

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
