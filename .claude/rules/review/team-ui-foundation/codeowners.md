---
paths:
  - "**/*.scss"
  - "**/*.css"
  - "libs/eslint/components/**"
  - ".github/workflows/chromatic.yml"
  - "**/.storybook/**"
  - "libs/components/**"
  - "libs/storybook/**"
  - "libs/assets/**"
  - "libs/ui/**"
  - "libs/angular/src/scss/**"
  - "apps/browser/src/platform/popup/layout/**"
  - "apps/browser/src/popup/app-routing.animations.ts"
  - "apps/browser/src/popup/components/extension-anon-layout-wrapper/**"
  - "apps/web/src/app/layouts/**"
review:
  team: team-ui-foundation
  require: always
---

# `team-ui-foundation` review rules

`@bitwarden/team-ui-foundation` reviews every change it owns under these paths. The paths mirror the team's lines in `.github/CODEOWNERS`.
