import { MockProxy, mock } from "jest-mock-extended";
import { ReplaySubject, skip, take } from "rxjs";

import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { ConfigApiServiceAbstraction } from "../../abstractions/config/config-api.service.abstraction";
import { ServerConfig } from "../../abstractions/config/server-config";
import { EnvironmentService } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
import { StateService } from "../../abstractions/state.service";
import { ServerConfigData } from "../../models/data/server-config.data";
import {
  EnvironmentServerConfigResponse,
  ServerConfigResponse,
  ThirdPartyServerConfigResponse,
} from "../../models/response/server-config.response";

import { ConfigService } from "./config.service";

describe("ConfigService", () => {
  let stateService: MockProxy<StateService>;
  let configApiService: MockProxy<ConfigApiServiceAbstraction>;
  let authService: MockProxy<AuthService>;
  let environmentService: MockProxy<EnvironmentService>;
  let logService: MockProxy<LogService>;

  let serverResponseCount: number; // increments to track distinct responses received from server

  // Observables will start emitting as soon as this is created, so only create it
  // after everything is mocked
  const configServiceFactory = () => {
    const configService = new ConfigService(
      stateService,
      configApiService,
      authService,
      environmentService,
      logService
    );
    configService.init();
    return configService;
  };

  beforeEach(() => {
    stateService = mock();
    configApiService = mock();
    authService = mock();
    environmentService = mock();
    logService = mock();

    environmentService.urls = new ReplaySubject<void>(1);

    serverResponseCount = 1;
    configApiService.get.mockImplementation(() =>
      Promise.resolve(serverConfigResponseFactory("server" + serverResponseCount++))
    );

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("Uses storage as fallback", (done) => {
    const storedConfigData = serverConfigDataFactory("storedConfig");
    stateService.getServerConfig.mockResolvedValueOnce(storedConfigData);

    configApiService.get.mockRejectedValueOnce(new Error("Unable to fetch"));

    const configService = configServiceFactory();

    configService.serverConfig$.pipe(take(1)).subscribe((config) => {
      expect(config).toEqual(new ServerConfig(storedConfigData));
      expect(stateService.getServerConfig).toHaveBeenCalledTimes(1);
      expect(stateService.setServerConfig).not.toHaveBeenCalled();
      done();
    });

    configService.triggerServerConfigFetch();
  });

  it("Stream does not error out if fetch fails", (done) => {
    const storedConfigData = serverConfigDataFactory("storedConfig");
    stateService.getServerConfig.mockResolvedValueOnce(storedConfigData);

    const configService = configServiceFactory();

    configService.serverConfig$.pipe(skip(1), take(1)).subscribe((config) => {
      try {
        expect(config.gitHash).toEqual("server1");
        done();
      } catch (e) {
        done(e);
      }
    });

    configApiService.get.mockRejectedValueOnce(new Error("Unable to fetch"));
    configService.triggerServerConfigFetch();

    configApiService.get.mockResolvedValueOnce(serverConfigResponseFactory("server1"));
    configService.triggerServerConfigFetch();
  });

  describe("Fetches config from server", () => {
    beforeEach(() => {
      stateService.getServerConfig.mockResolvedValueOnce(null);
    });

    it.each<number | jest.DoneCallback>([1, 2, 3])(
      "after %p hour/s",
      (hours: number, done: jest.DoneCallback) => {
        const configService = configServiceFactory();

        // skip previous hours (if any)
        configService.serverConfig$.pipe(skip(hours - 1), take(1)).subscribe((config) => {
          try {
            expect(config.gitHash).toEqual("server" + hours);
            expect(configApiService.get).toHaveBeenCalledTimes(hours);
            done();
          } catch (e) {
            done(e);
          }
        });

        const oneHourInMs = 1000 * 3600;
        jest.advanceTimersByTime(oneHourInMs * hours + 1);
      }
    );

    it("when environment URLs change", (done) => {
      const configService = configServiceFactory();

      configService.serverConfig$.pipe(take(1)).subscribe((config) => {
        try {
          expect(config.gitHash).toEqual("server1");
          done();
        } catch (e) {
          done(e);
        }
      });

      (environmentService.urls as ReplaySubject<void>).next();
    });

    it("when triggerServerConfigFetch() is called", (done) => {
      const configService = configServiceFactory();

      configService.serverConfig$.pipe(take(1)).subscribe((config) => {
        try {
          expect(config.gitHash).toEqual("server1");
          done();
        } catch (e) {
          done(e);
        }
      });

      configService.triggerServerConfigFetch();
    });
  });

  it("Saves server config to storage when the user is logged in", (done) => {
    stateService.getServerConfig.mockResolvedValueOnce(null);
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
    const configService = configServiceFactory();

    configService.serverConfig$.pipe(take(1)).subscribe(() => {
      try {
        expect(stateService.setServerConfig).toHaveBeenCalledWith(
          expect.objectContaining({ gitHash: "server1" })
        );
        done();
      } catch (e) {
        done(e);
      }
    });

    configService.triggerServerConfigFetch();
  });
});

function serverConfigDataFactory(gitHash: string) {
  return new ServerConfigData(serverConfigResponseFactory(gitHash));
}

function serverConfigResponseFactory(gitHash: string) {
  return new ServerConfigResponse({
    version: "myConfigVersion",
    gitHash: gitHash,
    server: new ThirdPartyServerConfigResponse({
      name: "myThirdPartyServer",
      url: "www.example.com",
    }),
    environment: new EnvironmentServerConfigResponse({
      vault: "vault.example.com",
    }),
    featureStates: {
      feat1: "off",
      feat2: "on",
      feat3: "off",
    },
  });
}
