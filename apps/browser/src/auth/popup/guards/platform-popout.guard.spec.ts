import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";

import { platformPopoutGuard } from "./platform-popout.guard";

describe("platformPopoutGuard", () => {
  let getPlatformInfoSpy: jest.SpyInstance;
  let inPopoutSpy: jest.SpyInstance;
  let inSidebarSpy: jest.SpyInstance;
  let openPopoutSpy: jest.SpyInstance;

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState: RouterStateSnapshot = {
    url: "/login-with-passkey?param=value",
  } as RouterStateSnapshot;

  beforeEach(() => {
    getPlatformInfoSpy = jest.spyOn(BrowserApi, "getPlatformInfo");
    inPopoutSpy = jest.spyOn(BrowserPopupUtils, "inPopout");
    inSidebarSpy = jest.spyOn(BrowserPopupUtils, "inSidebar");
    openPopoutSpy = jest.spyOn(BrowserPopupUtils, "openPopout").mockImplementation();

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("when platform matches", () => {
    beforeEach(() => {
      getPlatformInfoSpy.mockResolvedValue({ os: "linux" });
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it("should open popout and block navigation when not already in popout or sidebar", async () => {
      const guard = platformPopoutGuard(["linux"]);
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(getPlatformInfoSpy).toHaveBeenCalled();
      expect(inPopoutSpy).toHaveBeenCalledWith(window);
      expect(inSidebarSpy).toHaveBeenCalledWith(window);
      expect(openPopoutSpy).toHaveBeenCalledWith(
        "popup/index.html#/login-with-passkey?param=value",
      );
      expect(result).toBe(false);
    });

    it("should allow navigation when already in popout", async () => {
      inPopoutSpy.mockReturnValue(true);

      const guard = platformPopoutGuard(["linux"]);
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should allow navigation when already in sidebar", async () => {
      inSidebarSpy.mockReturnValue(true);

      const guard = platformPopoutGuard(["linux"]);
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("when platform does not match", () => {
    beforeEach(() => {
      getPlatformInfoSpy.mockResolvedValue({ os: "win" });
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it("should allow navigation without opening popout", async () => {
      const guard = platformPopoutGuard(["linux"]);
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(getPlatformInfoSpy).toHaveBeenCalled();
      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("when forcePopout is true", () => {
    beforeEach(() => {
      getPlatformInfoSpy.mockResolvedValue({ os: "win" });
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it("should open popout regardless of platform", async () => {
      const guard = platformPopoutGuard(["linux"], true);
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).toHaveBeenCalledWith(
        "popup/index.html#/login-with-passkey?param=value",
      );
      expect(result).toBe(false);
    });

    it("should not open popout when already in popout", async () => {
      inPopoutSpy.mockReturnValue(true);

      const guard = platformPopoutGuard(["linux"], true);
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("with multiple platforms", () => {
    beforeEach(() => {
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it.each(["linux", "mac", "win"])(
      "should open popout when platform is %s and included in platforms array",
      async (platform) => {
        getPlatformInfoSpy.mockResolvedValue({ os: platform });

        const guard = platformPopoutGuard(["linux", "mac", "win"]);
        const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

        expect(openPopoutSpy).toHaveBeenCalledWith(
          "popup/index.html#/login-with-passkey?param=value",
        );
        expect(result).toBe(false);
      },
    );

    it("should not open popout when platform is not in the array", async () => {
      getPlatformInfoSpy.mockResolvedValue({ os: "android" });

      const guard = platformPopoutGuard(["linux", "mac"]);
      const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

      expect(openPopoutSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("url handling", () => {
    beforeEach(() => {
      getPlatformInfoSpy.mockResolvedValue({ os: "linux" });
      inPopoutSpy.mockReturnValue(false);
      inSidebarSpy.mockReturnValue(false);
    });

    it("should preserve query parameters in the popout url", async () => {
      const stateWithQuery: RouterStateSnapshot = {
        url: "/path?foo=bar&baz=qux",
      } as RouterStateSnapshot;

      const guard = platformPopoutGuard(["linux"]);
      await TestBed.runInInjectionContext(() => guard(mockRoute, stateWithQuery));

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/path?foo=bar&baz=qux");
    });

    it("should handle urls without query parameters", async () => {
      const stateWithoutQuery: RouterStateSnapshot = {
        url: "/simple-path",
      } as RouterStateSnapshot;

      const guard = platformPopoutGuard(["linux"]);
      await TestBed.runInInjectionContext(() => guard(mockRoute, stateWithoutQuery));

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/simple-path");
    });
  });
});
