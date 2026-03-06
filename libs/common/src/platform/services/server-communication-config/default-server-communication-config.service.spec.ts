import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import {
  ServerCommunicationConfig,
  ServerCommunicationConfigClient,
  ServerCommunicationConfigPlatformApi,
} from "@bitwarden/sdk-internal";

import { ApiService } from "../../../abstractions/api.service";
import { ConfigService } from "../../abstractions/config/config.service";

import { DefaultServerCommunicationConfigService } from "./default-server-communication-config.service";
import { ServerCommunicationConfigRepository } from "./server-communication-config.repository";

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: {
    Ready: Promise.resolve(),
  },
}));

const mockClientInstance = {
  setCommunicationType: jest.fn(),
  cookies: jest.fn(),
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

    it("does not register cookie middleware when bootstrap type is 'direct'", () => {
      const config: ServerCommunicationConfig = { bootstrap: { type: "direct" } };
      serverCommunicationConfig$.next(config);

      expect(apiService.addMiddleware).not.toHaveBeenCalled();
    });

    it("calls setCommunicationType with the config for non-direct bootstrap types", () => {
      const config: ServerCommunicationConfig = { bootstrap: { type: "ssocookievendor" } };
      serverCommunicationConfig$.next(config);

      expect(mockClientInstance.setCommunicationType).toHaveBeenCalledWith(config);
    });

    it("registers cookie middleware for non-direct bootstrap types", () => {
      const config: ServerCommunicationConfig = { bootstrap: { type: "ssocookievendor" } };
      serverCommunicationConfig$.next(config);

      expect(apiService.addMiddleware).toHaveBeenCalledTimes(1);
      expect(apiService.addMiddleware).toHaveBeenCalledWith(expect.any(Function));
    });

    it("registers a new middleware for each non-direct config emission", () => {
      const config: ServerCommunicationConfig = { bootstrap: { type: "ssocookievendor" } };
      serverCommunicationConfig$.next(config);
      serverCommunicationConfig$.next(config);

      expect(apiService.addMiddleware).toHaveBeenCalledTimes(2);
    });
  });

  describe("cookie middleware", () => {
    let capturedMiddleware: (request: Request) => Promise<void>;

    const makeRequest = (url: string): Request => {
      const headers = new Headers();
      return { url, headers } as unknown as Request;
    };

    beforeEach(() => {
      const config: ServerCommunicationConfig = { bootstrap: { type: "ssocookievendor" } };
      serverCommunicationConfig$.next(config);

      capturedMiddleware = apiService.addMiddleware.mock.calls[0][0];
    });

    it("sets the Cookie header when the SDK returns cookies for the domain", async () => {
      mockClientInstance.cookies.mockResolvedValueOnce([
        ["session", "abc123"],
        ["token", "xyz789"],
      ]);

      const request = makeRequest("https://api.example.com/data");
      await capturedMiddleware(request);

      expect(request.headers.get("Cookie")).toBe("session=abc123; token=xyz789");
    });

    it("does not set the Cookie header when no cookies are returned", async () => {
      mockClientInstance.cookies.mockResolvedValueOnce([]);

      const request = makeRequest("https://api.example.com/data");
      await capturedMiddleware(request);

      expect(request.headers.get("Cookie")).toBeNull();
    });

    it("queries cookies using the domain extracted from the request URL", async () => {
      mockClientInstance.cookies.mockResolvedValueOnce([]);

      const request = makeRequest("https://api.example.com/some/path");
      await capturedMiddleware(request);

      // Utils.getDomain strips subdomains, returning the registrable domain
      expect(mockClientInstance.cookies).toHaveBeenCalledWith("example.com");
    });
  });
});
