---
paths:
  - "apps/desktop/src/autofill/**"
  - "apps/desktop/desktop_native/autotype/**"
  - "apps/desktop/desktop_native/napi/src/autotype_mvp.rs"
  - "libs/common/src/desktop-native/**"
  - "libs/angular/src/desktop-native/**"
  - "apps/desktop/desktop_native/ssh_agent/**"
  - "apps/desktop/desktop_native/napi/src/sshagent.rs"
  - "apps/desktop/src/autofill/services/ssh-agent.service.ts"
  - "apps/desktop/src/autofill/services/ssh-agent.service.spec.ts"
  - "apps/desktop/src/autofill/main/main-ssh-agent.service.ts"
  - "apps/desktop/src/autofill/main/main-ssh-agent.service.spec.ts"
  - "apps/desktop/src/autofill/models/ssh-agent-setting.ts"
  - "apps/desktop/src/autofill/components/approve-ssh-request.html"
  - "apps/desktop/src/autofill/components/approve-ssh-request.ts"
  - "apps/desktop/native-messaging-test-runner/**"
  - "apps/desktop/src/services/duckduckgo-message-handler.service.ts"
  - "apps/desktop/src/services/encrypted-message-handler.service.ts"
  - ".github/workflows/alert-ddg-files-modified.yml"
review:
  team: team-desktop-native-dev
  require: always
---

# `team-desktop-native-dev` review rules

`@bitwarden/team-desktop-native-dev` reviews every change it owns under these paths. The paths mirror the team's lines in `.github/CODEOWNERS`.
