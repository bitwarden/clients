import { Injectable } from "@angular/core";
import { Observable, switchMap } from "rxjs";

import { NudgeStatus, NudgeType } from "@bitwarden/angular/vault";
import { NewAccountNudgeService } from "@bitwarden/angular/vault/services/custom-nudges-services/new-account-nudge.service";
import { BrowserClientVendors } from "@bitwarden/common/autofill/constants";
import { UserId } from "@bitwarden/common/types/guid";

import { BrowserApi } from "../../../platform/browser/browser-api";

/**
 * Browser-specific autofill nudge service.
 * Extends NewAccountNudgeService (30-day account age check) and adds
 * browser autofill setting detection.
 *
 * Nudge is dismissed if:
 * - Account is older than 30 days (inherited from NewAccountNudgeService)
 * - Browser's built-in password manager is already disabled via privacy settings
 */
@Injectable()
export class BrowserAutofillNudgeService extends NewAccountNudgeService {
  override nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    return super.nudgeStatus$(nudgeType, userId).pipe(
      switchMap(async (status) => {
        const browserClient = BrowserApi.getBrowserClientVendor(window);
        const browserAutofillOverridden =
          browserClient !== BrowserClientVendors.Unknown &&
          (await BrowserApi.browserAutofillSettingsOverridden());

        return {
          hasBadgeDismissed: status.hasBadgeDismissed || browserAutofillOverridden,
          hasSpotlightDismissed: status.hasSpotlightDismissed || browserAutofillOverridden,
        };
      }),
    );
  }
}
