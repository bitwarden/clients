import { MockProxy, mock } from "jest-mock-extended";

import { ChangePasswordService } from "@bitwarden/angular/auth/password-management/change-password";
import BrowserPopupUtils from "@bitwarden/browser/platform/browser/browser-popup-utils";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeyService } from "@bitwarden/key-management";

import { BrowserApi } from "../../../platform/browser/browser-api";

import { ExtensionChangePasswordService } from "./extension-change-password.service";

describe("ExtensionChangePasswordService", () => {
  let keyService: MockProxy<KeyService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let masterPasswordUnlockService: MockProxy<MasterPasswordUnlockService>;
  let window: MockProxy<Window>;

  let sut: ChangePasswordService;

  beforeEach(() => {
    keyService = mock<KeyService>();
    masterPasswordApiService = mock<MasterPasswordApiService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    masterPasswordUnlockService = mock<MasterPasswordUnlockService>();
    window = mock<Window>();

    sut = new ExtensionChangePasswordService(
      keyService,
      masterPasswordApiService,
      masterPasswordService,
      masterPasswordUnlockService,
      window,
    );
  });

  it("should instantiate the service", () => {
    expect(sut).toBeDefined();
  });

  it("should close the browser extension popout", () => {
    const closePopupSpy = jest.spyOn(BrowserApi, "closePopup");
    const browserPopupUtilsInPopupSpy = jest
      .spyOn(BrowserPopupUtils, "inPopout")
      .mockReturnValue(true);

    sut.closeBrowserExtensionPopout?.();

    expect(closePopupSpy).toHaveBeenCalledWith(window);
    expect(browserPopupUtilsInPopupSpy).toHaveBeenCalledWith(window);
  });

  describe("shouldNavigateToRoot()", () => {
    it("should return true", () => {
      // Act
      const shouldNavigateToRoot = sut.shouldNavigateToRoot();

      // Assert
      expect(shouldNavigateToRoot).toBe(true);
    });
  });
});
