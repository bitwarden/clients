---
paths:
  - "libs/auth/**"
  - "libs/common/src/auth/**"
  - "libs/angular/src/auth/**"
  - "apps/browser/src/auth/**"
  - "apps/cli/src/auth/**"
  - "apps/desktop/src/auth/**"
  - "apps/web/src/app/auth/**"
  - "bitwarden_license/bit-web/src/app/auth/**"
review:
  team: team-auth-dev
  require: conditional
---

# Auth review rules

Auth must review a change here when it:

- changes how a user proves identity, including login, two-step login, SSO, passkeys, and login with device
- changes how tokens or sessions are issued, stored, refreshed, or cleared
- adds to or changes the public API of an auth service or abstraction
- introduces a new pattern instead of following an existing one in the same area

Auth doesn't need to review:

- copy, i18n, or styling changes
- test-only changes
- fixes that follow an existing pattern in the same area
- changes that only adopt a shared component or API from another team
