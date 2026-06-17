# Klappstuhl Fork — Bitwarden Desktop UI Redesign

A **UI-layer redesign** of the Bitwarden desktop client (a fork of
[`bitwarden/clients`](https://github.com/bitwarden/clients)), built to look and feel
like a modern premium password manager (1Password / Proton Pass style) while keeping
the original encryption, sync, authentication, and **Vaultwarden** compatibility
**100% intact**.

> Base app version: **2026.6.0** · Stack: Angular 21 · Nx · Electron · Tailwind (`tw-` prefix)

---

## Guiding principles

1. **Never touch security.** No changes to encryption, decryption, key management,
   authentication, sync, or the Vaultwarden/Bitwarden API. Those modules
   (`libs/common`, `libs/key-management`, `libs/auth`, `apps/desktop/desktop_native`)
   are treated as black-box stable dependencies.
2. **Stay merge-safe with upstream.** Almost all new code lives in **new files**.
   Only a short, documented list of upstream files is touched, each with a tiny
   additive hunk — see [`docs/ui-redesign/05-COMPATIBILITY-RISKS.md`](docs/ui-redesign/05-COMPATIBILITY-RISKS.md).
3. **The UI talks to core only through a bridge.** New UI code reaches Bitwarden
   services exclusively via `@klappstuhl/ui-bridge` — it never builds API payloads
   or re-implements crypto.

---

## Architecture

| Layer | Location | Purpose |
|-------|----------|---------|
| **Design system** | `libs/ui-kit` (`@klappstuhl/ui-kit`) | Theme tokens + reusable primitives (button, copy-field, reveal-field, TOTP ring, strength meter). |
| **Bridge** | `libs/ui-bridge` (`@klappstuhl/ui-bridge`) | The *only* fork lib allowed to import `@bitwarden/*`. Wraps `CipherService`, `TotpService`, clipboard, lock, password-strength into a presentation-friendly API. |
| **App shell** | `apps/desktop/src/app/redesign/` | The redesigned vault UI (sidebar, split-pane list + detail, command palette). Mounted at `/redesign`, which **replaces** `/vault` for logged-in users. |
| **Spotlight** | `apps/desktop/src/spotlight/` + `apps/desktop/src/main/quick-access.main.ts` | Standalone Quick Access window (see below). |
| **Theme** | `libs/ui-kit/src/theme/fork-theme.css` + `fork-overlays.css` | Reskins the whole app by overriding CSS token *values*; imported last in `apps/desktop/src/scss/tailwind.css`. |

Full design notes live in [`docs/ui-redesign/`](docs/ui-redesign/).

---

## Features & changes

### Visual redesign
- **Apple-style glass theme** — rounded surfaces, frosted/translucent panels,
  backdrop blur, soft layered shadows, and smooth motion, all driven by `--fk-*`
  design tokens. Dark-mode first, light mode supported.
- **Sidebar** — translucent blurred nav with categories (All items, Logins, Cards,
  Identities, Secure notes, SSH keys, Favorites, Trash), Folders, and Collections;
  a gradient **New Item** button; a **Tools** section (Generator, Import, Export);
  and an **account-card footer** showing the account avatar **and name/email** next
  to a settings button.
- **Split-pane** — instant-search item list (CDK virtual scroll, hover quick-copy)
  beside a **detail panel** that composes the ui-kit primitives.
- **Detail panel** — copy/reveal fields, live TOTP countdown ring, an **inline
  password-strength tag** (Weak/Fair/Good/Strong) in the password row, combined
  Website section, and **inline editing** (Edit → Save/Cancel) that persists through
  the bridge.
- **Dialog & input reskin** — both modern (`bit-dialog`) and legacy (`.modal-content`,
  e.g. Settings) dialogs get the frosted/rounded treatment, including inner sections,
  native inputs, and buttons.

### Interactions
- **Command palette** — `Ctrl/Cmd+K` glassmorphic overlay with instant filter and
  keyboard navigation.
- **Keyboard map** — arrow keys to move selection, copy shortcuts, `/` to focus
  search, reduced-motion aware.
- **New Item / Generator / Import / Export / Settings** — wired to the real
  Bitwarden dialogs.

### Quick Access spotlight (the headline feature)
A separate **frameless, transparent, always-on-top** window summoned by a global
**`Ctrl/Cmd+Shift+Space`** — *without* opening the main app (it just needs to be
running, e.g. in the tray, and the vault unlocked).

- Instant vault search with **website favicons** (letter-avatar fallback).
- **Enter** copies the password; **→** opens a per-item **submenu** of available
  actions (Copy username / password / 2FA code, and **Open & fill**), navigated with
  ↑/↓, **Enter** to copy, **←**/Esc to go back.
- **Open & fill** opens the login's website in your browser and copies the password
  to the clipboard (auto-clearing) ready to paste.
- **Security:** the spotlight window owns no vault data. It relays over IPC to the
  hidden main window, where all decryption and copying happen via the bridge —
  secrets never enter the spotlight process.

### Internationalization
- Nav categories, the edit/save buttons, and **all spotlight UI strings + actions**
  use Bitwarden's i18n (with English fallbacks). The spotlight, being a static page,
  receives a translated label bundle pushed from the renderer.

---

## Constraints honored
- No edits to `libs/common`, `libs/key-management`, `libs/auth`, or
  `apps/desktop/desktop_native`.
- No React/Vite/shadcn/Zustand — stays Angular. All Tailwind classes use the `tw-`
  prefix. Standalone components, `OnPush`, signals.
- Persistence always flows through `CipherService` (via the bridge); no hand-built
  API requests; no logging of decrypted/secret data.

---

## Run, build & package

> **Windows note:** use `npm install --ignore-scripts` for dependency installs — a
> plain `npm ci` wipes `node_modules` and EPERM-fails on `@napi-rs/*-wasm32-wasi`
> dirs. See [`docs/ui-redesign/`](docs/ui-redesign/) for more gotchas.

### Quick dev run (no installer)
```bash
cd apps/desktop
npm run build          # webpack: renderer + main + preload (one-shot, no watch)
npm start              # launches Electron against ./build  (no auto-reload)
```
Avoid the `--watch` dev flow while testing logged-in flows: a recompile reloads the
window and drops the in-memory session (looks like a logout).

### Build a Windows `.exe`

**Prerequisites**
- Node ≥ 22.12, npm ~10
- **Rust** (cargo) — to build the native module `desktop_native`
- **Visual Studio Build Tools** with the “Desktop development with C++” workload
  (MSVC + Windows SDK) — required to compile the native module on Windows

**Steps** (from `apps/desktop/`)
```bash
# 1. Rebuild native node deps for Electron (only needed once / after installs)
npx electron-rebuild

# 2. Build the Rust native module (biometrics, secure storage, etc.)
npm run build-native

# 3. Compile the app bundles
npm run build

# 4a. EASIEST: a single portable .exe (just double-click to run — no install)
npx electron-builder --win portable --x64 -p never

# 4b. OR a proper installer (Start-menu entry + uninstaller)
npx electron-builder --win nsis --x64 -p never
```
The output lands in **`apps/desktop/dist/`** (e.g. `Bitwarden 2026.6.0.exe` for the
portable build, or a `*-Setup-*.exe` for the NSIS installer).

> The repo's default `npm run pack:win` also targets `nsis-web` and `appx`, which
> need a publish URL and code-signing respectively — overriding the target to
> `portable`/`nsis` as above avoids that and produces an **unsigned local build**.
> Windows SmartScreen may warn on first launch of an unsigned app; choose
> “More info → Run anyway”.

### Point it at your Vaultwarden
On first launch, set the **Server URL** (Settings → self-hosted environment) to your
Vaultwarden instance, then log in as usual. All sync/crypto is unchanged from
upstream Bitwarden.

---

## Keeping up with upstream
Set up the upstream remote once and merge periodically; conflicts can only occur in
the short list of touched files (see the compatibility doc):
```bash
git remote add upstream https://github.com/bitwarden/clients.git
git fetch --unshallow        # one-time, if this was a shallow clone
git fetch upstream && git merge upstream/main
```
After merging, run the **Vaultwarden acceptance test** in
[`docs/ui-redesign/05-COMPATIBILITY-RISKS.md`](docs/ui-redesign/05-COMPATIBILITY-RISKS.md).

---

## Known limitations
- **Quick Access** requires the app to be running (tray/background) and the vault
  unlocked; a global shortcut can't wake a fully-quit process.
- **Open & fill** = launch website + copy password to clipboard. True keystroke
  autofill into a third-party browser is the browser extension's job; the desktop
  app can't inject into another app's web page.
- A few spotlight micro-labels have no dedicated Bitwarden i18n key and stay English
  in non-English locales until upstream adds one.
