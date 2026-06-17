# 00 — Overview

## Goal

Transform the desktop client into a modern, premium password manager UI on par
with the **1Password** and **Proton Pass** desktop apps — while remaining fully
compatible with **Vaultwarden** and easy to update from **upstream
bitwarden/clients**.

## What the app is (verified facts)

- Fork of `bitwarden/clients` — an **Nx monorepo**, **Angular 21**, Electron 39.
- Desktop renderer: `apps/desktop/src/app/**` (Angular), bundled by **webpack**,
  packaged by **electron-builder** (`apps/desktop/electron-builder.json`).
- Native code: `apps/desktop/desktop_native` (Rust, NAPI) — secure storage etc.
- Core logic: `libs/common` (api/sync/state, framework-agnostic TS),
  `libs/key-management`, `libs/auth`, `libs/vault`, `libs/platform`.
- Styling substrate already present: **Tailwind 3.4** (mandatory `tw-` prefix) +
  the Bitwarden Component Library (`libs/components`) themed via CSS custom
  properties in `libs/components/src/tw-theme.css` (`.theme_light` / `.theme_dark`).

## In scope

- New design system (tokens, theme, primitives) → `@klappstuhl/ui-kit`.
- New app shell: left sidebar nav, split-pane (list + detail), command palette
  (Cmd/Ctrl+K), search-first UX, quick-copy, inline reveal, TOTP UI, keyboard nav.
- A bridge/adapter layer for safe core access → `@klappstuhl/ui-bridge`.
- A separate, additive fork release pipeline.

## Out of scope (hard constraints — never do these)

- Re-implementing or modifying encryption, decryption, key management, auth, sync.
- Changing API contracts with Vaultwarden / Bitwarden server.
- Editing `libs/common`, `libs/key-management`, `libs/auth`, `desktop_native`.
- Rewriting the renderer to React/Vite/shadcn (breaks upstream mergeability —
  see [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) for the decision record).
- Removing/replacing upstream CI workflows (we add our own instead).

## Design goal in one line

Dark-mode-first, search-first, keyboard-first. Strong type hierarchy, generous
spacing, subtle blur/depth, smooth motion, minimal clutter.
