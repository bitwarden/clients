# Agent-fill connector

Claude Desktop Extension (`.mcpb`) that forwards `fill_login` and `fill_card` to the Bitwarden desktop app.

- Self-contained Node package with its own `package.json` and `package-lock.json`. It is **outside the root npm workspaces**: do not import from other workspaces, and install/test it from a copy outside the repo (or after excluding it from the root `workspaces` glob).
- **Never log or return the connection key, tab URLs, or vault data.** Logs are JSON lines on stderr only. Failure messages are fixed text.
- **No credential ever passes through the connector.** Results are only what the desktop app returns (item name, username, card last four) or a failure reason.
- The connector holds no policy: the desktop app validates the key and decides everything. The connector only reports `desktop_unreachable` (socket missing or refused) and `error` itself.
- The protocol and the 16 failure reasons live in `tech-breakdowns/ai-enablement/AI-137-agentic-autofill-desktop-approval/agent-fill-contract.md` (section "Connector to desktop app: local socket"). Do not add reasons or request fields here without changing the contract.
- Verify with `npm run smoke`.
