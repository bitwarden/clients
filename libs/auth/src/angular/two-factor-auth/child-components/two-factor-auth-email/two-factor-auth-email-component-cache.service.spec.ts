import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import {
  TwoFactorAuthEmailComponentCache,
  TwoFactorAuthEmailComponentCacheService,
} from "./two-factor-auth-email-component-cache.service";

describe("TwoFactorAuthEmailComponentCache", () => {
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

  describe("cacheData", () => {
    it("caches email sent state", () => {
      service.cacheData({ emailSent: true });

      expect(mockSignal.set).toHaveBeenCalledWith({
        emailSent: true,
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
      const testData = new TwoFactorAuthEmailComponentCache();
      testData.emailSent = true;
      cacheData.next(testData);

      const result = service.getCachedData();

      expect(result).toEqual(testData);
      expect(mockSignal).toHaveBeenCalled();
    });
  });
});
