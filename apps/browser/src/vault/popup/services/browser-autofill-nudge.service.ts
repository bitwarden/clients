import { Injectable } from "@angular/core";
import { combineLatest, Observable, switchMap } from "rxjs";

import { NudgeStatus, NudgeType } from "@bitwarden/angular/vault";
import { NewAccountNudgeService } from "@bitwarden/angular/vault/services/custom-nudges-services/new-account-nudge.service";
import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { BrowserClientVendors } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";

import { BrowserApi } from "../../../platform/browser/browser-api";

/**
 * Browser-specific autofill nudge service.
 * Extends NewAccountNudgeService (30-day account age check) and adds
 * browser autofill setting detection.
 *
 * Nudge is dismissed if:
 * - Account is older than 30 days (inherited from NewAccountNudgeService)
 * - Browser's built-in password manager is already disabled via privacy settings
 * - User chose to hide nudges in Autofill settings
 */
@Injectable()
export class BrowserAutofillNudgeService extends NewAccountNudgeService {
  constructor(
    stateProvider: StateProvider,
    vaultProfileService: VaultProfileService,
    logService: LogService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
  ) {
    super(stateProvider, vaultProfileService, logService);
  }

  override nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    return combineLatest([
      super.nudgeStatus$(nudgeType, userId),
      this.autofillSettingsService.autofillBrowserNudgeDisabled$,
    ]).pipe(
      switchMap(async ([status, nudgeDisabled]) => {
        if (nudgeDisabled) {
          return {
            hasBadgeDismissed: true,
            hasSpotlightDismissed: true,
          };
        }

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
