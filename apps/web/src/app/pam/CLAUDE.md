# PAM (OSS seams)

This directory holds the OSS-side integration seams for the commercial Privileged Access
Management (PAM) feature: the organization admin-console nav slot (`org-nav-slot/`, behind
`FeatureFlag.Pam`, with Access rules on `canManageAccessRules`, Audit log on `usePam` +
`canAccessEventLogs`, and Rotation on `FeatureFlag.PamAccessConnector` + `canManageRotation`; the
group shows when any item does) and the individual user nav slot (`user-nav-slot/`, gated on
`FeatureFlag.Pam` plus membership in a PAM-enabled organization (`usePam`), linking to the
user-scoped Access requests page). The feature itself, including its domain contracts, lives in
`bitwarden_license/bit-web/src/app/pam/`.

`pam-nav-badge.service.ts` is the abstract count behind the user nav slot's badge, bound in
commercial code by `providePam()`. `pam-org-admin-route.token.ts` names the Admin Console path
the commercial org pages sit at, read by `getOrganizationRoute` so a member holding only
`ManageAccessRules` lands somewhere instead of being bounced out of the console. `pam-routes.token.ts` is the lazy loader for the user-scoped
pages themselves: `OssRoutingModule` mounts them at `/pam` as children of the shared
`UserLayoutComponent`, because the side nav's `routerLink`s are relative and a second layout
instance would re-base all of them. Every seam here follows the same rule: inject it
`{ optional: true }` and fall back to an inert default (`of(0)` for the badge), so an OSS-only
build where nothing provides it behaves as if PAM did not exist.

## Onboarding tours

The nav slots host coachmark anchors (`vault-coachmark`) for the PAM onboarding tours. The tours
themselves are defined in `libs/vault/src/components/coachmark/tours/pam-tours.ts`. The
admin tour starts from `PamOrgNavSlotComponent` once a PAM nav item is visible, and its steps follow the
same `show*` predicates as the nav items (the group is held open while a step is on an item). The
end-user vault tour's second step anchors on the My requests item in `PamUserNavSlotComponent`.
`vault-pam-welcome-prompt.token.ts` (in `vault/individual-vault/`) is the seam for the welcome
modal, sequenced by `WebVaultPromptService`; unprovided, no welcome shows. All tours are gated on `FeatureFlag.Pam`. Completion is stored per user in the
`PAM_COACHMARK_DISK` state definition, one key per tour. Only one tour runs at a time, so a user
who is both admin and end user sees the rest on later eligible visits. Copy is placeholder
(`pamCoachmark*` messages).
