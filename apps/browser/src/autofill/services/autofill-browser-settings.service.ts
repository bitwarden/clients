import { Injectable } from "@angular/core";
import { Observable, of, from } from "rxjs";
import { switchMap } from "rxjs/operators";

import { BrowserClientVendors } from "@bitwarden/common/autofill/constants";
import { BrowserClientVendor } from "@bitwarden/common/autofill/types";

import { BrowserApi } from "../../platform/browser/browser-api";

/**
 * Service class for various Autofill-related browser API operations.
 */
@Injectable({
  providedIn: "root",
})
export class AutofillBrowserSettingsService {
  browserAutofillSettingOverridden$(browserClient: BrowserClientVendor): Observable<boolean> {
    if (browserClient === BrowserClientVendors.Unknown) {
      return of(false);
    }

    return from(BrowserApi.permissionsGranted(["privacy"])).pipe(
      switchMap((granted) => {
        if (!granted) {
          return of(false);
        }
        return from(BrowserApi.browserAutofillSettingsOverridden());
      }),
    );
  }
}
