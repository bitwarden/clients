import { combineLatest, map, Observable } from "rxjs";

import { AutofillOverlayVisibility } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";

/**
 * Passive DOM monitoring (mutation observers, page-details refresh on load) is only
 * needed when a feature will consume live field metadata without an explicit user action.
 */
export function passiveAutofillMonitoringEnabled$(
  autofillSettingsService: AutofillSettingsServiceAbstraction,
  domainSettingsService: DomainSettingsService,
): Observable<boolean> {
  return combineLatest([
    autofillSettingsService.autofillOnPageLoad$,
    autofillSettingsService.inlineMenuVisibility$.pipe(
      map((visibility) => visibility !== AutofillOverlayVisibility.Off),
    ),
    domainSettingsService.resolvedEnableFillAssist$,
  ]).pipe(
    map(([autofillOnPageLoad, inlineMenuEnabled, fillAssistEnabled]) => {
      return autofillOnPageLoad || inlineMenuEnabled || fillAssistEnabled;
    }),
  );
}
