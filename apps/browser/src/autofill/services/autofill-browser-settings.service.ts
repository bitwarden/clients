// FIXME (PM-22628): angular imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

import { BrowserClientVendors } from "@bitwarden/common/autofill/constants";
import { BrowserClientVendor } from "@bitwarden/common/autofill/types";

import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/browser/browser-popup-utils";
import {
  applyDefaultPasswordManagerOverride,
  getDefaultPasswordManagerSessionState,
  setDefaultPasswordManagerSessionState,
} from "../default-password-manager-session.util";

export type DisableBrowserAutofillAsDefaultPasswordManagerResult = "applied" | "denied";

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

  async isDefaultPasswordManagerPromptFlowComplete(): Promise<boolean> {
    const sessionState = await getDefaultPasswordManagerSessionState();

    if (sessionState === "show-toast") {
      return BrowserApi.permissionsGranted(["privacy"]);
    }

    if (!(await BrowserApi.permissionsGranted(["privacy"]))) {
      return false;
    }

    return BrowserApi.browserAutofillSettingsOverridden();
  }

  private async hasGrantedPendingDefaultPasswordManagerApply(): Promise<boolean> {
    if ((await getDefaultPasswordManagerSessionState()) !== "pending") {
      return false;
    }

    if (!(await BrowserApi.permissionsGranted(["privacy"]))) {
      await setDefaultPasswordManagerSessionState(null);
      return false;
    }

    return true;
  }

  async resumeGrantedPendingDefaultPasswordManagerApply(
    browserClient: BrowserClientVendor,
  ): Promise<boolean | null> {
    if (!(await this.hasGrantedPendingDefaultPasswordManagerApply())) {
      return null;
    }

    if (!(await this.isBrowserAutofillSettingOverridden(browserClient))) {
      await applyDefaultPasswordManagerOverride();
    } else {
      await setDefaultPasswordManagerSessionState(null);
    }

    return true;
  }

  async completeFirefoxPopupPermissionFlow(window: Window): Promise<void> {
    await setDefaultPasswordManagerSessionState("pending");

    if (BrowserPopupUtils.inPopup(window)) {
      BrowserApi.closePopup(window);
    }
  }

  async ensurePrivacyPermissionForOverride(): Promise<boolean> {
    if (await BrowserApi.permissionsGranted(["privacy"])) {
      return true;
    }

    await setDefaultPasswordManagerSessionState("pending");

    if (BrowserApi.isFirefox) {
      this.requestPrivacyPermissionFromUserGesture();
      return false;
    }

    const granted = await BrowserApi.requestPermission({ permissions: ["privacy"] });

    if ((await getDefaultPasswordManagerSessionState()) === "pending") {
      await setDefaultPasswordManagerSessionState(null);
    }

    return Boolean(granted);
  }

  requestPrivacyPermissionFromUserGesture(): void {
    void BrowserApi.requestPermission({ permissions: ["privacy"] });
  }

  async disableBrowserAutofillAsDefaultPasswordManager(): Promise<DisableBrowserAutofillAsDefaultPasswordManagerResult> {
    if (!(await this.ensurePrivacyPermissionForOverride())) {
      return "denied";
    }

    await applyDefaultPasswordManagerOverride();
    return "applied";
  }

  private _defaultBrowserAutofillDisabled$ = new BehaviorSubject<boolean>(false);

  defaultBrowserAutofillDisabled$: Observable<boolean> =
    this._defaultBrowserAutofillDisabled$.asObservable();

  setDefaultBrowserAutofillDisabled(value: boolean) {
    this._defaultBrowserAutofillDisabled$.next(value);
  }
}
