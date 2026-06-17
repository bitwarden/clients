# @klappstuhl/ui-bridge (FORK)

The single seam between the redesigned UI and the **untouched** Bitwarden core.

```
UI (ui-kit + apps/desktop renderer)  ->  ui-bridge  ->  @bitwarden/* services  ->  Vaultwarden
                                          (only place that imports core)
```

## Why it exists

- Keeps the UI fully decoupled from core → upstream merges stay clean.
- Guarantees the UI never calls crypto directly or builds raw API payloads.
- Makes a *future* React-island migration possible without re-touching screens.

## Rules

- The **only** fork lib allowed to import `@bitwarden/common`, `@bitwarden/vault`,
  `@bitwarden/key-management`, etc.
- **Never** re-implement crypto, sync, auth, or API contracts. Delegate to the
  existing service methods (`CipherService.save`, `TotpService`, …).
- Expose presentation-only view-models (see `src/vault/vault-view-model.ts`).
- Mutations flow through existing service methods — never a hand-built request.

See `docs/ui-redesign/01-ARCHITECTURE.md`.
