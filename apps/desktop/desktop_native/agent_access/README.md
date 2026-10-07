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
- `router` — one `Answerer`, one budget; a typed slot for a future phone answerer.
- `server` — Unix socket (0600, umask-bound, never steals a live socket, same-uid peers only) or
  named pipe (owner-only DACL, first instance, no remote clients).

## Transport

- Unix: `~/.bitwarden-access.sock`; Flatpak uses the SSH agent's data dir. `BITWARDEN_ACCESS_SOCK`
  overrides it.
- Windows: `\\.\pipe\bitwarden-access`.

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
- `purpose` (`command`, `env`) is client-reported and display-only. `notes` is never sent.

```console
$ printf '%s\n' '{"v":1,"type":"credential-request","requestId":"1","query":{"domain":"github.com"}}' \
    | nc -U ~/.bitwarden-access.sock
```
