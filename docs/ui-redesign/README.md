# Klappstuhl Pass — UI Redesign (fork of bitwarden/clients)

This folder is the **single source of truth** for the desktop UI redesign of this
fork. Read it before touching any UI code. It exists so future contributors (and
future Claude sessions) know exactly what is planned, what is done, and how to
upgrade safely without breaking Vaultwarden compatibility or upstream merges.

## The one-paragraph summary

We are reskinning the **Angular** Electron desktop client (`apps/desktop`) into a
premium, 1Password/Proton-Pass-grade password manager. We do **not** rewrite to
React (that would permanently break upstream mergeability — the decision and its
rationale are in [01-ARCHITECTURE.md](./01-ARCHITECTURE.md)). The crypto, sync,
auth, and Vaultwarden API layers are treated as **black-box stable dependencies**
and are never modified. All new visual code lives in two new fork libraries,
`@klappstuhl/ui-kit` and `@klappstuhl/ui-bridge`, plus restyled renderer
templates.

## Documents

| Doc                                                      | What it covers                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [00-OVERVIEW.md](./00-OVERVIEW.md)                       | Goal, constraints, what is/ isn't in scope                                   |
| [01-ARCHITECTURE.md](./01-ARCHITECTURE.md)               | Boundary model, the React-vs-Angular decision, dependency rules              |
| [02-DESIGN-SYSTEM.md](./02-DESIGN-SYSTEM.md)             | Tokens, theme override mechanism, component inventory, layout                |
| [03-IMPLEMENTATION-PLAN.md](./03-IMPLEMENTATION-PLAN.md) | Ordered, checkable task list with status                                     |
| [04-CICD.md](./04-CICD.md)                               | Fork release pipeline (GitHub Actions) + how it stays separate from upstream |
| [05-COMPATIBILITY-RISKS.md](./05-COMPATIBILITY-RISKS.md) | Risk table + the Vaultwarden acceptance test                                 |
| [FORK-VERSIONING.md](./FORK-VERSIONING.md)               | How fork versions stay separate from upstream                                |

## Golden rules (do not break)

1. **Never** modify encryption/decryption, key management, auth, sync, or API
   payloads. No edits to `libs/common`, `libs/key-management`, `libs/auth`,
   `apps/desktop/desktop_native`.
2. **Never** import core/crypto from UI code. Core access goes through
   `@klappstuhl/ui-bridge` only.
3. **Never** edit upstream files when an additive fork file will do (theme
   override, new libs, new CI workflow). This is what keeps `git merge upstream`
   clean.
4. All Tailwind classes use the **`tw-` prefix**.
