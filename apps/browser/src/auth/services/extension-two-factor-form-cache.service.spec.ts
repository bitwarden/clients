import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";

import { ViewCacheService } from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { TwoFactorFormData } from "@bitwarden/auth/angular";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { ExtensionTwoFactorFormCacheService } from "./extension-two-factor-form-cache.service";

describe("ExtensionTwoFactorFormCacheService", () => {
  let service: ExtensionTwoFactorFormCacheService;
  let testBed: TestBed;
  const formDataSignal = signal<TwoFactorFormData | null>(null);
  const getFormDataSignal = jest.fn().mockReturnValue(formDataSignal);
  const getFeatureFlag = jest.fn().mockResolvedValue(false);
  const formDataSetMock = jest.spyOn(formDataSignal, "set");

  const mockFormData: TwoFactorFormData = {
    token: "123456",
    remember: true,
    selectedProviderType: TwoFactorProviderType.Authenticator,
    emailSent: false,
  };

  beforeEach(() => {
    getFormDataSignal.mockClear();
    getFeatureFlag.mockClear();
    formDataSetMock.mockClear();

    testBed = TestBed.configureTestingModule({
      providers: [
        { provide: ViewCacheService, useValue: { signal: getFormDataSignal } },
        { provide: ConfigService, useValue: { getFeatureFlag } },
        ExtensionTwoFactorFormCacheService,
      ],
    });
  });

  describe("feature enabled", () => {
    beforeEach(async () => {
      getFeatureFlag.mockImplementation((featureFlag: FeatureFlag) => {
        if (featureFlag === FeatureFlag.PM9115_TwoFactorFormPersistence) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      service = testBed.inject(ExtensionTwoFactorFormCacheService);
    });

    describe("isEnabled$", () => {
      it("emits true when feature flag is on", async () => {
        const result = await firstValueFrom(service.isEnabled$());

        expect(result).toBe(true);
        expect(getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.PM9115_TwoFactorFormPersistence);
      });
    });

    describe("isEnabled", () => {
      it("returns true when feature flag is on", async () => {
        const result = await service.isEnabled();

        expect(result).toBe(true);
        expect(getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.PM9115_TwoFactorFormPersistence);
      });
    });

    describe("getFormData", () => {
      it("returns cached form data", async () => {
        formDataSignal.set(mockFormData);

        const result = await service.getFormData();

        expect(result).toEqual(mockFormData);
      });

      it("returns null when cache is empty", async () => {
        formDataSignal.set(null);

        const result = await service.getFormData();

        expect(result).toBeNull();
      });
    });

    describe("formData$", () => {
      it("emits cached form data", async () => {
        formDataSignal.set(mockFormData);

        const result = await firstValueFrom(service.formData$());

        expect(result).toEqual(mockFormData);
      });

      it("emits null when cache is empty", async () => {
        formDataSignal.set(null);

        const result = await firstValueFrom(service.formData$());

        expect(result).toBeNull();
      });
    });

    describe("saveFormData", () => {
      it("updates the cached form data", async () => {
        await service.saveFormData(mockFormData);

        expect(formDataSetMock).toHaveBeenCalledWith({ ...mockFormData });
      });

      it("creates a shallow copy of the data", async () => {
        const data = { ...mockFormData };

        await service.saveFormData(data);

        expect(formDataSetMock).toHaveBeenCalledWith(data);
        // Should be a new object, not the same reference
        expect(formDataSetMock.mock.calls[0][0]).not.toBe(data);
      });
    });

    describe("clearFormData", () => {
      it("sets the cache to null", async () => {
        await service.clearFormData();

        expect(formDataSetMock).toHaveBeenCalledWith(null);
      });
    });
  });

  describe("feature disabled", () => {
    beforeEach(async () => {
      formDataSignal.set(mockFormData);
      getFeatureFlag.mockImplementation((featureFlag: FeatureFlag) => {
        if (featureFlag === FeatureFlag.PM9115_TwoFactorFormPersistence) {
          return Promise.resolve(false);
        }
        return Promise.resolve(false);
      });

      service = testBed.inject(ExtensionTwoFactorFormCacheService);
      formDataSetMock.mockClear();
    });

    describe("isEnabled$", () => {
      it("emits false when feature flag is off", async () => {
        const result = await firstValueFrom(service.isEnabled$());

        expect(result).toBe(false);
        expect(getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.PM9115_TwoFactorFormPersistence);
      });
    });

    describe("isEnabled", () => {
      it("returns false when feature flag is off", async () => {
        const result = await service.isEnabled();

        expect(result).toBe(false);
        expect(getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.PM9115_TwoFactorFormPersistence);
      });
    });

    describe("formData$", () => {
      it("emits null when feature is disabled", async () => {
        const result = await firstValueFrom(service.formData$());

        expect(result).toBeNull();
      });
    });

    describe("getFormData", () => {
      it("returns null when feature is disabled", async () => {
        const result = await service.getFormData();

        expect(result).toBeNull();
      });
    });

    describe("saveFormData", () => {
      it("does not update cache when feature is disabled", async () => {
        await service.saveFormData(mockFormData);

        expect(formDataSetMock).not.toHaveBeenCalled();
      });
    });

    describe("clearFormData", () => {
      it("still works when feature is disabled", async () => {
        await service.clearFormData();

        expect(formDataSetMock).toHaveBeenCalledWith(null);
      });
    });
  });
});
