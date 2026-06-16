import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";

import { DeviceType } from "@bitwarden/common/enums";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { BrowserPlatformUtilsService } from "../../../platform/services/platform-utils/browser-platform-utils.service";

import { filePickerPopoutGuard } from "./file-picker-popout.guard";

describe("filePickerPopoutGuard", () => {
  let getDeviceSpy: jest.SpyInstance;
  let inPopoutSpy: jest.SpyInstance;
  let inSidebarSpy: jest.SpyInstance;
  let openPopoutSpy: jest.SpyInstance;
  let closePopupSpy: jest.SpyInstance;

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState: RouterStateSnapshot = {
    url: "/add-send?type=1",
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

  describe("Firefox browser", () => {
    beforeEach(() => {
      getDeviceSpy.mockReturnValue(DeviceType.FirefoxExtension);
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it("should open popout and block navigation when not in popout or sidebar", async () => {
      const guard = filePickerPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(getDeviceSpy).toHaveBeenCalledWith(window);
      expect(inPopoutSpy).toHaveBeenCalledWith(window);
      expect(inSidebarSpy).toHaveBeenCalledWith(window);
      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/add-send?type=1");
      expect(closePopupSpy).toHaveBeenCalledWith(window);
      expect(result).toBe(false);
    });

    it("should allow navigation when already in popout", async () => {
      inPopoutSpy.mockReturnValue(true);

      const guard = filePickerPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(closePopupSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should allow navigation when already in sidebar", async () => {
      inSidebarSpy.mockReturnValue(true);

      const guard = filePickerPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(closePopupSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("Safari browser", () => {
    beforeEach(() => {
      getDeviceSpy.mockReturnValue(DeviceType.SafariExtension);
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it("should open popout and block navigation when not in popout", async () => {
      const guard = filePickerPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(getDeviceSpy).toHaveBeenCalledWith(window);
      expect(inPopoutSpy).toHaveBeenCalledWith(window);
      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/add-send?type=1");
      expect(closePopupSpy).toHaveBeenCalledWith(window);
      expect(result).toBe(false);
    });

    it("should allow navigation when already in popout", async () => {
      inPopoutSpy.mockReturnValue(true);

      const guard = filePickerPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(closePopupSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should not allow sidebar bypass (Safari doesn't support sidebar)", async () => {
      inSidebarSpy.mockReturnValue(true);
      inPopoutSpy.mockReturnValue(false);

      const guard = filePickerPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      // Safari requires popout, sidebar is not sufficient
      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/add-send?type=1");
      expect(closePopupSpy).toHaveBeenCalledWith(window);
      expect(result).toBe(false);
    });
  });

  describe("Chromium browsers on Linux", () => {
    beforeEach(() => {
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
      Object.defineProperty(window, "navigator", {
        value: {
          userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
          appVersion: "5.0 (X11; Linux x86_64)",
        },
        configurable: true,
        writable: true,
      });
    });

    it.each([
      { deviceType: DeviceType.ChromeExtension, name: "Chrome" },
      { deviceType: DeviceType.EdgeExtension, name: "Edge" },
      { deviceType: DeviceType.OperaExtension, name: "Opera" },
      { deviceType: DeviceType.VivaldiExtension, name: "Vivaldi" },
    ])(
      "should open popout and block navigation for $name on Linux when not in popout or sidebar",
      async ({ deviceType }) => {
        getDeviceSpy.mockReturnValue(deviceType);

        const guard = filePickerPopoutGuard();
        const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

        expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/add-send?type=1");
        expect(closePopupSpy).toHaveBeenCalledWith(window);
        expect(result).toBe(false);
      },
    );

    it("should allow navigation when in popout", async () => {
      getDeviceSpy.mockReturnValue(DeviceType.ChromeExtension);
      inPopoutSpy.mockReturnValue(true);

      const guard = filePickerPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(closePopupSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should allow navigation when in sidebar", async () => {
      getDeviceSpy.mockReturnValue(DeviceType.ChromeExtension);
      inSidebarSpy.mockReturnValue(true);

      const guard = filePickerPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(closePopupSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("Chromium browsers on Mac", () => {
    beforeEach(() => {
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
      Object.defineProperty(window, "navigator", {
        value: {
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          appVersion: "5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        },
        configurable: true,
        writable: true,
      });
    });

    it.each([
      { deviceType: DeviceType.ChromeExtension, name: "Chrome" },
      { deviceType: DeviceType.EdgeExtension, name: "Edge" },
      { deviceType: DeviceType.OperaExtension, name: "Opera" },
      { deviceType: DeviceType.VivaldiExtension, name: "Vivaldi" },
    ])(
      "should open popout and block navigation for $name on Mac when not in popout or sidebar",
      async ({ deviceType }) => {
        getDeviceSpy.mockReturnValue(deviceType);

        const guard = filePickerPopoutGuard();
        const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

        expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/add-send?type=1");
        expect(closePopupSpy).toHaveBeenCalledWith(window);
        expect(result).toBe(false);
      },
    );

    it("should allow navigation when in popout", async () => {
      getDeviceSpy.mockReturnValue(DeviceType.ChromeExtension);
      inPopoutSpy.mockReturnValue(true);

      const guard = filePickerPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(closePopupSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should allow navigation when in sidebar", async () => {
      getDeviceSpy.mockReturnValue(DeviceType.ChromeExtension);
      inSidebarSpy.mockReturnValue(true);

      const guard = filePickerPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(closePopupSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("Chromium browsers on Windows", () => {
    beforeEach(() => {
      getDeviceSpy.mockReturnValue(DeviceType.ChromeExtension);
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
      Object.defineProperty(window, "navigator", {
        value: {
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          appVersion: "5.0 (Windows NT 10.0; Win64; x64)",
        },
        configurable: true,
        writable: true,
      });
    });

    it("should allow navigation without popout on Windows", async () => {
      const guard = filePickerPopoutGuard();
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(getDeviceSpy).toHaveBeenCalledWith(window);
      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(closePopupSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("File picker routes", () => {
    beforeEach(() => {
      getDeviceSpy.mockReturnValue(DeviceType.FirefoxExtension);
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it.each([{ route: "/import" }, { route: "/add-send" }, { route: "/attachments" }])(
      "should open popout for $route route",
      async ({ route }) => {
        const importState: RouterStateSnapshot = {
          url: route,
        } as RouterStateSnapshot;

        const guard = filePickerPopoutGuard();
        const result = await TestBed.runInInjectionContext(() => guard(mockRoute, importState));

        expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#" + route);
        expect(closePopupSpy).toHaveBeenCalledWith(window);
        expect(result).toBe(false);
      },
    );
  });

  describe("Url handling", () => {
    beforeEach(() => {
      getDeviceSpy.mockReturnValue(DeviceType.FirefoxExtension);
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it("should preserve query parameters in the popout url", async () => {
      const stateWithQuery: RouterStateSnapshot = {
        url: "/import?foo=bar&baz=qux",
      } as RouterStateSnapshot;

      const guard = filePickerPopoutGuard();
      await TestBed.runInInjectionContext(() => guard(mockRoute, stateWithQuery));

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/import?foo=bar&baz=qux");
      expect(closePopupSpy).toHaveBeenCalledWith(window);
    });

    it("should handle urls without query parameters", async () => {
      const stateWithoutQuery: RouterStateSnapshot = {
        url: "/simple-path",
      } as RouterStateSnapshot;

      const guard = filePickerPopoutGuard();
      await TestBed.runInInjectionContext(() => guard(mockRoute, stateWithoutQuery));

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/simple-path");
      expect(closePopupSpy).toHaveBeenCalledWith(window);
    });

    it("should not add autoClosePopout parameter to the url", async () => {
      const guard = filePickerPopoutGuard();
      await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/add-send?type=1");
      expect(openPopoutSpy).not.toHaveBeenCalledWith(expect.stringContaining("autoClosePopout"));
    });
  });

  describe("Send type differentiation", () => {
    describe("Text Sends (type=0)", () => {
      it.each([
        { deviceType: DeviceType.FirefoxExtension, name: "Firefox" },
        { deviceType: DeviceType.SafariExtension, name: "Safari" },
        { deviceType: DeviceType.ChromeExtension, name: "Chrome" },
        { deviceType: DeviceType.EdgeExtension, name: "Edge" },
      ])(
        "should allow navigation without popout for new text Sends on $name",
        async ({ deviceType }) => {
          getDeviceSpy.mockReturnValue(deviceType);
          inPopoutSpy.mockReturnValue(false);
          inSidebarSpy.mockReturnValue(false);

          const textSendState: RouterStateSnapshot = {
            url: "/add-send?type=0&isNew=true",
          } as RouterStateSnapshot;

          const guard = filePickerPopoutGuard();
          const result = await TestBed.runInInjectionContext(() => guard(mockRoute, textSendState));

          expect(openPopoutSpy).not.toHaveBeenCalled();
          expect(closePopupSpy).not.toHaveBeenCalled();
          expect(result).toBe(true);
        },
      );
    });

    describe("File Sends (type=1)", () => {
      it.each([
        {
          deviceType: DeviceType.FirefoxExtension,
          name: "Firefox",
          os: "Mac",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          expectPopout: true,
        },
        {
          deviceType: DeviceType.FirefoxExtension,
          name: "Firefox",
          os: "Linux",
          userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
          expectPopout: true,
        },
        {
          deviceType: DeviceType.FirefoxExtension,
          name: "Firefox",
          os: "Windows",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          expectPopout: true,
        },
        {
          deviceType: DeviceType.SafariExtension,
          name: "Safari",
          os: "Mac",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          expectPopout: true,
        },
        {
          deviceType: DeviceType.ChromeExtension,
          name: "Chrome",
          os: "Mac",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          expectPopout: true,
        },
        {
          deviceType: DeviceType.ChromeExtension,
          name: "Chrome",
          os: "Linux",
          userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
          expectPopout: true,
        },
        {
          deviceType: DeviceType.ChromeExtension,
          name: "Chrome",
          os: "Windows",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          expectPopout: false,
        },
        {
          deviceType: DeviceType.EdgeExtension,
          name: "Edge",
          os: "Mac",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          expectPopout: true,
        },
        {
          deviceType: DeviceType.EdgeExtension,
          name: "Edge",
          os: "Linux",
          userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
          expectPopout: true,
        },
        {
          deviceType: DeviceType.EdgeExtension,
          name: "Edge",
          os: "Windows",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          expectPopout: false,
        },
      ])(
        "should require popout for a new file Send on $name $os",
        async ({ deviceType, userAgent, expectPopout }) => {
          getDeviceSpy.mockReturnValue(deviceType);
          inPopoutSpy.mockReturnValue(false);
          inSidebarSpy.mockReturnValue(false);

          if (userAgent) {
            Object.defineProperty(window, "navigator", {
              value: { userAgent, appVersion: userAgent },
              configurable: true,
              writable: true,
            });
          }

          const fileSendState: RouterStateSnapshot = {
            url: "/add-send?type=1&isNew=true",
          } as RouterStateSnapshot;

          const guard = filePickerPopoutGuard();
          const result = await TestBed.runInInjectionContext(() => guard(mockRoute, fileSendState));

          if (expectPopout === false) {
            expect(openPopoutSpy).not.toHaveBeenCalled();
            expect(closePopupSpy).not.toHaveBeenCalled();
            expect(result).toBe(true);
          } else {
            expect(openPopoutSpy).toHaveBeenCalledWith(
              "popup/index.html#/add-send?type=1&isNew=true",
            );
            expect(closePopupSpy).toHaveBeenCalledWith(window);
            expect(result).toBe(false);
          }
        },
      );
    });

    describe("Send routes without type parameter", () => {
      it.each([
        {
          deviceType: DeviceType.FirefoxExtension,
          name: "Firefox",
          os: "Mac",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        },
        {
          deviceType: DeviceType.FirefoxExtension,
          name: "Firefox",
          os: "Linux",
          userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
        },
        {
          deviceType: DeviceType.FirefoxExtension,
          name: "Firefox",
          os: "Windows",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        {
          deviceType: DeviceType.SafariExtension,
          name: "Safari",
          os: "Mac",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        },
        {
          deviceType: DeviceType.ChromeExtension,
          name: "Chrome",
          os: "Mac",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        },
        {
          deviceType: DeviceType.ChromeExtension,
          name: "Chrome",
          os: "Linux",
          userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
        },
        {
          deviceType: DeviceType.ChromeExtension,
          name: "Chrome",
          os: "Windows",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        {
          deviceType: DeviceType.EdgeExtension,
          name: "Edge",
          os: "Mac",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        },
        {
          deviceType: DeviceType.EdgeExtension,
          name: "Edge",
          os: "Linux",
          userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
        },
        {
          deviceType: DeviceType.EdgeExtension,
          name: "Edge",
          os: "Windows",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
      ])(
        "should default to requiring popout on $name $os",
        async ({ deviceType, userAgent, os }) => {
          getDeviceSpy.mockReturnValue(deviceType);
          inPopoutSpy.mockReturnValue(false);
          inSidebarSpy.mockReturnValue(false);

          if (userAgent) {
            Object.defineProperty(window, "navigator", {
              value: { userAgent, appVersion: userAgent },
              configurable: true,
              writable: true,
            });
          }

          const noTypeState: RouterStateSnapshot = {
            url: "/add-send",
          } as RouterStateSnapshot;

          const guard = filePickerPopoutGuard();
          const result = await TestBed.runInInjectionContext(() => guard(mockRoute, noTypeState));

          // Windows Chrome/Edge don't need popout
          const isChromiumOnWindows =
            (deviceType === DeviceType.ChromeExtension ||
              deviceType === DeviceType.EdgeExtension) &&
            os === "Windows";

          if (isChromiumOnWindows) {
            expect(openPopoutSpy).not.toHaveBeenCalled();
            expect(closePopupSpy).not.toHaveBeenCalled();
            expect(result).toBe(true);
          } else {
            expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/add-send");
            expect(closePopupSpy).toHaveBeenCalledWith(window);
            expect(result).toBe(false);
          }
        },
      );

      it.each([
        {
          deviceType: DeviceType.FirefoxExtension,
          name: "Firefox",
          os: "Mac",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        },
        {
          deviceType: DeviceType.FirefoxExtension,
          name: "Firefox",
          os: "Linux",
          userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
        },
        {
          deviceType: DeviceType.FirefoxExtension,
          name: "Firefox",
          os: "Windows",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        {
          deviceType: DeviceType.SafariExtension,
          name: "Safari",
          os: "Mac",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        },
        {
          deviceType: DeviceType.ChromeExtension,
          name: "Chrome",
          os: "Mac",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        },
        {
          deviceType: DeviceType.ChromeExtension,
          name: "Chrome",
          os: "Linux",
          userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
        },
        {
          deviceType: DeviceType.ChromeExtension,
          name: "Chrome",
          os: "Windows",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        {
          deviceType: DeviceType.EdgeExtension,
          name: "Edge",
          os: "Mac",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        },
        {
          deviceType: DeviceType.EdgeExtension,
          name: "Edge",
          os: "Linux",
          userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
        },
        {
          deviceType: DeviceType.EdgeExtension,
          name: "Edge",
          os: "Windows",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
      ])(
        "should default to requiring popout when type is invalid on $name $os",
        async ({ deviceType, userAgent, os }) => {
          getDeviceSpy.mockReturnValue(deviceType);
          inPopoutSpy.mockReturnValue(false);
          inSidebarSpy.mockReturnValue(false);

          if (userAgent) {
            Object.defineProperty(window, "navigator", {
              value: { userAgent, appVersion: userAgent },
              configurable: true,
              writable: true,
            });
          }

          const invalidTypeState: RouterStateSnapshot = {
            url: "/add-send?type=invalid",
          } as RouterStateSnapshot;

          const guard = filePickerPopoutGuard();
          const result = await TestBed.runInInjectionContext(() =>
            guard(mockRoute, invalidTypeState),
          );

          // Windows Chrome/Edge don't need popout
          const isChromiumOnWindows =
            (deviceType === DeviceType.ChromeExtension ||
              deviceType === DeviceType.EdgeExtension) &&
            os === "Windows";

          if (isChromiumOnWindows) {
            expect(openPopoutSpy).not.toHaveBeenCalled();
            expect(closePopupSpy).not.toHaveBeenCalled();
            expect(result).toBe(true);
          } else {
            expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/add-send?type=invalid");
            expect(closePopupSpy).toHaveBeenCalledWith(window);
            expect(result).toBe(false);
          }
        },
      );
    });

    describe("non-Send routes", () => {
      it.each([
        { deviceType: DeviceType.FirefoxExtension, name: "Firefox", route: "/import" },
        { deviceType: DeviceType.FirefoxExtension, name: "Firefox", route: "/attachments" },
        { deviceType: DeviceType.SafariExtension, name: "Safari", route: "/import" },
        { deviceType: DeviceType.SafariExtension, name: "Safari", route: "/attachments" },
      ])(
        "should always require popout for $route on $name regardless of query params",
        async ({ deviceType, route }) => {
          getDeviceSpy.mockReturnValue(deviceType);
          inPopoutSpy.mockReturnValue(false);
          inSidebarSpy.mockReturnValue(false);

          const routeState: RouterStateSnapshot = {
            url: `${route}?type=0`,
          } as RouterStateSnapshot;

          const guard = filePickerPopoutGuard();
          const result = await TestBed.runInInjectionContext(() => guard(mockRoute, routeState));

          expect(openPopoutSpy).toHaveBeenCalledWith(`popup/index.html#${route}?type=0`);
          expect(closePopupSpy).toHaveBeenCalledWith(window);
          expect(result).toBe(false);
        },
      );
    });
  });
});
