---
paths:
  - "apps/desktop/resources/com.bitwarden.desktop.devel.yaml"
---

# Flatpak Manifest

`com.bitwarden.desktop.devel.yaml` is the Flatpak manifest for desktop dev and CI builds
(`flatpak:dev`, `pack:lin:flatpak`). It is deliberately kept in sync with the upstream **Flathub**
manifest, which lives in a separate repository (see #12555, "Remove differences from flathub
flatpak manifest and devel manifest").

- **ALWAYS** when this file is changed, the same change must be upstreamed to the Flathub manifest
  to keep the two builds from diverging.
- **Code review:** when reviewing a diff that touches this manifest, add a note that the change
  should be upstreamed to the Flathub manifest.
