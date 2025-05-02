import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { LoginViaAuthRequestView } from "@bitwarden/common/auth/models/view/login-via-auth-request.view";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { LoginViaAuthRequestCacheService } from "./default-login-via-auth-request-cache.service";

describe("LoginViaAuthRequestCache", () => {
  let service: LoginViaAuthRequestCacheService;
  let testBed: TestBed;

  const cacheSignal = signal<LoginViaAuthRequestView | null>(null);
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
        LoginViaAuthRequestCacheService,
      ],
    });
  });

  describe("feature enabled", () => {
    beforeEach(() => {
      getFeatureFlag.mockResolvedValue(true);
    });

    it("`getCachedLoginViaAuthRequestView` returns the cached data", async () => {
      cacheSignal.set({ ...buildMockState() });
      service = testBed.inject(LoginViaAuthRequestCacheService);
      await service.init();

      expect(service.getCachedLoginViaAuthRequestView()).toEqual({
        ...buildMockState(),
      });
    });

    it("updates the signal value", async () => {
      service = testBed.inject(LoginViaAuthRequestCacheService);
      await service.init();

      const parameters = buildAuthenticMockAuthView();

      service.cacheLoginView(parameters.id, parameters.privateKey, parameters.accessCode);

      expect(cacheSignal.set).toHaveBeenCalledWith({
        id: parameters.id,
        privateKey: Utils.fromBufferToB64(parameters.privateKey),
        accessCode: parameters.accessCode,
      });
    });
  });

  describe("feature disabled", () => {
    beforeEach(async () => {
      cacheSignal.set({ ...buildMockState() } as LoginViaAuthRequestView);
      getFeatureFlag.mockResolvedValue(false);
      cacheSetMock.mockClear();

      service = testBed.inject(LoginViaAuthRequestCacheService);
      await service.init();
    });

    it("`getCachedCipherView` returns null", () => {
      expect(service.getCachedLoginViaAuthRequestView()).toBeNull();
    });

    it("does not update the signal value", () => {
      const params = buildAuthenticMockAuthView();

      service.cacheLoginView(params.id, params.privateKey, params.accessCode);

      expect(cacheSignal.set).not.toHaveBeenCalled();
    });
  });

  const buildAuthenticMockAuthView = () => {
    return {
      id: "testId",
      privateKey: new Uint8Array(),
      accessCode: "testAccessCode",
    };
  };

  const buildMockState = () => {
    return {
      id: "testId",
      privateKey: Utils.fromBufferToB64(new Uint8Array()),
      accessCode: "testAccessCode",
    };
  };
});
