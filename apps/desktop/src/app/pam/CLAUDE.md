# PAM seams (OSS desktop)

Inert hooks a commercial build fills; this folder and the rest of `apps/desktop` must not import
`@bitwarden/bit-pam` or `@bitwarden/bit-pam-components` (lint-banned). All PAM code lives in
`bitwarden_license/bit-desktop/src/app/pam/`, which fills the seams through `provideDesktopPam()`.

- `pam-routes.token.ts`: `PAM_DESKTOP_ROUTES`, the lazy loader mounted at `/pam` as a child of
  `DesktopLayoutComponent` (route in `app-routing.module.ts`). Unprovided, `canMatch` declines and
  `/pam` is not a route.
- `pam-nav-slot.component.ts`: the "Access requests" item, first in the VFO1 manage nav section
  (above My folders, Archive and Trash, as on web). Shows only when `PAM_DESKTOP_ROUTES` is
  provided, `FeatureFlag.Pam` is on and an organization has `usePam`.
- `pam-nav-badge.service.ts`: optional abstract badge count for the nav item; falls back to `0`.
- Vault seams that live elsewhere: `vault-v3/vault-gated-collection-banner.token.ts` (banner above
  a shared folder's items, unprovided renders nothing) and the shared `@bitwarden/vault` tokens
  `VAULT_ROW_ACTIONS`, `VAULT_ITEM_COLUMN`, `VAULT_ITEM_FILTER`, `CIPHER_VIEW_BANNER`,
  `ITEM_DETAILS_BADGE`, which the desktop vault table and cipher view already honour.
- Notification seams that live elsewhere and name no PAM symbol except the route allowlist:
  `ipc.platform.showNotification({ title, body, route? })` (`platform/preload.ts`, handled in
  `services/electron-main-messaging.service.ts`: unsupported-platform check, route checked against
  `platform/notification-routes.ts`, click focuses the window and sends `navigateToRoute`), the
  renderer handler for that message in `app/app.component.ts` (re-checks the allowlist, holds the
  route while locked and opens it on unlock), and `app/accounts/settings-extras.token.ts`
  (`DESKTOP_SETTINGS_EXTRAS`, components added to the settings dialog's app preferences tab). The
  allowlist is static because the main process cannot ask the renderer; add a route there
  before a notification can open it.
