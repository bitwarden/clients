import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { LoginViaAuthRequestView } from "@bitwarden/common/auth/models/view/login-via-auth-request.view";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { LoginViaAuthRequestCacheService } from "./default-login-via-auth-request-cache.service";

describe("LoginViaAuthRequestCache", () => {
  let service: LoginViaAuthRequestCacheService;
  let testBed: TestBed;

  const cacheSignal = signal<LoginViaAuthRequestView | null>(null);
  const getCacheSignal = jest.fn().mockReturnValue(cacheSignal);
  const cacheSetMock = jest.spyOn(cacheSignal, "set");

  beforeEach(() => {
    getCacheSignal.mockClear();
    cacheSetMock.mockClear();

    testBed = TestBed.configureTestingModule({
      providers: [
        { provide: ViewCacheService, useValue: { signal: getCacheSignal } },
        LoginViaAuthRequestCacheService,
      ],
    });
  });

  it("`getCachedLoginViaAuthRequestView` returns the cached data", async () => {
    cacheSignal.set({ ...buildMockState() });
    service = testBed.inject(LoginViaAuthRequestCacheService);

    expect(service.getCachedLoginViaAuthRequestView()).toEqual({
      ...buildMockState(),
    });
  });

  it("updates the signal value", async () => {
    service = testBed.inject(LoginViaAuthRequestCacheService);

    const parameters = buildAuthenticMockAuthView();

    service.cacheLoginView(parameters.id, parameters.privateKey, parameters.accessCode);

    expect(cacheSignal.set).toHaveBeenCalledWith({
      id: parameters.id,
      privateKey: Utils.fromBufferToB64(parameters.privateKey),
      accessCode: parameters.accessCode,
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
