/**
 * need to update test environment so structuredClone works appropriately
 * @jest-environment ../../libs/shared/test.environment.ts
 */

import { matches, mock } from "jest-mock-extended";
import { BehaviorSubject, Subject, bufferCount, firstValueFrom, of } from "rxjs";

import {
  FakeGlobalState,
  FakeSingleUserState,
  FakeStateProvider,
  mockAccountServiceWith,
} from "../../../../spec";
import { Matrix } from "../../../../spec/matrix";
import { subscribeTo } from "../../../../spec/observable-tracker";
import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { UserId } from "../../../types/guid";
import { ConfigApiServiceAbstraction } from "../../abstractions/config/config-api.service.abstraction";
import { ServerConfig } from "../../abstractions/config/server-config";
import { Environment, EnvironmentService } from "../../abstractions/environment.service";
import { LogService } from "../../abstractions/log.service";
import { Utils } from "../../misc/utils";
import { ServerConfigData } from "../../models/data/server-config.data";
import {
  EnvironmentServerConfigResponse,
  ServerConfigResponse,
  ThirdPartyServerConfigResponse,
} from "../../models/response/server-config.response";

import {
  ApiUrl,
  DefaultConfigService,
  RETRIEVAL_INTERVAL,
  GLOBAL_SERVER_CONFIGURATIONS,
  USER_SERVER_CONFIG,
  SLOW_EMISSION_GUARD,
} from "./default-config.service";

describe("ConfigService", () => {
  const configApiService = mock<ConfigApiServiceAbstraction>();
  const environmentService = mock<EnvironmentService>();
  const logService = mock<LogService>();
  const authService = mock<AuthService>({
    authStatusFor$: (userId) => of(AuthenticationStatus.Unlocked),
  });
  let stateProvider: FakeStateProvider;
  let globalState: FakeGlobalState<Record<ApiUrl, ServerConfig>>;
  let userState: FakeSingleUserState<ServerConfig>;
  const activeApiUrl = apiUrl(0);
  const userId = "userId" as UserId;
  const accountService = mockAccountServiceWith(userId);
  const tooOld = new Date(Date.now() - 1.1 * RETRIEVAL_INTERVAL);

  beforeEach(() => {
    stateProvider = new FakeStateProvider(accountService);
    globalState = stateProvider.global.getFake(GLOBAL_SERVER_CONFIGURATIONS);
    userState = stateProvider.singleUser.getFake(userId, USER_SERVER_CONFIG);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe.each([null, userId])("active user: %s", (activeUserId) => {
    let sut: DefaultConfigService;

    const environmentSubject = new BehaviorSubject(environmentFactory(activeApiUrl));

    beforeAll(async () => {
      await accountService.switchAccount(activeUserId);
    });

    beforeEach(() => {
      Matrix.autoMockMethod(environmentService.getEnvironment$, () => environmentSubject);
      environmentService.globalEnvironment$ = environmentSubject;
      sut = new DefaultConfigService(
        configApiService,
        environmentService,
        logService,
        stateProvider,
        authService,
      );
    });

    describe("serverConfig$", () => {
      it.each([{}, null])("handles null stored state", async (globalTestState) => {
        globalState.stateSubject.next(globalTestState);
        userState.nextState(null);
        await expect(firstValueFrom(sut.serverConfig$)).resolves.not.toThrow();
      });

      describe.each(["stale", "missing"])("%s config", (configStateDescription) => {
        const userStored =
          configStateDescription === "missing"
            ? null
            : serverConfigFactory(activeApiUrl + userId, tooOld);
        const globalStored =
          configStateDescription === "missing"
            ? {
                [activeApiUrl]: null,
              }
            : {
                [activeApiUrl]: serverConfigFactory(activeApiUrl, tooOld),
                [activeApiUrl + "0"]: serverConfigFactory(activeApiUrl + userId, tooOld),
              };

        beforeEach(() => {
          globalState.stateSubject.next(globalStored);
          userState.nextState(userStored);
        });

        describe("fail to fetch", () => {
          beforeEach(() => {
            configApiService.get.mockRejectedValue(new Error("Unable to fetch"));
          });

          it("uses storage as fallback", async () => {
            const actual = await firstValueFrom(sut.serverConfig$);
            expect(actual).toEqual(activeUserId ? userStored : globalStored[activeApiUrl]);
            expect(configApiService.get).toHaveBeenCalledTimes(1);
          });

          it("does not error out when fetch fails", async () => {
            await expect(firstValueFrom(sut.serverConfig$)).resolves.not.toThrow();
            expect(configApiService.get).toHaveBeenCalledTimes(1);
          });

          it("logs an error when unable to fetch", async () => {
            await firstValueFrom(sut.serverConfig$);

            expect(logService.error).toHaveBeenCalledWith(
              `Unable to fetch ServerConfig from ${activeApiUrl}`,
              matches<Error>((e) => e.message === "Unable to fetch"),
            );
          });
        });

        describe("fetch success", () => {
          const response = serverConfigResponseFactory();
          const newConfig = new ServerConfig(new ServerConfigData(response));

          beforeEach(() => {
            configApiService.get.mockResolvedValue(response);
          });

          it("should be a new config", async () => {
            expect(newConfig).not.toEqual(activeUserId ? userStored : globalStored[activeApiUrl]);
          });

          it("fetches config from server when it's older than an hour", async () => {
            await firstValueFrom(sut.serverConfig$);

            expect(configApiService.get).toHaveBeenCalledTimes(1);
          });

          it("returns the updated config", async () => {
            const actual = await firstValueFrom(sut.serverConfig$);

            // This is the time the response is converted to a config
            expect(actual.utcDate).toAlmostEqual(newConfig.utcDate, 1000);
            delete actual.utcDate;
            delete newConfig.utcDate;

            expect(actual).toEqual(newConfig);
          });
        });
      });

      describe("fresh configuration", () => {
        const userStored = serverConfigFactory(activeApiUrl + userId);
        const globalStored = {
          [activeApiUrl]: serverConfigFactory(activeApiUrl),
        };
        beforeEach(() => {
          globalState.stateSubject.next(globalStored);
          userState.nextState(userStored);
          Matrix.autoMockMethod(environmentService.getEnvironment$, () => environmentSubject);
        });
        it("does not fetch from server", async () => {
          await firstValueFrom(sut.serverConfig$);

          expect(configApiService.get).not.toHaveBeenCalled();
        });

        it("uses stored value", async () => {
          const actual = await firstValueFrom(sut.serverConfig$);
          expect(actual).toEqual(activeUserId ? userStored : globalStored[activeApiUrl]);
        });
      });
    });
  });

  it("gets global config when there is an locked active user", async () => {
    await accountService.switchAccount(userId);
    environmentService.globalEnvironment$ = of(environmentFactory(activeApiUrl));

    globalState.stateSubject.next({
      [activeApiUrl]: serverConfigFactory(activeApiUrl + "global"),
    });
    userState.nextState(serverConfigFactory(userId));

    const sut = new DefaultConfigService(
      configApiService,
      environmentService,
      logService,
      stateProvider,
      mock<AuthService>({
        authStatusFor$: () => of(AuthenticationStatus.Locked),
      }),
    );

    const config = await firstValueFrom(sut.serverConfig$);

    expect(config.gitHash).toEqual(activeApiUrl + "global");
  });

  describe("environment change", () => {
    let sut: DefaultConfigService;
    let environmentSubject: Subject<Environment>;

    beforeAll(async () => {
      // updating environment with an active account is undefined behavior
      await accountService.switchAccount(null);
    });

    beforeEach(() => {
      environmentSubject = new Subject<Environment>();
      environmentService.globalEnvironment$ = environmentSubject;
      Matrix.autoMockMethod(environmentService.getEnvironment$, () => environmentSubject);
      sut = new DefaultConfigService(
        configApiService,
        environmentService,
        logService,
        stateProvider,
        authService,
      );
    });

    describe("serverConfig$", () => {
      it("emits a new config when the environment changes", async () => {
        const globalStored = {
          [apiUrl(0)]: serverConfigFactory(apiUrl(0)),
          [apiUrl(1)]: serverConfigFactory(apiUrl(1)),
        };
        globalState.stateSubject.next(globalStored);

        const spy = subscribeTo(sut.serverConfig$);

        environmentSubject.next(environmentFactory(apiUrl(0)));
        environmentSubject.next(environmentFactory(apiUrl(1)));

        const expected = [globalStored[apiUrl(0)], globalStored[apiUrl(1)]];

        const actual = await spy.pauseUntilReceived(2);
        expect(actual.length).toBe(2);

        // validate dates this is done separately because the dates are created when ServerConfig is initialized
        expect(actual[0].utcDate).toAlmostEqual(expected[0].utcDate, 1000);
        expect(actual[1].utcDate).toAlmostEqual(expected[1].utcDate, 1000);
        delete actual[0].utcDate;
        delete actual[1].utcDate;
        delete expected[0].utcDate;
        delete expected[1].utcDate;

        expect(actual).toEqual(expected);
        spy.unsubscribe();
      });
    });
  });

  describe("userCachedFeatureFlag$", () => {
    it("maps saved user config to a feature flag", async () => {
      const updateFeature = (value: boolean) => {
        return new ServerConfig(
          new ServerConfigData({
            featureStates: {
              "test-feature": value,
            },
          }),
        );
      };

      const configService = new DefaultConfigService(
        configApiService,
        environmentService,
        logService,
        stateProvider,
        authService,
      );

      userState.nextState(null);

      const promise = firstValueFrom(
        configService
          .userCachedFeatureFlag$("test-feature" as FeatureFlag, userId)
          .pipe(bufferCount(3)),
      );

      userState.nextState(updateFeature(true));
      userState.nextState(updateFeature(false));

      const values = await promise;

      // We wouldn't normally expect this to be undefined, the logic
      // should normally return the feature flags default value but since
      // we are faking a feature flag key, undefined is expected
      expect(values[0]).toBe(undefined);
      expect(values[1]).toBe(true);
      expect(values[2]).toBe(false);
    });
  });

  describe("slow configuration", () => {
    const environmentSubject = new BehaviorSubject<Environment>(null);

    let sut: DefaultConfigService = null;

    beforeEach(async () => {
      const config = serverConfigFactory("existing-data", tooOld);
      environmentService.globalEnvironment$ = environmentSubject;
      Matrix.autoMockMethod(environmentService.getEnvironment$, () => environmentSubject);

      globalState.stateSubject.next({ [apiUrl(0)]: config });
      userState.stateSubject.next({
        syncValue: true,
        combinedState: [userId, config],
      });

      configApiService.get.mockImplementation(() => {
        return new Promise<ServerConfigResponse>((resolve) => {
          setTimeout(() => {
            resolve(serverConfigResponseFactory("slow-response"));
          }, SLOW_EMISSION_GUARD + 20);
        });
      });

      sut = new DefaultConfigService(
        configApiService,
        environmentService,
        logService,
        stateProvider,
        authService,
      );
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it("emits old configuration when the http call takes a long time", async () => {
      environmentSubject.next(environmentFactory(apiUrl(0)));

      const configs = await firstValueFrom(sut.serverConfig$.pipe(bufferCount(2)));

      expect(configs[0].gitHash).toBe("existing-data");
      expect(configs[1].gitHash).toBe("slow-response");
    });
  });
});

function apiUrl(count: number) {
  return `https://api${count}.test.com`;
}

function serverConfigFactory(hash: string, date: Date = new Date()) {
  const config = new ServerConfig(serverConfigDataFactory(hash));
  config.utcDate = date;
  return config;
}

function serverConfigDataFactory(hash?: string) {
  return new ServerConfigData(serverConfigResponseFactory(hash));
}

function serverConfigResponseFactory(hash?: string) {
  return new ServerConfigResponse({
    version: "myConfigVersion",
    gitHash: hash ?? Utils.newGuid(), // Use optional git hash to store uniqueness value
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

function environmentFactory(apiUrl: string, isCloud: boolean = true) {
  return {
    getApiUrl: () => apiUrl,
    isCloud: () => isCloud,
  } as Environment;
}
