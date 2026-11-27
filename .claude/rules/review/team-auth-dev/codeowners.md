---
paths:
  - "apps/web/src/connectors/**"
  - "apps/browser/src/auth/**"
  - "apps/cli/src/auth/**"
  - "apps/desktop/src/auth/**"
  - "apps/web/src/app/auth/**"
  - "apps/web/src/app/components/environment-selector/**"
  - "libs/auth/**"
  - "libs/user-core/**"
  - "bitwarden_license/bit-web/src/app/auth/**"
  - "libs/angular/src/auth/**"
  - "libs/common/src/auth/**"
review:
  team: team-auth-dev
  require: always
---

# `team-auth-dev` review rules

`@bitwarden/team-auth-dev` reviews every change it owns under these paths. The paths mirror the team's lines in `.github/CODEOWNERS`.
