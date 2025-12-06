import { firstValueFrom } from "rxjs";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { UserId } from "../../types/guid";

import { PhishingDetectionSettingsService } from "./phishing-detection-settings.service";

describe("PhishingDetectionSettingsService", () => {
  let service: PhishingDetectionSettingsService;
  let stateProvider: FakeStateProvider;
  const mockUserId = "mock-user-id" as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);

  beforeEach(() => {
    stateProvider = new FakeStateProvider(accountService);
    service = new PhishingDetectionSettingsService(stateProvider);
  });

  describe("enablePhishingDetection$", () => {
    it("should default to true", async () => {
      const result = await firstValueFrom(service.enablePhishingDetection$);
      expect(result).toBe(true);
    });

    it("should return the stored value", async () => {
      await service.setEnablePhishingDetection(mockUserId, false);
      const result = await firstValueFrom(service.enablePhishingDetection$);
      expect(result).toBe(false);
    });
  });

  describe("setEnablePhishingDetection", () => {
    it("should update the stored value", async () => {
      await service.setEnablePhishingDetection(mockUserId, false);
      let result = await firstValueFrom(service.enablePhishingDetection$);
      expect(result).toBe(false);

      await service.setEnablePhishingDetection(mockUserId, true);
      result = await firstValueFrom(service.enablePhishingDetection$);
      expect(result).toBe(true);
    });
  });
});
