---
paths:
  - "apps/browser/src/admin-console/**"
  - "apps/cli/src/admin-console/**"
  - "apps/web/src/app/admin-console/**"
  - "bitwarden_license/bit-web/src/app/admin-console/**"
  - "bitwarden_license/bit-cli/src/admin-console/**"
  - "libs/angular/src/admin-console/**"
  - "libs/common/src/admin-console/**"
  - "libs/admin-console/**"
  - "libs/auto-confirm/**"
  - "libs/organization-invite-link/**"
review:
  team: team-admin-console-dev
  require: always
---

# `team-admin-console-dev` review rules

`@bitwarden/team-admin-console-dev` reviews every change it owns under these paths. The paths mirror the team's lines in `.github/CODEOWNERS`.
