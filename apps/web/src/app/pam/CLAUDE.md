# PAM (OSS seams)

This directory holds the OSS-side integration seams for the commercial Privileged Access
Management (PAM) feature: the organization admin-console nav slot (`org-nav-slot/`, gates on
`FeatureFlag.Pam` + `organization.canManageAccessRules`) and the individual user nav slot
(`user-nav-slot/`, gates on `FeatureFlag.Pam` only — links to the user-scoped "My access" page).
The feature itself, including its domain contracts, lives in
`bitwarden_license/bit-web/src/app/pam/`.
