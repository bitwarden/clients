import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import {
  ServerCommunicationConfig,
  ServerCommunicationConfigClient,
  ServerCommunicationConfigPlatformApi,
} from "@bitwarden/sdk-internal";

import { ConfigService } from "../../abstractions/config/config.service";

import { DefaultServerCommunicationConfigService } from "./default-server-communication-config.service";
import { ServerCommunicationConfigRepository } from "./server-communication-config.repository";

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
  let serverCommunicationConfig$: Subject<ServerCommunicationConfig>;
  let service: DefaultServerCommunicationConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    repository = mock<ServerCommunicationConfigRepository>();
    platformApi = mock<ServerCommunicationConfigPlatformApi>();
    configService = mock<ConfigService>();

    serverCommunicationConfig$ = new Subject<ServerCommunicationConfig>();
    configService.serverCommunicationConfig$ = serverCommunicationConfig$.asObservable();

    service = new DefaultServerCommunicationConfigService(repository, platformApi, configService);
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
        },
      };
      serverCommunicationConfig$.next(config);

      expect(mockClientInstance.setCommunicationType).toHaveBeenCalledWith("example.com", config);
    });
  });
});
