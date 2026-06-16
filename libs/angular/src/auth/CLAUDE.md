# libs/angular/src/auth

New Angular auth code lands here, not in `libs/auth/` (see [libs/auth/CLAUDE.md](../../../auth/CLAUDE.md)).

- **Feature folders only.** Add `libs/angular/src/auth/<my-feature>/` — don't add files to convention folders (`components/`, `services/`, `guards/`, `constants/`). Mirror `account-deletion/`, `device-management/`, `login-approval/`, `password-management/`.
- **Barrel each feature.** Give every new feature folder an `index.ts`. Consumers import `@bitwarden/angular/auth/<my-feature>`, not internal paths.
