---
paths:
  - "apps/desktop/desktop_native/secure_memory/**"
  - ".github/workflows/test-e2e-usdev.yml"
  - ".github/workflows/test-e2e-usdev-changes.yml"
  - "e2e/tests/browser/login/**"
  - "e2e/tests/browser/pin/**"
  - "e2e/tests/desktop/biometric-unlock.e2e.ts"
  - "e2e/tests/desktop/login/**"
  - "e2e/tests/desktop/pin/**"
  - "e2e/tests/desktop/ssh-agent.e2e.ts"
  - "e2e/tests/shared/browser-desktop/**"
  - "e2e/tests/shared/passkey-unlock.e2e.ts"
  - "e2e/tests/shared/web-browser/**"
  - "e2e/tests/web/login/**"
  - "e2e/tests/web/passkey.e2e.ts"
  - "apps/desktop/src/key-management/**"
  - "apps/web/src/app/key-management/**"
  - "apps/browser/src/key-management/**"
  - "apps/cli/src/key-management/**"
  - "bitwarden_license/bit-web/src/app/key-management/**"
  - "libs/key-management/**"
  - "libs/key-management-ui/**"
  - "libs/legacy-crypto/**"
  - "libs/user-crypto-management/**"
  - "libs/common/src/key-management/**"
  - "libs/unlock/**"
  - "libs/node/**"
  - "apps/desktop/desktop_native/biometric/**"
  - "apps/desktop/desktop_native/napi/src/biometrics.rs"
  - "apps/desktop/src/services/native-messaging.service.ts"
  - "apps/browser/src/background/nativeMessaging.background.ts"
  - "apps/desktop/src/services/biometric-message-handler.service.ts"
  - "libs/automation-driver/**"
review:
  team: team-key-management-dev
  require: always
---

# `team-key-management-dev` review rules

`@bitwarden/team-key-management-dev` reviews every change it owns under these paths. The paths mirror the team's lines in `.github/CODEOWNERS`.
