---
paths:
  - "apps/desktop/desktop_native/ssh_agent/**"
  - "apps/desktop/desktop_native/napi/src/sshagent.rs"
  - "apps/desktop/src/autofill/services/ssh-agent.service.ts"
  - "apps/desktop/src/autofill/services/ssh-agent.service.spec.ts"
  - "apps/desktop/src/autofill/main/main-ssh-agent.service.ts"
  - "apps/desktop/src/autofill/main/main-ssh-agent.service.spec.ts"
  - "apps/desktop/src/autofill/models/ssh-agent-setting.ts"
  - "apps/desktop/src/autofill/components/approve-ssh-request.html"
  - "apps/desktop/src/autofill/components/approve-ssh-request.ts"
review:
  team: wg-ssh-keys
  require: always
---

# `wg-ssh-keys` review rules

`@bitwarden/wg-ssh-keys` reviews every change it owns under these paths. The paths mirror the team's lines in `.github/CODEOWNERS`.
