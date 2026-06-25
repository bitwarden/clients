---
paths:
  - "**/*.html"
  - "**/*.component.ts"
  - "**/*.directive.ts"
---

# Tailwind

Distilled from [Web Code Style — Tailwind](https://contributing.bitwarden.com/contributing/code-style/web/tailwind). The `tw-` prefix rule lives in the root [CLAUDE.md](../CLAUDE.md) so it loads on every session.

## No Arbitrary Values

Do not use Tailwind's arbitrary-value syntax (e.g. `tw-[12px]`, `tw-text-[#ff0000]`). The only exception is preserving an existing Bootstrap style during migration — in that case, document it inline and add a tech-debt note for follow-up.

## Theme Tokens Only

Colors are restricted to the project's theme tokens (CSS variables wired into the Tailwind config) so multiple themes work. Use semantic tokens like `tw-bg-background-alt2`, not raw Tailwind colors (`tw-bg-gray-100`, `tw-text-red-500`).

The canonical theme is defined in [libs/components/tailwind.config.base.js](../../libs/components/tailwind.config.base.js); check it for available tokens before adding new color or spacing values. App-specific configs (`apps/<app>/tailwind.config.js`) extend the base.
