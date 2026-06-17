# Fork Versioning

The fork keeps **two** version lines that must not collide.

## Upstream version (unchanged)

`apps/desktop/package.json` `version` stays exactly as upstream sets it (e.g.
`2026.6.0`). Leaving it untouched keeps diffs/merges from upstream aligned. Do not
bump it for UI work.

## Fork / UI version (git tag)

Fork releases are identified by a **git tag suffix**: `vYYYY.M.P-ui`, e.g.
`v2026.6.0-ui`. The `release-ui-fork.yml` workflow triggers on `v*-ui` only, so
fork releases never clash with upstream tagging.

- Release candidates: `v2026.6.0-ui-rc1` → marked `prerelease` automatically
  (the workflow flags any tag containing `-rc`).
- Surface it in-app (optional): inject `UI_FORK_VERSION` at build time and show it
  in the About dialog next to the upstream version. `@klappstuhl/ui-kit` exports
  `UI_KIT_FORK_VERSION` as the design-system version marker.

## Rebasing from upstream

1. `git fetch upstream && git checkout main && git merge upstream/main`.
2. Conflicts should be limited to the short "intentionally touched" list in
   [05-COMPATIBILITY-RISKS.md](./05-COMPATIBILITY-RISKS.md).
3. Re-run the Vaultwarden acceptance test before tagging a new `-ui` release.
