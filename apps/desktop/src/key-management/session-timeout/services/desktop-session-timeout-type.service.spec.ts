import {
  VaultTimeoutNumberType,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";

import { DesktopSessionTimeoutTypeService } from "./desktop-session-timeout-type.service";

describe("DesktopSessionTimeoutTypeService", () => {
  let service: DesktopSessionTimeoutTypeService;
  let mockIsLockMonitorAvailable: jest.Mock;

  beforeEach(() => {
    mockIsLockMonitorAvailable = jest.fn();

    (global as any).ipc = {
      platform: {
        powermonitor: {
          isLockMonitorAvailable: mockIsLockMonitorAvailable,
        },
      },
    };

    service = new DesktopSessionTimeoutTypeService();
  });

  describe("isAvailable", () => {
    it("should return false for Immediately", async () => {
      const result = await service.isAvailable(VaultTimeoutNumberType.Immediately);

      expect(result).toBe(false);
    });

    it.each([
      VaultTimeoutStringType.OnIdle,
      VaultTimeoutStringType.OnSleep,
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
      it("should return true when lock monitor is available", async () => {
        mockIsLockMonitorAvailable.mockResolvedValue(true);

        const result = await service.isAvailable(VaultTimeoutStringType.OnLocked);

        expect(result).toBe(true);
        expect(mockIsLockMonitorAvailable).toHaveBeenCalled();
      });

      it("should return false when lock monitor is not available", async () => {
        mockIsLockMonitorAvailable.mockResolvedValue(false);

        const result = await service.isAvailable(VaultTimeoutStringType.OnLocked);

        expect(result).toBe(false);
        expect(mockIsLockMonitorAvailable).toHaveBeenCalled();
      });
    });
  });

  describe("getOrPromoteToAvailable", () => {
    it.each([
      VaultTimeoutNumberType.OnMinute,
      VaultTimeoutStringType.OnIdle,
      VaultTimeoutStringType.OnSleep,
      VaultTimeoutStringType.OnRestart,
      VaultTimeoutStringType.OnLocked,
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

    it("should return OnSleep when OnLocked is not available", async () => {
      jest.spyOn(service, "isAvailable").mockResolvedValue(false);

      const result = await service.getOrPromoteToAvailable(VaultTimeoutStringType.OnLocked);

      expect(result).toBe(VaultTimeoutStringType.OnSleep);
      expect(service.isAvailable).toHaveBeenCalledWith(VaultTimeoutStringType.OnLocked);
    });

    it.each([
      VaultTimeoutStringType.OnIdle,
      VaultTimeoutStringType.OnSleep,
      VaultTimeoutNumberType.OnMinute,
      5,
    ])("should return OnRestart when type is not available: %s", async (timeoutType) => {
      jest.spyOn(service, "isAvailable").mockResolvedValue(false);

      const result = await service.getOrPromoteToAvailable(timeoutType);

      expect(result).toBe(VaultTimeoutStringType.OnRestart);
      expect(service.isAvailable).toHaveBeenCalledWith(timeoutType);
    });
  });
});
