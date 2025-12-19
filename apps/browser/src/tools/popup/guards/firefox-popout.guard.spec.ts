import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";

import { DeviceType } from "@bitwarden/common/enums";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { BrowserPlatformUtilsService } from "../../../platform/services/platform-utils/browser-platform-utils.service";

import { firefoxPopoutGuard } from "./firefox-popout.guard";

describe("firefoxPopoutGuard", () => {
  let getDeviceSpy: jest.SpyInstance;
  let inPopoutSpy: jest.SpyInstance;
  let inSidebarSpy: jest.SpyInstance;
  let openPopoutSpy: jest.SpyInstance;
  let closePopupSpy: jest.SpyInstance;

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState: RouterStateSnapshot = {
    url: "/import?param=value",
  } as RouterStateSnapshot;

  beforeEach(() => {
    getDeviceSpy = jest.spyOn(BrowserPlatformUtilsService, "getDevice");
    inPopoutSpy = jest.spyOn(BrowserPopupUtils, "inPopout");
    inSidebarSpy = jest.spyOn(BrowserPopupUtils, "inSidebar");
    openPopoutSpy = jest.spyOn(BrowserPopupUtils, "openPopout").mockImplementation();
    closePopupSpy = jest.spyOn(BrowserApi, "closePopup").mockImplementation();

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("when browser is Firefox", () => {
    beforeEach(() => {
      getDeviceSpy.mockReturnValue(DeviceType.FirefoxExtension);
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it("should open popout and block navigation when not already in popout or sidebar", async () => {
      const guard = firefoxPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(getDeviceSpy).toHaveBeenCalledWith(window);
      expect(inPopoutSpy).toHaveBeenCalledWith(window);
      expect(inSidebarSpy).toHaveBeenCalledWith(window);
      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/import?param=value");
      expect(closePopupSpy).toHaveBeenCalledWith(window);
      expect(result).toBe(false);
    });

    it("should not add autoClosePopout parameter to the url", async () => {
      const guard = firefoxPopoutGuard();
      await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/import?param=value");
      expect(openPopoutSpy).not.toHaveBeenCalledWith(expect.stringContaining("autoClosePopout"));
    });

    it("should allow navigation when already in popout", async () => {
      inPopoutSpy.mockReturnValue(true);

      const guard = firefoxPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(closePopupSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should allow navigation when already in sidebar", async () => {
      inSidebarSpy.mockReturnValue(true);

      const guard = firefoxPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(closePopupSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("when browser is not Firefox", () => {
    beforeEach(() => {
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it.each([
      { deviceType: DeviceType.ChromeExtension, name: "ChromeExtension" },
      { deviceType: DeviceType.EdgeExtension, name: "EdgeExtension" },
      { deviceType: DeviceType.OperaExtension, name: "OperaExtension" },
      { deviceType: DeviceType.SafariExtension, name: "SafariExtension" },
      { deviceType: DeviceType.VivaldiExtension, name: "VivaldiExtension" },
    ])(
      "should allow navigation without opening popout when device is $name",
      async ({ deviceType }) => {
        getDeviceSpy.mockReturnValue(deviceType);

        const guard = firefoxPopoutGuard();
        const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

        expect(getDeviceSpy).toHaveBeenCalledWith(window);
        expect(openPopoutSpy).not.toHaveBeenCalled();
        expect(closePopupSpy).not.toHaveBeenCalled();
        expect(result).toBe(true);
      },
    );
  });

  describe("file picker routes", () => {
    beforeEach(() => {
      getDeviceSpy.mockReturnValue(DeviceType.FirefoxExtension);
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it("should open popout for /import route", async () => {
      const importState: RouterStateSnapshot = {
        url: "/import",
      } as RouterStateSnapshot;

      const guard = firefoxPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, importState));

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/import");
      expect(closePopupSpy).toHaveBeenCalledWith(window);
      expect(result).toBe(false);
    });

    it("should open popout for /add-send route", async () => {
      const addSendState: RouterStateSnapshot = {
        url: "/add-send",
      } as RouterStateSnapshot;

      const guard = firefoxPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, addSendState));

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/add-send");
      expect(closePopupSpy).toHaveBeenCalledWith(window);
      expect(result).toBe(false);
    });

    it("should open popout for /edit-send route", async () => {
      const editSendState: RouterStateSnapshot = {
        url: "/edit-send",
      } as RouterStateSnapshot;

      const guard = firefoxPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, editSendState));

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/edit-send");
      expect(closePopupSpy).toHaveBeenCalledWith(window);
      expect(result).toBe(false);
    });
  });

  describe("url handling", () => {
    beforeEach(() => {
      getDeviceSpy.mockReturnValue(DeviceType.FirefoxExtension);
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it("should preserve query parameters in the popout url", async () => {
      const stateWithQuery: RouterStateSnapshot = {
        url: "/import?foo=bar&baz=qux",
      } as RouterStateSnapshot;

      const guard = firefoxPopoutGuard();
      await TestBed.runInInjectionContext(() => guard(mockRoute, stateWithQuery));

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/import?foo=bar&baz=qux");
      expect(closePopupSpy).toHaveBeenCalledWith(window);
    });

    it("should handle urls without query parameters", async () => {
      const stateWithoutQuery: RouterStateSnapshot = {
        url: "/simple-path",
      } as RouterStateSnapshot;

      const guard = firefoxPopoutGuard();
      await TestBed.runInInjectionContext(() => guard(mockRoute, stateWithoutQuery));

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/simple-path");
      expect(closePopupSpy).toHaveBeenCalledWith(window);
    });
  });
});
