import { LoadChildrenCallback } from "@angular/router";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Lazy loader for the commercial PAM user pages, mounted under `/pam` inside the shared
 * `UserLayoutComponent` so the side nav's relative links resolve. Unprovided, `/pam` never matches.
 */
export const PAM_ROUTES = new SafeInjectionToken<LoadChildrenCallback>("PamRoutes");
