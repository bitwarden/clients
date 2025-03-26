import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ViewCacheService } from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { AuthRequestType } from "@bitwarden/common/auth/enums/auth-request-type";
import { AuthRequest } from "@bitwarden/common/auth/models/request/auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { LoginViaAuthRequestView } from "@bitwarden/common/auth/models/view/login-via-auth-request.view";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

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
      cacheSignal.set({ ...buildAuthenticMockAuthView() });
      service = testBed.inject(LoginViaAuthRequestCacheService);
      await service.init();

      expect(service.getCachedLoginViaAuthRequestView()).toEqual({
        ...buildAuthenticMockAuthView(),
      });
    });

    it("updates the signal value", async () => {
      service = testBed.inject(LoginViaAuthRequestCacheService);
      await service.init();

      const parameters = buildAuthenticMockAuthView();

      service.cacheLoginView(
        parameters.authRequest,
        parameters.authRequestResponse,
        parameters.fingerprintPhrase,
        { publicKey: new Uint8Array(), privateKey: new Uint8Array() },
      );

      expect(cacheSignal.set).toHaveBeenCalledWith(parameters);
    });
  });

  describe("feature disabled", () => {
    beforeEach(async () => {
      cacheSignal.set({ ...buildAuthenticMockAuthView() } as LoginViaAuthRequestView);
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

      service.cacheLoginView(
        params.authRequest,
        params.authRequestResponse,
        params.fingerprintPhrase,
        { publicKey: new Uint8Array(), privateKey: new Uint8Array() },
      );

      expect(cacheSignal.set).not.toHaveBeenCalled();
    });
  });

  const buildAuthenticMockAuthView = () => {
    return {
      fingerprintPhrase: "",
      privateKey: "",
      publicKey: "",
      authRequest: new AuthRequest(
        "test@gmail.com",
        "deviceIdentifier",
        "publicKey",
        AuthRequestType.Unlock,
        "accessCode",
      ),
      authRequestResponse: new AuthRequestResponse({}),
    };
  };
});
