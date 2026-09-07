import { LoadChildrenCallback } from "@angular/router";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Lazy route loader for the commercial PAM feature's user-scoped pages ("Access requests").
 *
 * A host that ships privileged access provides a loader returning those routes; the OSS root
 * shell mounts them under `/pam` as children of the same `UserLayoutComponent` instance every
 * other user page renders in, since the side nav's relative `routerLink`s resolve against that
 * layout.
 *
 * Read `{ optional: true }` by the route's `canMatch`, so an OSS-only build never matches `/pam`.
 */
export const PAM_ROUTES = new SafeInjectionToken<LoadChildrenCallback>("PamRoutes");
