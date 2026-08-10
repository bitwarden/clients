import { Observable } from "rxjs";

import { BottomNavigationButton } from "@bitwarden/components";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * The Health tab's entry in the popup's bottom navigation, rendered between Send and Settings.
 *
 * The Health report feature ships only with the commercial extension, which provides this token
 * from `bitwarden_license/bit-browser`. It emits `undefined` when the active User does not have
 * access to the feature, and is not provided at all in the open source extension; in both cases the
 * Health tab is hidden.
 */
export const HEALTH_TAB_NAV_BUTTON = new SafeInjectionToken<
  Observable<BottomNavigationButton | undefined>
>("HEALTH_TAB_NAV_BUTTON");
