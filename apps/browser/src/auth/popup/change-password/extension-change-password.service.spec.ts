import { MockProxy, mock } from "jest-mock-extended";

import { ChangePasswordService } from "@bitwarden/angular/auth/password-management/change-password";
import BrowserPopupUtils from "@bitwarden/browser/platform/browser/browser-popup-utils";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeyService } from "@bitwarden/key-management";

import { BrowserApi } from "../../../platform/browser/browser-api";

import { ExtensionChangePasswordService } from "./extension-change-password.service";

describe("ExtensionChangePasswordService", () => {
  let keyService: MockProxy<KeyService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let window: MockProxy<Window>;

  let changePasswordService: ChangePasswordService;

  beforeEach(() => {
    keyService = mock<KeyService>();
    masterPasswordApiService = mock<MasterPasswordApiService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    window = mock<Window>();

    changePasswordService = new ExtensionChangePasswordService(
      keyService,
      masterPasswordApiService,
      masterPasswordService,
      window,
    );
  });

  it("should instantiate the service", () => {
    expect(changePasswordService).toBeDefined();
  });

  it("should close the browser extension popout", () => {
    const closePopupSpy = jest.spyOn(BrowserApi, "closePopup");
    const browserPopupUtilsInPopupSpy = jest
      .spyOn(BrowserPopupUtils, "inPopout")
      .mockReturnValue(true);

    changePasswordService.closeBrowserExtensionPopout?.();

    expect(closePopupSpy).toHaveBeenCalledWith(window);
    expect(browserPopupUtilsInPopupSpy).toHaveBeenCalledWith(window);
  });
});
