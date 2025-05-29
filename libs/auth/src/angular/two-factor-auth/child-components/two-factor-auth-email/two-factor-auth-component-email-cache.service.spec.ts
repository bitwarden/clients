import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import {
  TwoFactorAuthEmailComponentCache,
  TwoFactorAuthEmailComponentCacheService,
} from "./two-factor-auth-email-component-cache.service";

describe("TwoFactorAuthEmailCache", () => {
  describe("fromJSON", () => {
    it("returns null when input is null", () => {
      const result = TwoFactorAuthEmailComponentCache.fromJSON(null as any);
      expect(result).toBeNull();
    });

    it("creates a TwoFactorAuthEmailCache instance from valid JSON", () => {
      const jsonData = { emailSent: true };
      const result = TwoFactorAuthEmailComponentCache.fromJSON(jsonData);

      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(TwoFactorAuthEmailComponentCache);
      expect(result?.emailSent).toBe(true);
    });
  });
});

describe("TwoFactorAuthEmailComponentCacheService", () => {
  let service: TwoFactorAuthEmailComponentCacheService;
  let mockViewCacheService: MockProxy<ViewCacheService>;
  let mockConfigService: MockProxy<ConfigService>;
  let cacheData: BehaviorSubject<TwoFactorAuthEmailComponentCache | null>;
  let mockSignal: any;

  beforeEach(() => {
    mockViewCacheService = mock<ViewCacheService>();
    mockConfigService = mock<ConfigService>();
    cacheData = new BehaviorSubject<TwoFactorAuthEmailComponentCache | null>(null);
    mockSignal = jest.fn(() => cacheData.getValue());
    mockSignal.set = jest.fn((value: TwoFactorAuthEmailComponentCache | null) =>
      cacheData.next(value),
    );
    mockViewCacheService.signal.mockReturnValue(mockSignal);

    TestBed.configureTestingModule({
      providers: [
        TwoFactorAuthEmailComponentCacheService,
        { provide: ViewCacheService, useValue: mockViewCacheService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    });

    service = TestBed.inject(TwoFactorAuthEmailComponentCacheService);
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

      service.cacheData({ emailSent: true });
      expect(mockSignal.set).toHaveBeenCalled();
    });

    it("sets featureEnabled to false when flag is disabled", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(false);

      await service.init();

      expect(mockConfigService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM9115_TwoFactorExtensionDataPersistence,
      );

      service.cacheData({ emailSent: true });
      expect(mockSignal.set).not.toHaveBeenCalled();
    });
  });

  describe("cacheData", () => {
    beforeEach(async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      await service.init();
    });

    it("caches email sent state when feature is enabled", () => {
      service.cacheData({ emailSent: true });

      expect(mockSignal.set).toHaveBeenCalledWith({
        emailSent: true,
      });
    });

    it("does not cache data when feature is disabled", async () => {
      mockConfigService.getFeatureFlag.mockResolvedValue(false);
      await service.init();

      service.cacheData({ emailSent: true });

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
      const testData = new TwoFactorAuthEmailComponentCache();
      testData.emailSent = true;
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
