# Agent access

Programs on this machine ask the running desktop app for a vault login, or for a yes/no decision,
over a local socket. A human approves every request in a Bitwarden dialog.

```text
client ──socket──▶ listener ──▶ Router ──▶ Answerer (napi) ──▶ main broker ──▶ AgentRequestGate ──▶ dialog
          (peer pid → requester walk)        one timeout budget
```

- `protocol` — wire v1. Payloads mirror Agent Access §5 (`CredentialQuery`, `CredentialData`).
- `requester` — names the app: walks up from the peer pid past shells and our own CLI to the
  first valid Developer ID signer (macOS); elsewhere, the first non-transparent process.
- `router` — one `Answerer`, one budget.
- `server` — Unix socket (0600, never steals a live socket, same-uid peers only) or named pipe
  (per-user name and DACL, first instance, no remote clients; clients check the server's user).

## Transport

- Unix: `~/.bitwarden-access.sock`; Flatpak, Snap and the App Store build bind under their own
  data dir, and clients look there too. `BITWARDEN_ACCESS_SOCK` overrides it.
- Windows: `\\.\pipe\bitwarden-access-<user SID>`.
- The App Store build doesn't ship `bw-access`: its sandbox would confine `run`'s commands.

## Wire v1

One JSON line in, one out, then the connection closes.

```jsonc
{"v":1,"type":"credential-request","requestId":"8f2c","query":{"domain":"github.com"},"purpose":{"command":"gh pr create --fill"}}
{"v":1,"type":"credential-response","requestId":"8f2c","status":"approved","credential":{"username":"…","password":"…","totp":"…","uri":"…","credentialId":"…"}}
{"v":1,"type":"approval-request","requestId":"9a1b","prompt":{"title":"Run terraform apply on prod?","body":"3 to add, 1 to change"}}
{"v":1,"type":"approval-response","requestId":"9a1b","status":"approved"}
```

- `query` is `{"domain"}`, `{"id"}` or `{"search"}`.
- `status` is `approved | denied | notFound | locked | timeout | error`.
- `purpose` (`command`, `env`) is client-reported and display-only; `env` is shown only when the
  peer is the bundled `bw-access`. `notes` is never sent.

## Client

`bw-access` (`../bw_access`) ships next to the app. Exit codes: 0 approved, 2 denied, 3 not found,
4 error.

```console
$ bw-access get --domain github.com --field password
$ bw-access run --domain github.com --env GH_TOKEN=password -- gh pr create --fill
$ git config --global credential.helper '!bw-access git-credential'
$ bw-access ask "Run terraform apply on prod?" --body "3 to add" && terraform apply
$ claude mcp add bitwarden -- /path/to/bw-access mcp
$ printf '%s\n' '{"v":1,"type":"credential-request","requestId":"1","query":{"domain":"github.com"}}' \
    | nc -U ~/.bitwarden-access.sock
```

`run` redacts the released secrets from the command's output.

`mcp` is a stdio MCP server (newline-delimited JSON-RPC, protocol 2024-11-05 to 2025-11-25) with
two tools: `run_with_credential` (`run`, output captured, 1 MiB per stream) and `ask_human`. No tool
result carries a secret value. Closing stdin exits and kills commands still running.
