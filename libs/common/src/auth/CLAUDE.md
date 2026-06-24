# libs/common/src/auth

New auth code lands here, not in `libs/auth/` (see [libs/auth/CLAUDE.md](../../../auth/CLAUDE.md)).

- **Feature folders only.** Add `libs/common/src/auth/<my-feature>/` — don't add files to convention folders (`abstractions/`, `services/`, `models/`, `enums/`, `types/`, `utils/`). Mirror `password-prelogin/`, `send-access/`, `two-factor/`.
- **Barrel each feature.** Give every new feature folder an `index.ts`. Consumers import `@bitwarden/common/auth/<my-feature>`, not internal paths.
