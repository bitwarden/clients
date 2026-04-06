// FIXME (PM-22628): angular imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

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
  async isBrowserAutofillSettingOverridden(browserClient: BrowserClientVendor) {
    return (
      browserClient !== BrowserClientVendors.Unknown &&
      (await BrowserApi.browserAutofillSettingsOverridden())
    );
  }

  private _defaultBrowserAutofillDisabled$ = new BehaviorSubject<boolean>(false);

  defaultBrowserAutofillDisabled$: Observable<boolean> =
    this._defaultBrowserAutofillDisabled$.asObservable();

  setDefaultBrowserAutofillDisabled(value: boolean) {
    this._defaultBrowserAutofillDisabled$.next(value);
  }
}
