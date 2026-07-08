---
paths:
  - "apps/cli/stores/snap/snapcraft.yaml"
  - "apps/desktop/electron-builder.json"
---

# Snap Permissions (Plugs)

A `snapcraft.yaml` declares the [plugs](https://snapcraft.io/docs/supported-interfaces) (interfaces)
that the snap requests at runtime. Snap uses strict confinement, so every plug grants additional
access to the host system.

Snap plugs are declared in two places:

- `apps/cli/stores/snap/snapcraft.yaml` — under `apps.<app>.plugs:` (YAML list)
- `apps/desktop/electron-builder.json` — under `snap.plugs` (JSON array)
  For the CLI app we directly use a `snapcraft.yaml` file, while for the Desktop app we use
  `electron-builder` to generate the `snapcraft.yaml` file from `electron-builder.json`.

## Adding new plugs

When a PR adds a new entry to the `plugs:` list, the code reviewer **must** confirm one of the
following before approving:

1. **Non-privileged interface** — the interface is not
   [privileged](https://snapcraft.io/docs/supported-interfaces) (i.e. it is auto-connected and does
   not require Snap Store manual review). The PR description must state this explicitly.
2. **Forum approval obtained** — the interface is privileged, and the author has already requested
   and been granted permission on the [Snapcraft forum](https://forum.snapcraft.io/). The PR
   description must include a direct link to the approved forum thread.

- **Code review:** when reviewing a diff that adds a plug, verify that the PR description contains
  one of the two confirmations above. If neither is present, request it before approving.
- **PR authors:** include the confirmation (or forum link) in your PR description whenever you add a
  plug. Do not assume reviewers will look it up.
