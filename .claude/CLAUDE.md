# Bitwarden Clients - Claude Code Configuration

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
- **CRITICAL**: Tailwind CSS classes MUST use the `tw-` prefix (e.g., `tw-flex`, `tw-p-4`).
  - Missing prefix breaks styling completely.
- **NEVER** log decrypted data, encryption keys, or PII
  - No vault data in error messages or console logs
- **ALWAYS** Respect configuration files at the root and within each app/library (e.g., `eslint.config.mjs`, `jest.config.js`, `tsconfig.json`).

## Mono-Repo Architecture

This repository is organized as a **monorepo** containing multiple applications and libraries. The
main directories are:

- `apps/` – Contains all application projects (e.g., browser, cli, desktop, web). Each app is
  self-contained with its own configuration, source code, and tests.
- `libs/` – Contains shared libraries and modules used across multiple apps. Libraries are organized
  by team name, domain, functionality (e.g., common, ui, platform, key-management).

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
