import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Optional banner rendered at the top of the cipher view. Hosts that surface a
 * privileged-access feature (currently the web vault) provide the banner
 * component class via this token; platforms without it (browser, desktop,
 * emergency access) leave it unprovided, so the cipher view injects `null` and
 * renders nothing. The token holds the component CLASS — `cipher-view` renders
 * it with `NgComponentOutlet`, passing a `cipherId` string input — so `libs/vault`
 * does not depend on the feature library that implements the banner.
 */
export const CIPHER_VIEW_BANNER = new SafeInjectionToken<Type<unknown>>("CipherViewBanner");
