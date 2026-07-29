import { mock, MockProxy } from "jest-mock-extended";
import { Subject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FetchMiddleware, FetchFn } from "@bitwarden/common/platform/misc/fetch-middleware";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  ServerCommunicationConfig,
  ServerCommunicationConfigClient,
  ServerCommunicationConfigPlatformApi,
} from "@bitwarden/sdk-internal";

import { DefaultServerCommunicationConfigService } from "./default-server-communication-config.service";
import { ServerCommunicationConfigRepository } from "./server-communication-config.repository";

class MockRequest {
  url: string;
  redirect: string;

  constructor(input: string | MockRequest, init?: { redirect?: string }) {
    this.url = typeof input === "string" ? input : input.url;
    this.redirect = init?.redirect ?? "follow";
  }

  clone(): MockRequest {
    return new MockRequest(this.url, { redirect: this.redirect });
  }
}

// Mock SdkLoadService
jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: {
    Ready: Promise.resolve(),
  },
}));

// Mock SDK client
const mockClientInstance = {
  needsBootstrap: jest.fn(),
  cookies: jest.fn(),
  setCommunicationType: jest.fn(),
  acquireCookie: jest.fn(),
};

jest.mock("@bitwarden/sdk-internal", () => ({
  ServerCommunicationConfigClient: jest.fn().mockImplementation(() => mockClientInstance),
}));

describe("DefaultServerCommunicationConfigService", () => {
  let repository: MockProxy<ServerCommunicationConfigRepository>;
  let platformApi: MockProxy<ServerCommunicationConfigPlatformApi>;
  let configService: MockProxy<ConfigService>;
  let apiService: MockProxy<ApiService>;
  let serverCommunicationConfig$: Subject<ServerCommunicationConfig>;
  let service: DefaultServerCommunicationConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    repository = mock<ServerCommunicationConfigRepository>();
    platformApi = mock<ServerCommunicationConfigPlatformApi>();
    configService = mock<ConfigService>();
    apiService = mock<ApiService>();

    serverCommunicationConfig$ = new Subject<ServerCommunicationConfig>();
    configService.serverCommunicationConfig$ = serverCommunicationConfig$.asObservable();

    service = new DefaultServerCommunicationConfigService(
      repository,
      platformApi,
      configService,
      apiService,
    );
    await service.init();
  });

  describe("init", () => {
    it("creates the SDK client with the repository and platform API", () => {
      expect(ServerCommunicationConfigClient).toHaveBeenCalledWith(repository, platformApi);
    });

    it("does not call setCommunicationType when bootstrap type is 'direct'", () => {
      const config: ServerCommunicationConfig = { bootstrap: { type: "direct" } };
      serverCommunicationConfig$.next(config);

      expect(mockClientInstance.setCommunicationType).not.toHaveBeenCalled();
    });

    it("calls setCommunicationType with the config for non-direct bootstrap types", () => {
      const config: ServerCommunicationConfig = {
        bootstrap: {
          type: "ssoCookieVendor",
          idpLoginUrl: "https://idp.example.com",
          cookieName: "exampleCookie",
          cookieDomain: "example.com",
          cookieValue: undefined,
          vaultUrl: "vault.bitwarden.com",
        },
      };
      serverCommunicationConfig$.next(config);

      expect(mockClientInstance.setCommunicationType).toHaveBeenCalledWith("example.com", config);
    });
  });

  describe("redirect middleware", () => {
    let middleware: FetchMiddleware;
    let next: jest.MockedFn<FetchFn>;
    let originalRequest: typeof Request;

    beforeEach(() => {
      originalRequest = global.Request;
      (global as any).Request = MockRequest;

      middleware = apiService.addMiddleware.mock.calls[0][0];
      next = jest.fn();
      repository.get$.mockReturnValue(of(undefined));
    });

    afterEach(() => {
      (global as any).Request = originalRequest;
    });

    it("registers one middleware on init", () => {
      expect(apiService.addMiddleware).toHaveBeenCalledTimes(1);
    });

    it("passes non-redirect responses through with one fetch", async () => {
      const ok = { status: 200, type: "default" } as Response;
      next.mockResolvedValueOnce(ok);
      const result = await middleware(new Request("https://vault.acme.com/"), next);
      expect(result).toBe(ok);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("first call uses redirect: manual clone, not original request", async () => {
      const ok = { status: 200, type: "default" } as Response;
      next.mockResolvedValueOnce(ok);
      const request = new Request("https://vault.acme.com/");
      await middleware(request, next);
      expect(next.mock.calls[0][0]).not.toBe(request);
      expect(next.mock.calls[0][0].redirect).toBe("manual");
    });

    it("calls acquireCookie and retries on opaqueredirect when bootstrap needed", async () => {
      const redirect = { status: 0, type: "opaqueredirect" } as Response;
      const ok = { status: 200, type: "default" } as Response;
      next.mockResolvedValueOnce(redirect).mockResolvedValueOnce(ok);
      mockClientInstance.needsBootstrap.mockResolvedValue(true);

      const request = new Request("https://vault.acme.com/api");
      const result = await middleware(request, next);

      expect(repository.get$).toHaveBeenCalledWith("vault.acme.com");
      expect(mockClientInstance.needsBootstrap).toHaveBeenCalledWith("vault.acme.com");
      expect(mockClientInstance.acquireCookie).toHaveBeenCalledWith("vault.acme.com");
      expect(next).toHaveBeenCalledTimes(2);
      expect(next.mock.calls[1][0]).toBe(request); // retry uses original
      expect(result).toBe(ok);
    });

    it("passes non-opaqueredirect responses through without bootstrap check", async () => {
      const redirect = { status: 302, type: "basic" } as Response;
      next.mockResolvedValueOnce(redirect);

      const result = await middleware(new Request("https://vault.acme.com/"), next);

      expect(mockClientInstance.needsBootstrap).not.toHaveBeenCalled();
      expect(mockClientInstance.acquireCookie).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      expect(result).toBe(redirect);
    });

    it("returns opaqueredirect response early without retry when bootstrap not needed", async () => {
      const redirect = { status: 0, type: "opaqueredirect" } as Response;
      next.mockResolvedValueOnce(redirect);
      mockClientInstance.needsBootstrap.mockResolvedValue(false);

      const result = await middleware(new Request("https://vault.acme.com/"), next);

      expect(repository.get$).toHaveBeenCalledWith("vault.acme.com");
      expect(mockClientInstance.needsBootstrap).toHaveBeenCalledWith("vault.acme.com");
      expect(mockClientInstance.acquireCookie).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      expect(result).toBe(redirect);
    });

    it("returns opaqueredirect response without bootstrap when hostname cannot be extracted from URL", async () => {
      const redirect = { status: 0, type: "opaqueredirect" } as Response;
      next.mockResolvedValueOnce(redirect);
      jest.spyOn(Utils, "getHostname").mockReturnValueOnce(null);

      const result = await middleware(new Request("https://vault.acme.com/"), next);

      expect(mockClientInstance.needsBootstrap).not.toHaveBeenCalled();
      expect(mockClientInstance.acquireCookie).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      expect(result).toBe(redirect);
    });
  });
});
