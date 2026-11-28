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

# Auth review criteria

The Auth team decides which changes to these files need its review. Before you change them, read
`.github/review/team-auth-dev/auth-ui-review-criteria.md`.

- Prefer a change that follows a pattern already used in the same area.
- If your change alters how a user proves identity, or how tokens or sessions are handled, it needs
  Auth's review. Say so in the pull request description.
