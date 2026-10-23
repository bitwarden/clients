# DIRT (libs/common) - Critical Rules

> Scope: `libs/common/src/dirt/` (open-source, platform-agnostic DIRT services and models:
> event-logs, models, services). Supplements the repo-wide `/.claude/CLAUDE.md`.

- **CRITICAL: import direction.** This is open-source `common` code. It must NEVER import from
  `bitwarden_license/`. Licensed DIRT code imports from here, not the reverse.
- **ALWAYS** follow the Api -> Data -> Domain -> View model pipeline. Domain models own
  encrypt/decrypt; services orchestrate. Canonical reference:
  `/libs/common/src/vault/models/domain/cipher.ts`.
- **NEVER** add new encryption logic to this repo. **NEVER** send unencrypted vault data to the
  server. **NEVER** log decrypted data, keys, or PII.
- **RxJS** for service state (platform-agnostic). No Angular Signals here (that is component-only,
  in the web/browser packages).
- **Naming:** "Access Intelligence" is current; "Risk Insights" is deprecated for the same feature.

For the full DIRT architecture and standards, see the team docs hub:
`/bitwarden_license/bit-common/src/dirt/docs/README.md`.
