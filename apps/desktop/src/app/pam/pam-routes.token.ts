import { LoadChildrenCallback } from "@angular/router";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Lazy loader for the commercial PAM pages, mounted under `/pam` inside the shared
 * `DesktopLayoutComponent` so the side nav's relative links resolve. Unprovided, `/pam` never
 * matches.
 */
export const PAM_DESKTOP_ROUTES = new SafeInjectionToken<LoadChildrenCallback>("PamDesktopRoutes");
