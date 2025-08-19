import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";

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
  let cacheData: BehaviorSubject<TwoFactorAuthComponentCache | null>;
  let mockSignal: any;

  beforeEach(() => {
    mockViewCacheService = mock<ViewCacheService>();
    cacheData = new BehaviorSubject<TwoFactorAuthComponentCache | null>(null);
    mockSignal = jest.fn(() => cacheData.getValue());
    mockSignal.set = jest.fn((value: TwoFactorAuthComponentCache | null) => cacheData.next(value));
    mockViewCacheService.signal.mockReturnValue(mockSignal);

    TestBed.configureTestingModule({
      providers: [
        TwoFactorAuthComponentCacheService,
        { provide: ViewCacheService, useValue: mockViewCacheService },
      ],
    });

    service = TestBed.inject(TwoFactorAuthComponentCacheService);
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  describe("cacheData", () => {
    it("caches complete data", () => {
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

    it("caches partial data", () => {
      service.cacheData({ token: "123456" });

      expect(mockSignal.set).toHaveBeenCalledWith({
        token: "123456",
        remember: undefined,
        selectedProviderType: undefined,
      });
    });
  });

  describe("clearCachedData", () => {
    it("clears cached data", () => {
      service.clearCachedData();

      expect(mockSignal.set).toHaveBeenCalledWith(null);
    });
  });

  describe("getCachedData", () => {
    it("returns cached data", () => {
      const testData = new TwoFactorAuthComponentCache();
      testData.token = "123456";
      testData.remember = true;
      testData.selectedProviderType = TwoFactorProviderType.Email;
      cacheData.next(testData);

      const result = service.getCachedData();

      expect(result).toEqual(testData);
      expect(mockSignal).toHaveBeenCalled();
    });
  });
});
