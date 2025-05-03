import { Injectable } from "@angular/core";

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
    if (browserClient === BrowserClientVendors.Unknown) {
      return false;
    }

    if (await BrowserApi.permissionsGranted(["privacy"])) {
      return BrowserApi.browserAutofillSettingsOverridden();
    }
  }
}
