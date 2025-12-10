import { mock } from "jest-mock-extended";

import {
  VaultTimeoutNumberType,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { BrowserSessionTimeoutTypeService } from "./browser-session-timeout-type.service";

describe("BrowserSessionTimeoutTypeService", () => {
  let service: BrowserSessionTimeoutTypeService;
  let mockPlatformUtilsService: jest.Mocked<PlatformUtilsService>;

  beforeEach(() => {
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    service = new BrowserSessionTimeoutTypeService(mockPlatformUtilsService);
  });

  describe("isAvailable", () => {
    it.each([
      VaultTimeoutNumberType.Immediately,
      VaultTimeoutStringType.OnRestart,
      VaultTimeoutStringType.Never,
      VaultTimeoutStringType.Custom,
    ])("should return true for always available type: %s", async (timeoutType) => {
      const result = await service.isAvailable(timeoutType);

      expect(result).toBe(true);
    });

    it.each([VaultTimeoutNumberType.OnMinute, VaultTimeoutNumberType.EightHours])(
      "should return true for numeric timeout type: %s",
      async (timeoutType) => {
        const result = await service.isAvailable(timeoutType);

        expect(result).toBe(true);
      },
    );

    describe("OnLocked availability", () => {
      const mockNavigatorPlatform = (platform: string) => {
        Object.defineProperty(navigator, "platform", {
          value: platform,
          writable: true,
          configurable: true,
        });
      };

      beforeEach(() => {
        mockNavigatorPlatform("Linux x86_64");
        mockPlatformUtilsService.isFirefox.mockReturnValue(false);
        mockPlatformUtilsService.isSafari.mockReturnValue(false);
        mockPlatformUtilsService.isOpera.mockReturnValue(false);
      });

      it("should return true when not Firefox, Safari, or Opera on Mac", async () => {
        const result = await service.isAvailable(VaultTimeoutStringType.OnLocked);

        expect(result).toBe(true);
      });

      it("should return true when Opera on non-Mac platform", async () => {
        mockNavigatorPlatform("Win32");
        mockPlatformUtilsService.isOpera.mockReturnValue(true);

        const result = await service.isAvailable(VaultTimeoutStringType.OnLocked);

        expect(result).toBe(true);
      });

      it("should return false when Opera on Mac", async () => {
        mockNavigatorPlatform("MacIntel");
        mockPlatformUtilsService.isOpera.mockReturnValue(true);

        const result = await service.isAvailable(VaultTimeoutStringType.OnLocked);

        expect(result).toBe(false);
      });

      it("should return false when Firefox", async () => {
        mockPlatformUtilsService.isFirefox.mockReturnValue(true);

        const result = await service.isAvailable(VaultTimeoutStringType.OnLocked);

        expect(result).toBe(false);
      });

      it("should return false when Safari", async () => {
        mockPlatformUtilsService.isSafari.mockReturnValue(true);

        const result = await service.isAvailable(VaultTimeoutStringType.OnLocked);

        expect(result).toBe(false);
      });
    });

    it.each([VaultTimeoutStringType.OnIdle, VaultTimeoutStringType.OnSleep])(
      "should return false for unavailable timeout type: %s",
      async (timeoutType) => {
        const result = await service.isAvailable(timeoutType);

        expect(result).toBe(false);
      },
    );
  });

  describe("getOrPromoteToAvailable", () => {
    it.each([
      VaultTimeoutNumberType.Immediately,
      VaultTimeoutNumberType.OnMinute,
      VaultTimeoutStringType.Never,
      VaultTimeoutStringType.OnRestart,
      VaultTimeoutStringType.OnLocked,
      VaultTimeoutStringType.Custom,
    ])("should return the original type when it is available: %s", async (timeoutType) => {
      jest.spyOn(service, "isAvailable").mockResolvedValue(true);

      const result = await service.getOrPromoteToAvailable(timeoutType);

      expect(result).toBe(timeoutType);
      expect(service.isAvailable).toHaveBeenCalledWith(timeoutType);
    });

    it.each([
      VaultTimeoutStringType.OnIdle,
      VaultTimeoutStringType.OnSleep,
      VaultTimeoutStringType.OnLocked,
      5,
    ])("should return OnRestart when type is not available: %s", async (timeoutType) => {
      jest.spyOn(service, "isAvailable").mockResolvedValue(false);

      const result = await service.getOrPromoteToAvailable(timeoutType);

      expect(result).toBe(VaultTimeoutStringType.OnRestart);
      expect(service.isAvailable).toHaveBeenCalledWith(timeoutType);
    });
  });
});
