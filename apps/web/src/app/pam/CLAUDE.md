# PAM (OSS seams)

This directory holds the OSS-side integration seams for the commercial Privileged Access
Management (PAM) feature: the organization admin-console nav slot (`org-nav-slot/`) and the
individual user nav slot (`user-nav-slot/`, gated on `FeatureFlag.Pam` plus membership in a
PAM-enabled organization (`usePam`), linking to the user-scoped Access requests page). The
feature itself, including its domain contracts, lives in
`bitwarden_license/bit-web/src/app/pam/`.
