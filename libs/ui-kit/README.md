# @klappstuhl/ui-kit (FORK)

Premium, dark-first design system for the redesigned desktop client (1Password /
Proton Pass feel). **Visual layer only.**

- `src/theme/fork-theme.css` — token overrides + fork (`--fk-*`) tokens. Imported
  last by `apps/desktop/src/scss/tailwind.css` so it wins over upstream values
  **without editing any upstream file** (keeps upstream merges clean).
- `src/theme/tokens.ts` — TS mirror of the scales (spacing, radius, motion, type).
- `src/components/*` — Angular standalone primitives (added in Phase 3).

## Rules

- **Never** import `@bitwarden/common`, `@bitwarden/key-management`, or any
  crypto/sync/api module here. Data access is `@klappstuhl/ui-bridge`'s job.
- All Tailwind classes use the **`tw-` prefix** (repo-wide rule).
- Retune the look by editing values in `fork-theme.css` only.

See `docs/ui-redesign/` for the full plan.
