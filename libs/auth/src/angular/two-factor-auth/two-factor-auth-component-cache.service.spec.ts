import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import {
  TwoFactorAuthComponentCache,
  TwoFactorAuthComponentCacheService,
  TwoFactorAuthComponentData,
} from "./two-factor-auth-component-cache.service";

describe("TwoFactorAuthCache", () => {
  describe("fromJSON", () => {
    it("returns null when input is null", () => {
      const result = TwoFactorAuthComponentCache.fromJSON(null as any);
      expect(result).toBeNull();
    });

    it("creates a TwoFactorAuthCache instance from valid JSON", () => {
      const jsonData = {
        token: "123456",
        remember: true,
        selectedProviderType: TwoFactorProviderType.Email,
      };
      const result = TwoFactorAuthComponentCache.fromJSON(jsonData as any);

      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(TwoFactorAuthComponentCache);
      expect(result?.token).toBe("123456");
      expect(result?.remember).toBe(true);
      expect(result?.selectedProviderType).toBe(TwoFactorProviderType.Email);
    });
  });
});

describe("TwoFactorAuthComponentCacheService", () => {
  let service: TwoFactorAuthComponentCacheService;
  let mockViewCacheService: MockProxy<ViewCacheService>;
  let mockConfigService: MockProxy<ConfigService>;
  let cacheData: BehaviorSubject<TwoFactorAuthComponentCache | null>;
  let mockSignal: any;

  beforeEach(() => {
    mockViewCacheService = mock<ViewCacheService>();
    mockConfigService = mock<ConfigService>();
    cacheData = new BehaviorSubject<TwoFactorAuthComponentCache | null>(null);
    mockSignal = jest.fn(() => cacheData.getValue());
    mockSignal.set = jest.fn((value: TwoFactorAuthComponentCache | null) => cacheData.next(value));
    mockViewCacheService.signal.mockReturnValue(mockSignal);

    TestBed.configureTestingModule({
      providers: [
        TwoFactorAuthComponentCacheService,
        { provide: ViewCacheService, useValue: mockViewCacheService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    });

    service = TestBed.inject(TwoFactorAuthComponentCacheService);
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  describe("init", () => {
    it("sets featureEnabled to true when flag is enabled", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);

      await service.init();

      expect(mockConfigService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM9115_TwoFactorExtensionDataPersistence,
      );

      service.cacheData({ token: "123456" });
      expect(mockSignal.set).toHaveBeenCalled();
    });

    it("sets featureEnabled to false when flag is disabled", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(false);

      await service.init();

      expect(mockConfigService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM9115_TwoFactorExtensionDataPersistence,
      );

      service.cacheData({ token: "123456" });
      expect(mockSignal.set).not.toHaveBeenCalled();
    });
  });

  describe("cacheData", () => {
    beforeEach(async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      await service.init();
    });

    it("caches complete data when feature is enabled", () => {
      const testData: TwoFactorAuthComponentData = {
        token: "123456",
        remember: true,
        selectedProviderType: TwoFactorProviderType.Email,
      };

      service.cacheData(testData);

      expect(mockSignal.set).toHaveBeenCalledWith({
        token: "123456",
        remember: true,
        selectedProviderType: TwoFactorProviderType.Email,
      });
    });

    it("caches partial data when feature is enabled", () => {
      service.cacheData({ token: "123456" });

      expect(mockSignal.set).toHaveBeenCalledWith({
        token: "123456",
        remember: undefined,
        selectedProviderType: undefined,
      });
    });

    it("does not cache data when feature is disabled", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(false);
      await service.init();

      service.cacheData({ token: "123456" });

      expect(mockSignal.set).not.toHaveBeenCalled();
    });
  });

  describe("clearCachedData", () => {
    beforeEach(async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      await service.init();
    });

    it("clears cached data when feature is enabled", () => {
      service.clearCachedData();

      expect(mockSignal.set).toHaveBeenCalledWith(null);
    });

    it("does not clear cached data when feature is disabled", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(false);
      await service.init();

      service.clearCachedData();

      expect(mockSignal.set).not.toHaveBeenCalled();
    });
  });

  describe("getCachedData", () => {
    beforeEach(async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      await service.init();
    });

    it("returns cached data when feature is enabled", () => {
      const testData = new TwoFactorAuthComponentCache();
      testData.token = "123456";
      testData.remember = true;
      testData.selectedProviderType = TwoFactorProviderType.Email;
      cacheData.next(testData);

      const result = service.getCachedData();

      expect(result).toEqual(testData);
      expect(mockSignal).toHaveBeenCalled();
    });

    it("returns null when feature is disabled", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(false);
      await service.init();

      const result = service.getCachedData();

      expect(result).toBeNull();
      expect(mockSignal).not.toHaveBeenCalled();
    });
  });
});
