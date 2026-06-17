# Bitwarden Clients - Claude Code Configuration

## ⚡ FORK NOTICE — Klappstuhl Pass UI Redesign

This is the **klappstuhlpy/clients** fork. Active project: a premium
1Password/Proton-Pass-grade **UI redesign of the Angular desktop client**, with
crypto/sync/auth/Vaultwarden compatibility kept **100% intact**.

**Before doing any UI work, read [`docs/ui-redesign/README.md`](../docs/ui-redesign/README.md)**
(the full plan: architecture, design system, task checklist, CI/CD, risks).

Non-negotiable fork rules:
- **Do NOT** modify encryption, key management, auth, sync, or API payloads. No
  edits to `libs/common`, `libs/key-management`, `libs/auth`, `apps/desktop/desktop_native`.
- All new UI lives in `@klappstuhl/ui-kit` (design system) and
  `@klappstuhl/ui-bridge` (the only fork lib allowed to import core).
- **No React rewrite** — stay Angular to keep upstream merges possible.
- Reskin via `libs/ui-kit/src/theme/fork-theme.css` (overrides token *values*,
  imported last); never edit upstream `libs/components/src/tw-theme.css`.
- See [`.claude/rules/ui-redesign.md`](./rules/ui-redesign.md).

## Project Context Files

**Read these files before reviewing to ensure that you fully understand the project and contributing guidelines**

1. @README.md
2. @CONTRIBUTING.md
3. @.github/PULL_REQUEST_TEMPLATE.md

## Critical Rules

- **NEVER** use code regions: If complexity suggests regions, refactor for better readability
- **CRITICAL**: new encryption logic should not be added to this repo.
- **NEVER** send unencrypted vault data to API services
- **NEVER** commit secrets, credentials, or sensitive information.
- **NEVER** log decrypted data, encryption keys, or PII
  - No vault data in error messages or console logs
- **ALWAYS** Respect configuration files at the root and within each app/library (e.g., `eslint.config.mjs`, `jest.config.js`, `tsconfig.json`).
- **CRITICAL**: Tailwind CSS classes MUST use the `tw-` prefix (e.g., `tw-flex`, `tw-p-4`). Missing prefix means the class is ignored and styling silently breaks. See [.claude/rules/tailwind.md](./rules/tailwind.md) for additional Tailwind rules.

## Mono-Repo Architecture

This repository is organized as a **monorepo** containing multiple applications and libraries. The
main directories are:

- `apps/<client>/` — single-client code (browser, cli, desktop, web). Each app is self-contained.
- `libs/common/` — code shared across **all** clients, including non-Angular (CLI). No Angular APIs here: no `@Injectable`, no `inject()`, no decorators, no template references.
- `libs/angular/` — code shared across Angular clients (browser/desktop/web). Angular APIs allowed.
- Other `libs/*` (e.g. `ui`, `platform`, `key-management`, `vault`) — domain-scoped, follow the same Angular / non-Angular split based on which clients consume them.

When adding new code, place it as deep and as narrow as possible. Promote to a shared `libs/` only when a second client needs it.

**Strict boundaries** must be maintained between apps and libraries. Do not introduce
cross-dependencies that violate the intended modular structure. Always consult and respect the
dependency rules defined in `eslint.config.mjs`, `nx.json`, and other configuration files.

## Verifying Changes

After modifying code, run:

- `npm run lint:fix` — applies ESLint fixes
- `npm run prettier` — formats with Prettier
- `npm run test:types` — type-checks the workspace
- `npm test` — runs Jest. Scope with `npm test -- <path-or-pattern>` when changes are localized.

If any of these fail, fix the underlying issue before reporting the task complete. Do not skip hooks or bypass failures.

## References

- [Web Clients Architecture](https://contributing.bitwarden.com/architecture/clients)
- [Architectural Decision Records (ADRs)](https://contributing.bitwarden.com/architecture/adr/)
- [Contributing Guide](https://contributing.bitwarden.com/)
- [Web Clients Setup Guide](https://contributing.bitwarden.com/getting-started/clients/)
- [Code Style](https://contributing.bitwarden.com/contributing/code-style/)
- [Security Whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper/)
- [Security Definitions](https://contributing.bitwarden.com/architecture/security/definitions)
