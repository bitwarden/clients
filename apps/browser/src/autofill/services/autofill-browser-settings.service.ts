import { Injectable, inject } from "@angular/core";

import { BrowserClientVendors } from "@bitwarden/common/autofill/constants";
import { BrowserClientVendor } from "@bitwarden/common/autofill/types";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { BrowserApi } from "../../platform/browser/browser-api";

/**
 * Service class for various Autofill-related browser API operations.
 */
@Injectable({
  providedIn: "root",
})
export class AutofillBrowserSettingsService {
  platformUtilsService = inject(PlatformUtilsService);

  private getBrowserClientVendor(): BrowserClientVendor {
    if (this.platformUtilsService.isChrome()) {
      return BrowserClientVendors.Chrome;
    }

    if (this.platformUtilsService.isOpera()) {
      return BrowserClientVendors.Opera;
    }

    if (this.platformUtilsService.isEdge()) {
      return BrowserClientVendors.Edge;
    }

    if (this.platformUtilsService.isVivaldi()) {
      return BrowserClientVendors.Vivaldi;
    }

    return BrowserClientVendors.Unknown;
  }

  async browserAutofillSettingCurrentlyOverridden() {
    if (this.getBrowserClientVendor() === BrowserClientVendors.Unknown) {
      return false;
    }

    if (!(await BrowserApi.permissionsGranted(["privacy"]))) {
      return false;
    }

    return await BrowserApi.browserAutofillSettingsOverridden();
  }
}
