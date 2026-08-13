import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * The component rendered as the body of the Health tab.
 *
 * The Health tab shell (route, header, and first-open tracking) is open source,
 * but the vault-health report itself is a licensed feature: the report service
 * lives in `bitwarden_license/bit-common` and the views in
 * `bitwarden_license/bit-browser`, neither of which `apps/browser` may import.
 * The licensed build provides its Health component through this token and the
 * shell renders it, so the dependency only ever points from licensed code to
 * open source.
 *
 * Unprovided in the open-source build, where the Health tab renders as an empty
 * shell. Inject with `{ optional: true }`.
 */
export const HEALTH_CONTENT = new SafeInjectionToken<Type<unknown>>("HEALTH_CONTENT");
