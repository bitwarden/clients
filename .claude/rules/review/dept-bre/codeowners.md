---
paths:
  - ".github/workflows/retrieve-current-desktop-rollout.yml"
  - ".github/workflows/version-auto-bump-desktop.yml"
  - ".github/workflows/version-auto-bump-desktop-signal.yml"
  - ".github/workflows/publish-cli.yml"
  - "**/Dockerfile"
  - "**/*.Dockerfile"
  - "**/*.dockerignore"
  - "**/docker-compose.yml"
  - "**/entrypoint.sh"
review:
  team: dept-bre
  require: always
---

# `dept-bre` review rules

`@bitwarden/dept-bre` reviews every change it owns under these paths. The paths mirror the team's lines in `.github/CODEOWNERS`.
