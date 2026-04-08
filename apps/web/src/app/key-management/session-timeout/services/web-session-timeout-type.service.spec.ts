import { mock } from "jest-mock-extended";

import {
  VaultTimeoutNumberType,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { WebSessionTimeoutTypeService } from "./web-session-timeout-type.service";

describe("WebSessionTimeoutTypeService", () => {
  let service: WebSessionTimeoutTypeService;
  let mockPlatformUtilsService: jest.Mocked<PlatformUtilsService>;

  beforeEach(() => {
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    service = new WebSessionTimeoutTypeService(mockPlatformUtilsService);
  });

  describe("isAvailable", () => {
    it("should return false for Immediately", async () => {
      const result = await service.isAvailable(VaultTimeoutNumberType.Immediately);

      expect(result).toBe(false);
    });

    it.each([VaultTimeoutStringType.OnRestart, VaultTimeoutStringType.Custom])(
      "should return true for always available type: %s",
      async (timeoutType) => {
        const result = await service.isAvailable(timeoutType);

        expect(result).toBe(true);
      },
    );

    it.each([VaultTimeoutNumberType.OnMinute, VaultTimeoutNumberType.EightHours])(
      "should return true for numeric timeout type: %s",
      async (timeoutType) => {
        const result = await service.isAvailable(timeoutType);

        expect(result).toBe(true);
      },
    );

    it.each([
      VaultTimeoutStringType.OnIdle,
      VaultTimeoutStringType.OnSleep,
      VaultTimeoutStringType.OnLocked,
    ])("should return false for unavailable timeout type: %s", async (timeoutType) => {
      const result = await service.isAvailable(timeoutType);

      expect(result).toBe(false);
    });

    describe("Never availability", () => {
      it("should return true when in dev mode", async () => {
        mockPlatformUtilsService.isDev.mockReturnValue(true);

        const result = await service.isAvailable(VaultTimeoutStringType.Never);

        expect(result).toBe(true);
        expect(mockPlatformUtilsService.isDev).toHaveBeenCalled();
      });

      it("should return false when not in dev mode", async () => {
        mockPlatformUtilsService.isDev.mockReturnValue(false);

        const result = await service.isAvailable(VaultTimeoutStringType.Never);

        expect(result).toBe(false);
        expect(mockPlatformUtilsService.isDev).toHaveBeenCalled();
      });
    });
  });

  describe("getOrPromoteToAvailable", () => {
    it.each([
      VaultTimeoutNumberType.OnMinute,
      VaultTimeoutNumberType.EightHours,
      VaultTimeoutStringType.OnRestart,
      VaultTimeoutStringType.Never,
      VaultTimeoutStringType.Custom,
    ])("should return the original type when it is available: %s", async (timeoutType) => {
      jest.spyOn(service, "isAvailable").mockResolvedValue(true);

      const result = await service.getOrPromoteToAvailable(timeoutType);

      expect(result).toBe(timeoutType);
      expect(service.isAvailable).toHaveBeenCalledWith(timeoutType);
    });

    it("should return OnMinute when Immediately is not available", async () => {
      jest.spyOn(service, "isAvailable").mockResolvedValue(false);

      const result = await service.getOrPromoteToAvailable(VaultTimeoutNumberType.Immediately);

      expect(result).toBe(VaultTimeoutNumberType.OnMinute);
      expect(service.isAvailable).toHaveBeenCalledWith(VaultTimeoutNumberType.Immediately);
    });

    it.each([
      VaultTimeoutStringType.OnIdle,
      VaultTimeoutStringType.OnSleep,
      VaultTimeoutStringType.OnLocked,
      VaultTimeoutStringType.Never,
    ])("should return OnRestart when type is not available: %s", async (timeoutType) => {
      jest.spyOn(service, "isAvailable").mockResolvedValue(false);

      const result = await service.getOrPromoteToAvailable(timeoutType);

      expect(result).toBe(VaultTimeoutStringType.OnRestart);
      expect(service.isAvailable).toHaveBeenCalledWith(timeoutType);
    });
  });
});
