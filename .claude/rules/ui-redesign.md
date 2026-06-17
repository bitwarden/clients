# Rule: UI Redesign (fork)

Applies to all UI work in the Klappstuhl Pass fork. Full plan lives in
`docs/ui-redesign/`. This rule is the short, enforceable summary.

## Boundaries
- New UI components → `libs/ui-kit` (`@klappstuhl/ui-kit`). Visual only.
- Core access (CipherService, TotpService, VaultTimeoutService, …) → ONLY via
  `libs/ui-bridge` (`@klappstuhl/ui-bridge`). The UI imports the bridge, never core.
- Renderer screens live in `apps/desktop/src/app/**` and consume the bridge.

## Never
- Never edit `libs/common`, `libs/key-management`, `libs/auth`, `desktop_native`.
- Never re-implement crypto/sync/auth or build raw Vaultwarden API requests.
- Never edit upstream `libs/components/src/tw-theme.css`. Override token values in
  `libs/ui-kit/src/theme/fork-theme.css` (imported last from the desktop styles).
- Never log decrypted/view-model field values.
- Never introduce React/Vite/shadcn/Zustand. Use Angular standalone components +
  signals + CDK.

## Always
- Tailwind classes use the **`tw-` prefix**.
- Keep upstream edits to the documented short list (theme import, tsconfig paths,
  this CI workflow, optional eslint depConstraints). Everything else = new files.
- After UI changes, run `npm run lint:fix`, `npm run prettier`, `npm run test:types`,
  `npm test`, and the Vaultwarden acceptance test in
  `docs/ui-redesign/05-COMPATIBILITY-RISKS.md` before tagging a release.
- Update the checklist in `docs/ui-redesign/03-IMPLEMENTATION-PLAN.md` as you go.
