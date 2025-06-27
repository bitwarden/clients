import { firstValueFrom } from "rxjs";

import { FakeStateProvider, awaitAsync } from "../../../spec";
import { FakeAccountService } from "../../../spec/fake-account-service";
import { UserId } from "../../types/guid";
import { CloudRegion, Region } from "../abstractions/environment.service";

import {
  GLOBAL_ENVIRONMENT_KEY,
  DefaultEnvironmentService,
  EnvironmentUrls,
  USER_ENVIRONMENT_KEY,
} from "./default-environment.service";

// There are a few main states EnvironmentService could be in when first used
// 1. Not initialized, no active user. Hopefully not to likely but possible
// 2. Not initialized, with active user. Not likely
// 3. Initialized, no active user.
// 4. Initialized, with active user.
describe("EnvironmentService", () => {
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;

  let sut: DefaultEnvironmentService;

  const testUser = "00000000-0000-1000-a000-000000000001" as UserId;
  const alternateTestUser = "00000000-0000-1000-a000-000000000002" as UserId;

  beforeEach(async () => {
    accountService = new FakeAccountService({
      [testUser]: {
        name: "name",
        email: "email",
        emailVerified: false,
      },
      [alternateTestUser]: {
        name: "name",
        email: "email",
        emailVerified: false,
      },
    });
    stateProvider = new FakeStateProvider(accountService);

    sut = new DefaultEnvironmentService(stateProvider, accountService);
  });

  const switchUser = async (userId: UserId) => {
    accountService.activeAccountSubject.next({
      id: userId,
      email: "test@example.com",
      name: `Test Name ${userId}`,
      emailVerified: false,
    });
    await awaitAsync();
  };

  const setGlobalData = (region: Region, environmentUrls: EnvironmentUrls) => {
    stateProvider.global.getFake(GLOBAL_ENVIRONMENT_KEY).stateSubject.next({
      region: region,
      urls: environmentUrls,
    });
  };

  const setUserData = (
    region: Region,
    environmentUrls: EnvironmentUrls,
    userId: UserId = testUser,
  ) => {
    stateProvider.singleUser.getFake(userId, USER_ENVIRONMENT_KEY).nextState({
      region: region,
      urls: environmentUrls,
    });
  };

  const REGION_SETUP = [
    {
      region: Region.US,
      expectedUrls: {
        webVault: "https://vault.bitwarden.com",
        identity: "https://identity.bitwarden.com",
        api: "https://api.bitwarden.com",
        icons: "https://icons.bitwarden.net",
        notifications: "https://notifications.bitwarden.com",
        events: "https://events.bitwarden.com",
        scim: "https://scim.bitwarden.com/v2",
        send: "https://send.bitwarden.com/#",
      },
    },
    {
      region: Region.EU,
      expectedUrls: {
        webVault: "https://vault.bitwarden.eu",
        identity: "https://identity.bitwarden.eu",
        api: "https://api.bitwarden.eu",
        icons: "https://icons.bitwarden.eu",
        notifications: "https://notifications.bitwarden.eu",
        events: "https://events.bitwarden.eu",
        scim: "https://scim.bitwarden.eu/v2",
        send: "https://vault.bitwarden.eu/#/send/",
      },
    },
  ];

  describe("with user", () => {
    it.each(REGION_SETUP)(
      "sets correct urls for each region %s",
      async ({ region, expectedUrls }) => {
        setUserData(region, new EnvironmentUrls());
        await switchUser(testUser);

        const env = await firstValueFrom(sut.environment$);

        expect(env.hasBaseUrl()).toBe(false);
        expect(env.getWebVaultUrl()).toBe(expectedUrls.webVault);
        expect(env.getIdentityUrl()).toBe(expectedUrls.identity);
        expect(env.getApiUrl()).toBe(expectedUrls.api);
        expect(env.getIconsUrl()).toBe(expectedUrls.icons);
        expect(env.getNotificationsUrl()).toBe(expectedUrls.notifications);
        expect(env.getEventsUrl()).toBe(expectedUrls.events);
        expect(env.getScimUrl()).toBe(expectedUrls.scim);
        expect(env.getSendUrl()).toBe(expectedUrls.send);
        expect(env.getKeyConnectorUrl()).toBe(undefined);
        expect(env.isCloud()).toBe(true);
        expect(env.getUrls()).toEqual({
          base: null,
          cloudWebVault: undefined,
          webVault: expectedUrls.webVault,
          identity: expectedUrls.identity,
          api: expectedUrls.api,
          icons: expectedUrls.icons,
          notifications: expectedUrls.notifications,
          events: expectedUrls.events,
          scim: expectedUrls.scim.replace("/v2", ""),
          keyConnector: undefined,
        });
      },
    );

    it("returns user data", async () => {
      const globalEnvironmentUrls = new EnvironmentUrls();
      globalEnvironmentUrls.base = "https://global-url.example.com";
      setGlobalData(Region.SelfHosted, globalEnvironmentUrls);

      const userEnvironmentUrls = new EnvironmentUrls();
      userEnvironmentUrls.base = "https://user-url.example.com";
      setUserData(Region.SelfHosted, userEnvironmentUrls);

      await switchUser(testUser);

      const env = await firstValueFrom(sut.environment$);

      expect(env.getWebVaultUrl()).toBe("https://user-url.example.com");
      expect(env.getIdentityUrl()).toBe("https://user-url.example.com/identity");
      expect(env.getApiUrl()).toBe("https://user-url.example.com/api");
      expect(env.getIconsUrl()).toBe("https://user-url.example.com/icons");
      expect(env.getNotificationsUrl()).toBe("https://user-url.example.com/notifications");
      expect(env.getEventsUrl()).toBe("https://user-url.example.com/events");
      expect(env.getScimUrl()).toBe("https://user-url.example.com/scim/v2");
      expect(env.getSendUrl()).toBe("https://user-url.example.com/#/send/");
      expect(env.isCloud()).toBe(false);
      expect(env.getUrls()).toEqual({
        base: "https://user-url.example.com",
        api: null,
        cloudWebVault: undefined,
        events: null,
        icons: null,
        identity: null,
        keyConnector: null,
        notifications: null,
        scim: null,
        webVault: null,
      });
    });
  });

  describe("without user", () => {
    it.each(REGION_SETUP)("gets default urls %s", async ({ region, expectedUrls }) => {
      setGlobalData(region, new EnvironmentUrls());
      const env = await firstValueFrom(sut.environment$);

      expect(env.hasBaseUrl()).toBe(false);
      expect(env.getWebVaultUrl()).toBe(expectedUrls.webVault);
      expect(env.getIdentityUrl()).toBe(expectedUrls.identity);
      expect(env.getApiUrl()).toBe(expectedUrls.api);
      expect(env.getIconsUrl()).toBe(expectedUrls.icons);
      expect(env.getNotificationsUrl()).toBe(expectedUrls.notifications);
      expect(env.getEventsUrl()).toBe(expectedUrls.events);
      expect(env.getScimUrl()).toBe(expectedUrls.scim);
      expect(env.getSendUrl()).toBe(expectedUrls.send);
      expect(env.getKeyConnectorUrl()).toBe(undefined);
      expect(env.isCloud()).toBe(true);
      expect(env.getUrls()).toEqual({
        base: null,
        cloudWebVault: undefined,
        webVault: expectedUrls.webVault,
        identity: expectedUrls.identity,
        api: expectedUrls.api,
        icons: expectedUrls.icons,
        notifications: expectedUrls.notifications,
        events: expectedUrls.events,
        scim: expectedUrls.scim.replace("/v2", ""),
        keyConnector: undefined,
      });
    });

    it("gets global data", async () => {
      const globalEnvironmentUrls = new EnvironmentUrls();
      globalEnvironmentUrls.base = "https://global-url.example.com";
      globalEnvironmentUrls.keyConnector = "https://global-key-connector.example.com";
      setGlobalData(Region.SelfHosted, globalEnvironmentUrls);

      const userEnvironmentUrls = new EnvironmentUrls();
      userEnvironmentUrls.base = "https://user-url.example.com";
      userEnvironmentUrls.keyConnector = "https://user-key-connector.example.com";
      setUserData(Region.SelfHosted, userEnvironmentUrls);

      const env = await firstValueFrom(sut.environment$);

      expect(env.getWebVaultUrl()).toBe("https://global-url.example.com");
      expect(env.getIdentityUrl()).toBe("https://global-url.example.com/identity");
      expect(env.getApiUrl()).toBe("https://global-url.example.com/api");
      expect(env.getIconsUrl()).toBe("https://global-url.example.com/icons");
      expect(env.getNotificationsUrl()).toBe("https://global-url.example.com/notifications");
      expect(env.getEventsUrl()).toBe("https://global-url.example.com/events");
      expect(env.getScimUrl()).toBe("https://global-url.example.com/scim/v2");
      expect(env.getSendUrl()).toBe("https://global-url.example.com/#/send/");
      expect(env.getKeyConnectorUrl()).toBe("https://global-key-connector.example.com");
      expect(env.isCloud()).toBe(false);
      expect(env.getUrls()).toEqual({
        api: null,
        base: "https://global-url.example.com",
        cloudWebVault: undefined,
        webVault: null,
        events: null,
        icons: null,
        identity: null,
        keyConnector: "https://global-key-connector.example.com",
        notifications: null,
        scim: null,
      });
    });
  });

  describe("setEnvironment", () => {
    it("self-hosted with base-url", async () => {
      await sut.setEnvironment(Region.SelfHosted, {
        base: "base.example.com",
      });
      await awaitAsync();

      const env = await firstValueFrom(sut.environment$);

      expect(env.getRegion()).toBe(Region.SelfHosted);
      expect(env.getUrls()).toEqual({
        base: "https://base.example.com",
        api: null,
        identity: null,
        webVault: null,
        icons: null,
        notifications: null,
        scim: null,
        events: null,
        keyConnector: null,
      });
    });

    it("self-hosted and sets all urls", async () => {
      let env = await firstValueFrom(sut.environment$);
      expect(env.getScimUrl()).toBe("https://scim.bitwarden.com/v2");

      await sut.setEnvironment(Region.SelfHosted, {
        base: "base.example.com",
        api: "api.example.com",
        identity: "identity.example.com",
        webVault: "vault.example.com",
        icons: "icons.example.com",
        notifications: "notifications.example.com",
        scim: "scim.example.com",
      });

      env = await firstValueFrom(sut.environment$);

      expect(env.getRegion()).toBe(Region.SelfHosted);
      expect(env.getUrls()).toEqual({
        base: "https://base.example.com",
        api: "https://api.example.com",
        identity: "https://identity.example.com",
        webVault: "https://vault.example.com",
        icons: "https://icons.example.com",
        notifications: "https://notifications.example.com",
        scim: null,
        events: null,
        keyConnector: null,
      });
      expect(env.getScimUrl()).toBe("https://vault.example.com/scim/v2");
    });

    it("sets the region", async () => {
      await sut.setEnvironment(Region.US);

      const data = await firstValueFrom(sut.environment$);

      expect(data.getRegion()).toBe(Region.US);
    });
  });

  describe("getEnvironment$", () => {
    it.each([
      { region: Region.US, expectedHost: "bitwarden.com" },
      { region: Region.EU, expectedHost: "bitwarden.eu" },
    ])("gets it from the passed in userId: %s", async ({ region, expectedHost }) => {
      setUserData(Region.US, new EnvironmentUrls());
      setUserData(region, new EnvironmentUrls(), alternateTestUser);

      await switchUser(testUser);

      const env = await firstValueFrom(sut.getEnvironment$(alternateTestUser));
      expect(env?.getHostname()).toBe(expectedHost);
    });

    it("gets env from saved self host config from passed in user when there is a different active user", async () => {
      setUserData(Region.EU, new EnvironmentUrls());

      const selfHostUserUrls = new EnvironmentUrls();
      selfHostUserUrls.base = "https://base.example.com";
      setUserData(Region.SelfHosted, selfHostUserUrls, alternateTestUser);

      await switchUser(testUser);

      const env = await firstValueFrom(sut.getEnvironment$(alternateTestUser));
      expect(env?.getHostname()).toBe("base.example.com");
    });
  });

  describe("getEnvironment (deprecated)", () => {
    it("gets self hosted env from active user when no user passed in", async () => {
      const selfHostUserUrls = new EnvironmentUrls();
      selfHostUserUrls.base = "https://base.example.com";
      setUserData(Region.SelfHosted, selfHostUserUrls);

      await switchUser(testUser);

      const env = await sut.getEnvironment();
      expect(env?.getHostname()).toBe("base.example.com");
    });

    it("gets self hosted env from passed in user", async () => {
      const selfHostUserUrls = new EnvironmentUrls();
      selfHostUserUrls.base = "https://base.example.com";
      setUserData(Region.SelfHosted, selfHostUserUrls);

      await switchUser(testUser);

      const env = await sut.getEnvironment(testUser);
      expect(env?.getHostname()).toBe("base.example.com");
    });
  });

  describe("cloudWebVaultUrl$", () => {
    it("no extra initialization, returns US vault", async () => {
      expect(await firstValueFrom(sut.cloudWebVaultUrl$)).toBe("https://vault.bitwarden.com");
    });

    it.each([
      { region: Region.US, expectedVault: "https://vault.bitwarden.com" },
      { region: Region.EU, expectedVault: "https://vault.bitwarden.eu" },
      { region: Region.SelfHosted, expectedVault: "https://vault.bitwarden.com" },
    ])(
      "no extra initialization, returns expected host for each region %s",
      async ({ region, expectedVault }) => {
        await switchUser(testUser);

        expect(await sut.setCloudRegion(testUser, region as CloudRegion));
        expect(await firstValueFrom(sut.cloudWebVaultUrl$)).toBe(expectedVault);
      },
    );
  });
});
