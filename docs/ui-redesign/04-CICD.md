# 04 — CI/CD

## Strategy: additive, never destructive

Upstream has a complex **signed** desktop pipeline (`.github/workflows/build-desktop.yml`)
plus many other workflows. We **do not touch any of them** — modifying them would
create recurring merge conflicts. Instead we add **one** new workflow:

- `.github/workflows/release-ui-fork.yml` — builds **unsigned** Win/macOS/Linux
  artifacts and attaches them to a GitHub Release.

## What it does

- **Trigger:** push of a tag matching `v*-ui` (e.g. `v2026.6.0-ui`), or manual
  `workflow_dispatch`.
- **Matrix:** `windows-latest`, `macos-latest`, `ubuntu-latest`.
- **Steps:** checkout → Node 22.12 → Rust (for `desktop_native`) → `npm ci` (Nx
  workspace) → `npm run build-native` → `npm run build` (webpack main/renderer/
  preload) → `npx electron-builder <targets> -p never` → upload → Release.

## Key choices & gotchas

- **Explicit electron-builder targets on the CLI** (`--win nsis`, `--mac dmg zip`,
  `--linux AppImage deb`) override the snap/flatpak targets in
  `apps/desktop/electron-builder.json`. This avoids needing snapcraft/flatpak on
  the runners — the repo's own `dist:lin` script bundles snap packaging, which
  would fail on a vanilla Ubuntu runner. **Do not** swap the workflow to
  `npm run dist:lin` for that reason.
- **Unsigned by design.** `CSC_IDENTITY_AUTO_DISCOVERY=false` disables mac
  auto-signing. To sign later: add `CSC_LINK`/`CSC_KEY_PASSWORD` (Windows/mac)
  and notarization (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`)
  as repo secrets and a signing/notarize step. Keep it in _this_ fork workflow,
  not upstream's.
- **macOS arches:** we build `--x64 --arm64` (separate) rather than `--universal`
  to keep CI fast; switch to `--universal` if you need a single binary.
- **Native rebuild:** `apps/desktop` has a `postinstall: electron-rebuild`; CI
  runners have the toolchain, so it just works after `npm ci`.

## Versioning hook

Releases are named from the tag (`Klappstuhl Pass v2026.6.0-ui`). The `-ui`
suffix is what distinguishes fork releases from upstream — see
[FORK-VERSIONING.md](./FORK-VERSIONING.md).
