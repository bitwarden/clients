import { BrowserClientVendors } from "@bitwarden/common/autofill/constants";

jest.mock("../default-password-manager-session.util", () => ({
  applyDefaultPasswordManagerOverride: jest.fn().mockResolvedValue(undefined),
  getDefaultPasswordManagerSessionState: jest.fn(),
  setDefaultPasswordManagerSessionState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../platform/browser/browser-api", () => ({
  BrowserApi: {
    isFirefox: false,
    permissionsGranted: jest.fn(),
    requestPermission: jest.fn(),
    browserAutofillSettingsOverridden: jest.fn(),
    closePopup: jest.fn(),
  },
}));

jest.mock("../../platform/browser/browser-popup-utils", () => ({
  __esModule: true,
  default: {
    inPopup: jest.fn(),
  },
}));

import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/browser/browser-popup-utils";
import {
  applyDefaultPasswordManagerOverride,
  getDefaultPasswordManagerSessionState,
  setDefaultPasswordManagerSessionState,
} from "../default-password-manager-session.util";

import { AutofillBrowserSettingsService } from "./autofill-browser-settings.service";

const getDefaultPasswordManagerSessionStateMock =
  getDefaultPasswordManagerSessionState as jest.Mock;
const setDefaultPasswordManagerSessionStateMock =
  setDefaultPasswordManagerSessionState as jest.Mock;
const applyDefaultPasswordManagerOverrideMock = applyDefaultPasswordManagerOverride as jest.Mock;

describe("AutofillBrowserSettingsService", () => {
  let service: AutofillBrowserSettingsService;

  beforeEach(() => {
    service = new AutofillBrowserSettingsService();
    getDefaultPasswordManagerSessionStateMock.mockReset();
    setDefaultPasswordManagerSessionStateMock.mockReset();
    applyDefaultPasswordManagerOverrideMock.mockReset();
    jest.mocked(BrowserApi.permissionsGranted).mockReset();
    jest.mocked(BrowserApi.browserAutofillSettingsOverridden).mockReset();
    jest.mocked(BrowserApi.closePopup).mockReset();
    jest.mocked(BrowserApi.requestPermission).mockReset();
    BrowserApi.isFirefox = false;
    jest.mocked(BrowserPopupUtils.inPopup).mockReset();
  });

  describe("isDefaultPasswordManagerPromptFlowComplete", () => {
    it("returns false when show-toast is set but privacy permission was revoked", async () => {
      getDefaultPasswordManagerSessionStateMock.mockResolvedValue("show-toast");
      jest.mocked(BrowserApi.permissionsGranted).mockResolvedValue(false);

      await expect(service.isDefaultPasswordManagerPromptFlowComplete()).resolves.toBe(false);
    });

    it("returns true when show-toast is set and privacy permission is still granted", async () => {
      getDefaultPasswordManagerSessionStateMock.mockResolvedValue("show-toast");
      jest.mocked(BrowserApi.permissionsGranted).mockResolvedValue(true);

      await expect(service.isDefaultPasswordManagerPromptFlowComplete()).resolves.toBe(true);
    });
  });

  describe("resumeGrantedPendingDefaultPasswordManagerApply", () => {
    it("returns null when there is no granted pending apply", async () => {
      getDefaultPasswordManagerSessionStateMock.mockResolvedValue(null);

      await expect(
        service.resumeGrantedPendingDefaultPasswordManagerApply(BrowserClientVendors.Chrome),
      ).resolves.toBeNull();
    });

    it("returns null and clears pending when privacy permission is not granted", async () => {
      getDefaultPasswordManagerSessionStateMock.mockResolvedValue("pending");
      jest.mocked(BrowserApi.permissionsGranted).mockResolvedValue(false);

      await expect(
        service.resumeGrantedPendingDefaultPasswordManagerApply(BrowserClientVendors.Chrome),
      ).resolves.toBeNull();

      expect(setDefaultPasswordManagerSessionStateMock).toHaveBeenCalledWith(null);
    });

    it("returns true and applies override when pending, granted, and not yet overridden", async () => {
      getDefaultPasswordManagerSessionStateMock.mockResolvedValue("pending");
      jest.mocked(BrowserApi.permissionsGranted).mockResolvedValue(true);
      jest.mocked(BrowserApi.browserAutofillSettingsOverridden).mockResolvedValue(false);

      await expect(
        service.resumeGrantedPendingDefaultPasswordManagerApply(BrowserClientVendors.Chrome),
      ).resolves.toBe(true);

      expect(applyDefaultPasswordManagerOverrideMock).toHaveBeenCalled();
    });

    it("clears pending state when override is already applied", async () => {
      getDefaultPasswordManagerSessionStateMock.mockResolvedValue("pending");
      jest.mocked(BrowserApi.permissionsGranted).mockResolvedValue(true);
      jest.mocked(BrowserApi.browserAutofillSettingsOverridden).mockResolvedValue(true);

      await expect(
        service.resumeGrantedPendingDefaultPasswordManagerApply(BrowserClientVendors.Chrome),
      ).resolves.toBe(true);

      expect(applyDefaultPasswordManagerOverrideMock).not.toHaveBeenCalled();
      expect(setDefaultPasswordManagerSessionStateMock).toHaveBeenCalledWith(null);
    });
  });

  describe("ensurePrivacyPermissionForOverride", () => {
    it("requests permission from a user gesture on Firefox without awaiting the result", async () => {
      jest.mocked(BrowserApi.permissionsGranted).mockResolvedValue(false);
      BrowserApi.isFirefox = true;

      await expect(service.ensurePrivacyPermissionForOverride()).resolves.toBe(false);

      expect(BrowserApi.requestPermission).toHaveBeenCalledWith({ permissions: ["privacy"] });
      expect(setDefaultPasswordManagerSessionStateMock).toHaveBeenCalledWith("pending");

      BrowserApi.isFirefox = false;
    });

    it("awaits permission request on non-Firefox browsers", async () => {
      jest.mocked(BrowserApi.permissionsGranted).mockResolvedValue(false);
      BrowserApi.isFirefox = false;
      jest.mocked(BrowserApi.requestPermission).mockResolvedValue(true);
      getDefaultPasswordManagerSessionStateMock.mockResolvedValue("pending");

      await expect(service.ensurePrivacyPermissionForOverride()).resolves.toBe(true);

      expect(setDefaultPasswordManagerSessionStateMock).toHaveBeenCalledWith(null);
    });
  });

  describe("completeFirefoxPopupPermissionFlow", () => {
    it("sets pending state and closes toolbar popups", async () => {
      jest.mocked(BrowserPopupUtils.inPopup).mockReturnValue(true);

      await service.completeFirefoxPopupPermissionFlow(window);

      expect(setDefaultPasswordManagerSessionStateMock).toHaveBeenCalledWith("pending");
      expect(BrowserApi.closePopup).toHaveBeenCalledWith(window);
    });

    it("does not close popouts", async () => {
      jest.mocked(BrowserPopupUtils.inPopup).mockReturnValue(false);

      await service.completeFirefoxPopupPermissionFlow(window);

      expect(setDefaultPasswordManagerSessionStateMock).toHaveBeenCalledWith("pending");
      expect(BrowserApi.closePopup).not.toHaveBeenCalled();
    });
  });
});
