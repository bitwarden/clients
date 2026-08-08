# CLAUDE.md - DIRT Team (Licensed, Platform-Agnostic)

> Scope: `bitwarden_license/bit-common/src/dirt/` and its children. Claude Code reads
> CLAUDE.md files hierarchically (repo root + every parent dir), so this supplements the
> repo-wide `.claude/CLAUDE.md` with DIRT-specific context.

## Project Overview

The DIRT team (Data, Insights, Reporting & Tooling) owns Access Intelligence, Organization
Integrations, External Reports, and Phishing Detection. This package holds the
**platform-agnostic** (non-Angular) services and models that work across web, browser, and CLI.

**Start here:** `/bitwarden_license/bit-common/src/dirt/docs/README.md` (team documentation hub). New to the team? See `/bitwarden_license/bit-common/src/dirt/docs/getting-started.md`.

## Tech Stack

- TypeScript (strict), RxJS for service-layer state, Jest for tests.
- Bitwarden data-model pipeline: Api -> Data -> Domain -> View (follow the Cipher pattern at
  `/libs/common/src/vault/models/domain/cipher.ts`).

## Architecture & Patterns

- **4-layer data model:** Api (wire) / Data (serializable) / Domain (encrypted, owns
  encrypt+decrypt) / View (decrypted, smart-model methods). Domain models encrypt and decrypt
  themselves; services orchestrate, they do not encrypt/decrypt. Canonical reference:
  `/libs/common/src/vault/models/domain/cipher.ts`.
- **Smart models, thin services:** business logic lives on view models (like `CipherView`),
  not in services. Services do `report.mutate()` then persist.
- **Naming:** Access Intelligence is the current name; "Risk Insights" is the deprecated name
  for the same feature (legacy paths under `reports/risk-insights/` are being migrated). Use
  "Access Intelligence" in all new code, comments, and UI.
- **RxJS in services, Signals in components.** Never mix.

## Common Commands

- `npm run prettier` - format (run after editing, including .md files)
- `npm run lint` / `npm run lint:fix`
- `npm run test:types` - catch TypeScript errors after test changes

## Testing Standards

- Jest; deterministic data only (no `Math.random()`, no `new Date()`).
- Use shared test helpers; avoid `any` (`Partial<DeepJsonify<T>>` for test data).
- Smart models: follow the CipherView coverage pattern.

## Security & Compliance

- Zero-knowledge invariant: vault data is decrypted only client-side. Never send unencrypted
  vault data to the server; never log decrypted data, keys, or PII.
- **Encryption boundary:** domain models own crypto. Do not add field-level EncStrings to new
  models without confirming the SDK envelope-encryption direction with key management.
- New encryption logic must not be added to this repo.

## Gotchas & Tips

- `bit-common` is **licensed** code. Licensed code may import from `libs/common`, but
  `libs/common` must NEVER import from `bitwarden_license/`.
- Aggregation/filtering happens client-side after decryption (nothing server-side aggregates).
- When extending an abstraction, check it still serves more than one consumer before adding to it.

## References

- Team docs hub: `/bitwarden_license/bit-common/src/dirt/docs/README.md`
- Getting started: `/bitwarden_license/bit-common/src/dirt/docs/getting-started.md`
- Documentation structure: `/bitwarden_license/bit-common/src/dirt/docs/documentation-structure.md`
- Service / component integration: `/bitwarden_license/bit-common/src/dirt/docs/integration-guide.md`
- Access Intelligence component context: `/bitwarden_license/bit-web/src/app/dirt/access-intelligence/CLAUDE.md`
- BW data model: https://contributing.bitwarden.com/architecture/clients/data-model/
- Repo-wide rules: `/.claude/CLAUDE.md`

<!-- Deferred (follow-up ticket): once the DIRT team standards docs land and their
     canonical home is decided, add links to docs/standards/* here. Do not reference
     PR #19049 in the meantime. -->
