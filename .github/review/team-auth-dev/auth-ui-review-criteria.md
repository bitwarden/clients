---
paths:
  - "libs/auth/src/angular/**"
  - "libs/angular/src/auth/**"
  - "apps/browser/src/auth/**"
  - "apps/desktop/src/auth/**"
  - "apps/web/src/app/auth/**"
  - "bitwarden_license/bit-web/src/app/auth/**"
  - "libs/common/src/auth/account-switcher/**"
  - "libs/common/src/auth/account-deletion/**"
---

# Auth's review criteria for auth UI

Auth doesn't need to review a change here when it only:

- changes copy, translations, or styling
- adds or changes tests
- fixes a bug by following a pattern already used in the same area
- adopts a shared component or API from another team

Auth must review any other change here, including any change that:

- alters how a user proves identity, such as login, two-step login, SSO, passkeys, or login with
  device
- changes how tokens or sessions are issued, stored, refreshed, or cleared
- introduces a new pattern instead of following an existing one

Identity logic, such as login strategies, two-step login, SSO, and token handling, isn't listed in
`paths`, so every change to it needs Auth's review.
