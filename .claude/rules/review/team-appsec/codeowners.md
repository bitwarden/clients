---
paths:
  - "**/Dockerfile"
  - "**/*.Dockerfile"
  - "**/*.dockerignore"
  - "**/docker-compose.yml"
  - "**/entrypoint.sh"
review:
  team: team-appsec
  require: always
---

# `team-appsec` review rules

`@bitwarden/team-appsec` reviews every change it owns under these paths. The paths mirror the team's lines in `.github/CODEOWNERS`.
