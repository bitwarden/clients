import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ViewCacheService } from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherFormCacheService } from "./default-cipher-form-cache.service";

describe("CipherFormCacheService", () => {
  let service: CipherFormCacheService;
  let testBed: TestBed;
  const cacheSignal = signal<CipherView | null>(null);
  const getCacheSignal = jest.fn().mockReturnValue(cacheSignal);
  const getFeatureFlag = jest.fn().mockResolvedValue(false);
  const cacheSetMock = jest.spyOn(cacheSignal, "set");

  beforeEach(() => {
    getCacheSignal.mockClear();
    getFeatureFlag.mockClear();
    cacheSetMock.mockClear();

    testBed = TestBed.configureTestingModule({
      providers: [
        { provide: ViewCacheService, useValue: { signal: getCacheSignal } },
        { provide: ConfigService, useValue: { getFeatureFlag } },
        CipherFormCacheService,
      ],
    });
  });

  describe("feature enabled", () => {
    beforeEach(async () => {
      getFeatureFlag.mockResolvedValue(true);
    });

    it("`getCachedCipherView` returns the cipher", async () => {
      cacheSignal.set({ id: "cipher-4" } as CipherView);
      service = testBed.inject(CipherFormCacheService);
      await service.init();

      expect(service.getCachedCipherView()).toEqual({ id: "cipher-4" });
    });

    it("updates the signal value", async () => {
      service = testBed.inject(CipherFormCacheService);
      await service.init();

      service.cacheCipherView({ id: "cipher-5" } as CipherView);

      expect(cacheSignal.set).toHaveBeenCalledWith({ id: "cipher-5" });
    });

    describe("initializedWithValue", () => {
      it("sets `initializedWithValue` to true when there is a cached cipher", async () => {
        cacheSignal.set({ id: "cipher-3" } as CipherView);
        service = testBed.inject(CipherFormCacheService);
        await service.init();

        expect(service.initializedWithValue).toBe(true);
      });

      it("sets `initializedWithValue` to false when there is not a cached cipher", async () => {
        cacheSignal.set(null);
        service = testBed.inject(CipherFormCacheService);
        await service.init();

        expect(service.initializedWithValue).toBe(false);
      });
    });
  });

  describe("featured disabled", () => {
    beforeEach(async () => {
      cacheSignal.set({ id: "cipher-1" } as CipherView);
      getFeatureFlag.mockResolvedValue(false);
      cacheSetMock.mockClear();

      service = testBed.inject(CipherFormCacheService);
      await service.init();
    });

    it("sets `initializedWithValue` to false", () => {
      expect(service.initializedWithValue).toBe(false);
    });

    it("`getCachedCipherView` returns null", () => {
      expect(service.getCachedCipherView()).toBeNull();
    });

    it("does not update the signal value", () => {
      service.cacheCipherView({ id: "cipher-2" } as CipherView);

      expect(cacheSignal.set).not.toHaveBeenCalled();
    });
  });
});
