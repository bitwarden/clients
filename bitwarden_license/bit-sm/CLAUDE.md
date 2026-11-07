# `@bitwarden/bit-sm` — Secrets Manager

This **commercial** library holds the framework-agnostic Secrets Manager services, models,
requests and responses. It is consumed by the web vault (`bit-web`) and by the `bw sm` CLI
(`bit-cli`).

## Rules

- **No Angular.** No `@angular/*` imports, no `@Injectable`, no `inject()`, no components or
  decorators. Services are plain classes whose dependencies are constructor parameters; wiring is
  done by `provideSecretsManager()` in `bit-web` and by the `bit-cli` `ServiceContainer`.
- **No new encryption logic.** Services use `KeyService` / `EncryptService` from the shared libs.
- Do not import from `@bitwarden/bit-web/*`, `@bitwarden/bit-cli/*` (both lint-enforced), or `@bitwarden/bit-common/*`.
- OSS code (`apps/**`) may not import from this library.
- Consumers import from the `@bitwarden/bit-sm` barrel (`src/index.ts`); no deep imports. Export
  new public symbols from the barrel.
- Import inside the library with relative paths, not the `@bitwarden/bit-sm` alias.

## Layout

- `src/models/` — view models and shared models.
- `src/projects/`, `src/secrets/`, `src/service-accounts/` — API services plus their request/response DTOs.
- `src/settings/` — import/export (porting) services and DTOs.
- `src/shared/` — access policies and counts.

## Tests

`npm test -- bit-sm`
