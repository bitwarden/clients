---
paths:
  - "**/.claude/**"
  - ".github/workflows/respond.yml"
  - ".github/workflows/review-code.yml"
  - ".github/workflows/sdlc-sdk-update-evaluate.yml"
  - "**/.mcp.json"
review:
  team: team-ai-sme
  require: always
---

# `team-ai-sme` review rules

`@bitwarden/team-ai-sme` reviews every change it owns under these paths. The paths mirror the team's lines in `.github/CODEOWNERS`.
