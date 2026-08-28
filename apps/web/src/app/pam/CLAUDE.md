# PAM (OSS seams)

This directory holds the OSS-side integration seams for the commercial Privileged Access
Management (PAM) feature: the organization admin-console nav slot (`org-nav-slot/`, gates on
`FeatureFlag.Pam` + `organization.canManageAccessRules`) and the individual user nav slot
(`user-nav-slot/`, gates on `FeatureFlag.Pam` + membership in a PAM-enabled org (`usePam`) —
links to the user-scoped "Access requests" page).
The feature itself, including its domain contracts, lives in
`bitwarden_license/bit-web/src/app/pam/`.

`pam-nav-badge.service.ts` is the abstract count behind the user nav slot's badge, bound in
commercial code by `providePam()`. `pam-routes.token.ts` is the lazy loader for the user-scoped
pages themselves: `OssRoutingModule` mounts them at `/pam` as children of the shared
`UserLayoutComponent`, because the side nav's `routerLink`s are relative and a second layout
instance would re-base all of them. Every seam here follows the same rule: inject it
`{ optional: true }` and fall back to an inert default (`of(0)` for the badge), so an OSS-only
build where nothing provides it behaves as if PAM did not exist.
