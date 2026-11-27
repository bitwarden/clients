---
paths:
  - "apps/desktop/desktop_native/autofill_provider/**"
  - "apps/desktop/desktop_native/core/src/autofill/**"
  - "apps/desktop/desktop_native/napi/src/autofill.rs"
  - "apps/desktop/desktop_native/napi/src/passkey_authenticator.rs"
  - "apps/desktop/desktop_native/napi/src/passkey_authenticator_internal/**"
  - "apps/desktop/desktop_native/objc/src/native/autofill/**"
  - "apps/desktop/desktop_native/win_webauthn/**"
  - "apps/desktop/desktop_native/windows_plugin_authenticator/**"
  - "apps/desktop/macos/**"
  - "apps/desktop/src/autofill/desktop-autofill.preload.ts"
  - "apps/desktop/src/autofill/main/main-desktop-autofill*"
  - "apps/desktop/src/autofill/modal/credentials/**"
  - "apps/desktop/src/autofill/models/autofill-*"
  - "apps/desktop/src/autofill/models/ipc-handler.type.ts"
  - "apps/desktop/src/autofill/services/desktop-autofill.service.ts"
  - "apps/desktop/src/autofill/services/desktop-autofill.service.spec.ts"
  - "apps/desktop/src/autofill/services/desktop-fido2*"
review:
  team: team-skunkworks
  require: always
---

# `team-skunkworks` review rules

`@bitwarden/team-skunkworks` reviews every change it owns under these paths. The paths mirror the team's lines in `.github/CODEOWNERS`.
