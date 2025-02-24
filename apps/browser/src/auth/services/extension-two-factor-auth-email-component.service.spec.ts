import { MockProxy, mock } from "jest-mock-extended";

import { DialogService } from "@bitwarden/components";

// Must mock modules before importing
jest.mock("../popup/utils/auth-popout-window", () => {
  const originalModule = jest.requireActual("../popup/utils/auth-popout-window");

  return {
    ...originalModule, // avoid losing the original module's exports
    openTwoFactorAuthEmailPopout: jest.fn(),
  };
});

jest.mock("../../platform/popup/browser-popup-utils", () => ({
  inPopup: jest.fn(),
}));

import { openTwoFactorAuthEmailPopout } from "../../auth/popup/utils/auth-popout-window";
import BrowserPopupUtils from "../../platform/popup/browser-popup-utils";

import { ExtensionTwoFactorAuthEmailComponentService } from "./extension-two-factor-auth-email-component.service";

describe("ExtensionTwoFactorAuthEmailComponentService", () => {
  let extensionTwoFactorAuthEmailComponentService: ExtensionTwoFactorAuthEmailComponentService;

  let dialogService: MockProxy<DialogService>;
  let window: MockProxy<Window>;

  beforeEach(() => {
    jest.clearAllMocks();

    dialogService = mock<DialogService>();
    window = mock<Window>();

    extensionTwoFactorAuthEmailComponentService = new ExtensionTwoFactorAuthEmailComponentService(
      dialogService,
      window,
    );
  });

  describe("openPopoutIfApprovedForEmail2fa", () => {
    it("should open a popout if the user confirms the warning to popout the extension when in the popup", async () => {
      // Arrange
      dialogService.openSimpleDialog.mockResolvedValue(true);

      jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(true);

      // Act
      await extensionTwoFactorAuthEmailComponentService.openPopoutIfApprovedForEmail2fa();

      // Assert
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "warning" },
        content: { key: "popup2faCloseMessage" },
        type: "warning",
      });

      expect(openTwoFactorAuthEmailPopout).toHaveBeenCalled();
    });

    it("should not open a popout if the user cancels the warning to popout the extension when in the popup", async () => {
      // Arrange
      dialogService.openSimpleDialog.mockResolvedValue(false);

      jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(true);

      // Act
      await extensionTwoFactorAuthEmailComponentService.openPopoutIfApprovedForEmail2fa();

      // Assert
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "warning" },
        content: { key: "popup2faCloseMessage" },
        type: "warning",
      });

      expect(openTwoFactorAuthEmailPopout).not.toHaveBeenCalled();
    });

    it("should not open a popout if not in the popup", async () => {
      // Arrange
      jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(false);

      // Act
      await extensionTwoFactorAuthEmailComponentService.openPopoutIfApprovedForEmail2fa();

      // Assert
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(openTwoFactorAuthEmailPopout).not.toHaveBeenCalled();
    });
  });
});
