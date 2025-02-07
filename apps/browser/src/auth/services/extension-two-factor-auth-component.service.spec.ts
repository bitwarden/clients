import { MockProxy, mock } from "jest-mock-extended";

// Must mock modules before importing
jest.mock("../popup/utils/auth-popout-window", () => {
  const originalModule = jest.requireActual("../popup/utils/auth-popout-window");

  return {
    ...originalModule, // avoid losing the original module's exports
    closeSsoAuthResultPopout: jest.fn(),
    closeTwoFactorAuthWebAuthnPopout: jest.fn(),
    closeTwoFactorAuthEmailPopout: jest.fn(),
  };
});

jest.mock("../../platform/popup/browser-popup-utils", () => ({
  inSingleActionPopout: jest.fn(),
}));

import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";

import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/popup/browser-popup-utils";
import {
  AuthPopoutType,
  closeSsoAuthResultPopout,
  closeTwoFactorAuthEmailPopout,
  closeTwoFactorAuthWebAuthnPopout,
} from "../popup/utils/auth-popout-window";

import { ExtensionTwoFactorAuthComponentService } from "./extension-two-factor-auth-component.service";

describe("ExtensionTwoFactorAuthComponentService", () => {
  let extensionTwoFactorAuthComponentService: ExtensionTwoFactorAuthComponentService;
  let window: MockProxy<Window>;

  beforeEach(() => {
    jest.clearAllMocks();

    window = mock<Window>();
    document.body.className = ""; // Reset any added classes between tests.

    extensionTwoFactorAuthComponentService = new ExtensionTwoFactorAuthComponentService(window);
  });

  describe("shouldCheckForWebAuthnQueryParamResponse", () => {
    it("should return true for the extension", () => {
      expect(
        extensionTwoFactorAuthComponentService.shouldCheckForWebAuthnQueryParamResponse(),
      ).toBe(true);
    });
  });

  describe("extendPopupWidthIfRequired", () => {
    it("should add linux-webauthn class to body if selected2faProviderType is WebAuthn and isLinux is true", async () => {
      jest
        .spyOn(extensionTwoFactorAuthComponentService as unknown as any, "isLinux")
        .mockResolvedValue(true);

      await extensionTwoFactorAuthComponentService.extendPopupWidthIfRequired(
        TwoFactorProviderType.WebAuthn,
      );
      expect(document.body.classList).toContain("linux-webauthn");
    });

    it("should not add linux-webauthn class to body if selected2faProviderType is WebAuthn and isLinux is false", async () => {
      jest
        .spyOn(extensionTwoFactorAuthComponentService as unknown as any, "isLinux")
        .mockResolvedValue(false);

      await extensionTwoFactorAuthComponentService.extendPopupWidthIfRequired(
        TwoFactorProviderType.WebAuthn,
      );
      expect(document.body.classList).not.toContain("linux-webauthn");
    });

    it.each([
      [true, TwoFactorProviderType.Email],
      [false, TwoFactorProviderType.Email],
    ])(
      "should not add linux-webauthn class to body if selected2faProviderType is not WebAuthn and isLinux is %s",
      async (isLinux, selected2faProviderType) => {
        jest
          .spyOn(extensionTwoFactorAuthComponentService as unknown as any, "isLinux")
          .mockResolvedValue(isLinux);

        await extensionTwoFactorAuthComponentService.extendPopupWidthIfRequired(
          selected2faProviderType,
        );

        expect(document.body.classList).not.toContain("linux-webauthn");
      },
    );
  });

  describe("removePopupWidthExtension", () => {
    it("should remove linux-webauthn class from body", () => {
      document.body.classList.add("linux-webauthn");
      extensionTwoFactorAuthComponentService.removePopupWidthExtension();
      expect(document.body.classList).not.toContain("linux-webauthn");
    });
  });

  describe("closeSingleActionPopouts", () => {
    it("should call closeSsoAuthResultPopout if in SSO auth result popout", async () => {
      const inSingleActionPopoutSpy = jest
        .spyOn(BrowserPopupUtils, "inSingleActionPopout")
        .mockImplementation((_, key) => {
          return key === AuthPopoutType.ssoAuthResult;
        });

      await extensionTwoFactorAuthComponentService.closeSingleActionPopouts();

      expect(inSingleActionPopoutSpy).toHaveBeenCalledTimes(1);
      expect(closeSsoAuthResultPopout).toHaveBeenCalled();
    });

    it("should call closeTwoFactorAuthWebAuthnPopout if in two factor auth webauthn popout", async () => {
      const inSingleActionPopoutSpy = jest
        .spyOn(BrowserPopupUtils, "inSingleActionPopout")
        .mockImplementation((_, key) => {
          return key === AuthPopoutType.twoFactorAuthWebAuthn;
        });

      await extensionTwoFactorAuthComponentService.closeSingleActionPopouts();

      expect(inSingleActionPopoutSpy).toHaveBeenCalledTimes(2);
      expect(closeTwoFactorAuthWebAuthnPopout).toHaveBeenCalled();
    });

    it("should call closeTwoFactorAuthEmailPopout if in two factor auth email popout", async () => {
      const inSingleActionPopoutSpy = jest
        .spyOn(BrowserPopupUtils, "inSingleActionPopout")
        .mockImplementation((_, key) => {
          return key === AuthPopoutType.twoFactorAuthEmail;
        });

      await extensionTwoFactorAuthComponentService.closeSingleActionPopouts();

      expect(inSingleActionPopoutSpy).toHaveBeenCalledTimes(3);
      expect(closeTwoFactorAuthEmailPopout).toHaveBeenCalled();
    });
  });

  describe("reloadOpenWindows", () => {
    it("should call reload open windows (exempting current)", async () => {
      const reloadOpenWindowsSpy = jest.spyOn(BrowserApi, "reloadOpenWindows").mockImplementation();

      extensionTwoFactorAuthComponentService.reloadOpenWindows();

      expect(reloadOpenWindowsSpy).toHaveBeenCalledWith(true);
    });
  });
});
