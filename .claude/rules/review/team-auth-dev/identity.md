---
paths:
  - "libs/auth/src/common/login-strategies/**"
  - "libs/common/src/auth/two-factor/**"
  - "libs/common/src/auth/sso-login/**"
  - "libs/common/src/auth/services/sso-login/**"
  - "libs/common/src/auth/services/webauthn-login/**"
  - "libs/common/src/auth/models/request/identity-token/**"
review:
  team: team-auth-dev
  require: always
---

# Auth identity code

Auth reviews every change to the login strategies, two-step login, SSO, passkey login, and identity token requests. These paths decide how a user proves identity, so no change here is routine.
