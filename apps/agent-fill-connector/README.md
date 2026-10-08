# Bitwarden agent-fill connector

Demo/prototype connector, not a released Bitwarden product. It is a Claude Desktop Extension (`.mcpb`) with two MCP tools, `fill_login(url)` and `fill_card(url)`. Each call is forwarded, with the connection key, to the Bitwarden desktop app over a local socket. The desktop app asks the user to approve, and the Bitwarden browser extension fills the open tab. The connector never sees a password or card number; Claude gets only the item name and username (card: name and last four) or a failure reason.

macOS only. Requires Node 18 or later (Claude Desktop bundles one).

## Protocol

One connection per tool call to `~/.bitwarden-agent-fill.sock` (override with `BW_AGENT_FILL_SOCKET`, same as the desktop app). The connector sends one JSON line `{"id","type":"fill","key","tool","url"}` and reads one JSON line back (each at most 64 KiB), then closes. Closing early (Claude cancels the call) cancels the pending approval. It waits up to 310 seconds, so the desktop app's own 5 minute `expired` answer arrives first. Full spec: `tech-breakdowns/ai-enablement/AI-137-agentic-autofill-desktop-approval/agent-fill-contract.md`, section "Connector to desktop app: local socket".

## Build, validate, pack

This folder is outside the root workspaces. Run these from a copy outside the repo (for example `/tmp/agent-fill-connector`), without `node_modules` copied over:

```bash
npm ci
npm run smoke                              # fake desktop socket, no real app needed
npx @anthropic-ai/mcpb validate manifest.json
npx @anthropic-ai/mcpb pack                # or: npm run pack
```

Then open the resulting `.mcpb` in Claude Desktop (or drag it into Settings > Extensions).

## Connection key

In Bitwarden desktop, open Settings > Agent connections, create a connection, and copy its key (43-character base64url). Paste it into the extension's "Bitwarden connection key" setting in Claude Desktop. It is stored as a sensitive value and passed to the connector as `BW_CONNECTION_KEY`. The connector never logs or returns it; the desktop app decides whether it is valid.

For manual runs against a debug desktop build, `npm run test-key` prints a random key and its SHA-256 hex.

## Failure reasons

Failures are tool errors carrying `reason` and `message`. The connector raises two itself; the rest come from the desktop app and are passed through (an unknown reason becomes `error`).

| Reason                                                                                                                                                                                                                     | Raised by                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `desktop_unreachable`                                                                                                                                                                                                      | Connector: socket missing or connection refused. Desktop not contacted. |
| `connection_key_invalid`                                                                                                                                                                                                   | Connector: key missing, empty or unsubstituted. Desktop: key unknown.   |
| `error`                                                                                                                                                                                                                    | Connector or desktop: unexpected error, timeout, bad answer.            |
| `denied`, `denied_wrong_account`, `denied_not_requested`, `expired`, `no_open_tab`, `no_matching_item`, `wrong_site`, `form_not_found`, `connection_paused`, `locked`, `browser_unreachable`, `no_allowed_browser`, `busy` | Desktop app or browser extension, see the contract's "Failure reasons"  |
