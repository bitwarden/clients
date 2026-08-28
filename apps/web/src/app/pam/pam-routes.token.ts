import { LoadChildrenCallback } from "@angular/router";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Lazy route loader for the commercial PAM feature's user-scoped pages ("Access requests").
 *
 * A host that ships privileged access provides a loader returning those routes, or the NgModule
 * declaring them; the OSS root shell mounts them under `/pam` as children of the same
 * `UserLayoutComponent` instance every other user page renders in. Sharing that instance is the
 * point rather than an incidental tidiness: the side nav's `routerLink`s are relative, so they
 * resolve against the `ActivatedRoute` of the layout rendering them, and a second layout mounted
 * at a top-level path re-bases all ~20 of them beneath it.
 *
 * Read `{ optional: true }` by the route's `canMatch`, so an OSS-only build, where nothing
 * provides it, never matches `/pam` and behaves as if PAM did not exist.
 */
export const PAM_ROUTES = new SafeInjectionToken<LoadChildrenCallback>("PamRoutes");
