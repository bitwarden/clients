import { mock } from "jest-mock-extended";
import { firstValueFrom, timeout } from "rxjs";

import { awaitAsync } from "../../../spec";
import { FakeAccountService, mockAccountServiceWith } from "../../../spec/fake-account-service";
import { FakeStorageService } from "../../../spec/fake-storage.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { EnvironmentUrls } from "../../auth/models/domain/environment-urls";
import { UserId } from "../../types/guid";
import { Region } from "../abstractions/environment.service";
import { StateProvider } from "../state";
/* eslint-disable import/no-restricted-paths -- Rare testing need */
import { DefaultActiveUserStateProvider } from "../state/implementations/default-active-user-state.provider";
import { DefaultDerivedStateProvider } from "../state/implementations/default-derived-state.provider";
import { DefaultGlobalStateProvider } from "../state/implementations/default-global-state.provider";
import { DefaultSingleUserStateProvider } from "../state/implementations/default-single-user-state.provider";
import { DefaultStateProvider } from "../state/implementations/default-state.provider";
import { StateEventRegistrarService } from "../state/state-event-registrar.service";
/* eslint-enable import/no-restricted-paths */

import { EnvironmentService } from "./environment.service";
import { StorageServiceProvider } from "./storage-service.provider";

// There are a few main states EnvironmentService could be in when first used
// 1. Not initialized, no active user. Hopefully not to likely but possible
// 2. Not initialized, with active user. Not likely
// 3. Initialized, no active user.
// 4. Initialized, with active user.
describe("EnvironmentService", () => {
  let diskStorageService: FakeStorageService;
  let memoryStorageService: FakeStorageService;
  let storageServiceProvider: StorageServiceProvider;
  const stateEventRegistrarService = mock<StateEventRegistrarService>();
  let accountService: FakeAccountService;
  let stateProvider: StateProvider;

  let sut: EnvironmentService;

  const testUser = "00000000-0000-1000-a000-000000000001" as UserId;
  const alternateTestUser = "00000000-0000-1000-a000-000000000002" as UserId;

  beforeEach(async () => {
    diskStorageService = new FakeStorageService();
    memoryStorageService = new FakeStorageService();
    storageServiceProvider = new StorageServiceProvider(diskStorageService, memoryStorageService);

    accountService = mockAccountServiceWith(undefined);
    const singleUserStateProvider = new DefaultSingleUserStateProvider(
      storageServiceProvider,
      stateEventRegistrarService,
    );
    stateProvider = new DefaultStateProvider(
      new DefaultActiveUserStateProvider(accountService, singleUserStateProvider),
      singleUserStateProvider,
      new DefaultGlobalStateProvider(storageServiceProvider),
      new DefaultDerivedStateProvider(memoryStorageService),
    );

    sut = new EnvironmentService(stateProvider, accountService);
  });

  const switchUser = async (userId: UserId) => {
    accountService.activeAccountSubject.next({
      id: userId,
      email: "test@example.com",
      name: `Test Name ${userId}`,
      status: AuthenticationStatus.Unlocked,
    });
    await awaitAsync();
  };

  const setGlobalData = (region: Region, environmentUrls: EnvironmentUrls) => {
    const data = diskStorageService.internalStore;
    data["global_environment_region"] = region;
    data["global_environment_urls"] = environmentUrls;
    diskStorageService.internalUpdateStore(data);
  };

  const getGlobalData = () => {
    const storage = diskStorageService.internalStore;
    return {
      region: storage?.["global_environment_region"],
      urls: storage?.["global_environment_urls"],
    };
  };

  const setUserData = (
    region: Region,
    environmentUrls: EnvironmentUrls,
    userId: UserId = testUser,
  ) => {
    const data = diskStorageService.internalStore;
    data[`user_${userId}_environment_region`] = region;
    data[`user_${userId}_environment_urls`] = environmentUrls;

    diskStorageService.internalUpdateStore(data);
  };
  // END: CAN CHANGE

  const initialize = async (options: { switchUser: boolean }) => {
    await sut.setUrlsFromStorage();
    sut.initialized = true;

    if (options.switchUser) {
      await switchUser(testUser);
    }
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

        await initialize({ switchUser: true });

        expect(sut.hasBaseUrl()).toBe(false);
        expect(sut.getWebVaultUrl()).toBe(expectedUrls.webVault);
        expect(sut.getIdentityUrl()).toBe(expectedUrls.identity);
        expect(sut.getApiUrl()).toBe(expectedUrls.api);
        expect(sut.getIconsUrl()).toBe(expectedUrls.icons);
        expect(sut.getNotificationsUrl()).toBe(expectedUrls.notifications);
        expect(sut.getEventsUrl()).toBe(expectedUrls.events);
        expect(sut.getScimUrl()).toBe(expectedUrls.scim);
        expect(sut.getSendUrl()).toBe(expectedUrls.send);
        expect(sut.getKeyConnectorUrl()).toBe(null);
        expect(sut.isCloud()).toBe(true);
        expect(sut.getUrls()).toEqual({
          base: null,
          cloudWebVault: undefined,
          webVault: expectedUrls.webVault,
          identity: expectedUrls.identity,
          api: expectedUrls.api,
          icons: expectedUrls.icons,
          notifications: expectedUrls.notifications,
          events: expectedUrls.events,
          scim: expectedUrls.scim.replace("/v2", ""),
          keyConnector: null,
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

      await initialize({ switchUser: true });

      expect(sut.getWebVaultUrl()).toBe("https://user-url.example.com");
      expect(sut.getIdentityUrl()).toBe("https://user-url.example.com/identity");
      expect(sut.getApiUrl()).toBe("https://user-url.example.com/api");
      expect(sut.getIconsUrl()).toBe("https://user-url.example.com/icons");
      expect(sut.getNotificationsUrl()).toBe("https://user-url.example.com/notifications");
      expect(sut.getEventsUrl()).toBe("https://user-url.example.com/events");
      expect(sut.getScimUrl()).toBe("https://user-url.example.com/scim/v2");
      expect(sut.getSendUrl()).toBe("https://user-url.example.com/#/send/");
      expect(sut.isCloud()).toBe(false);
      expect(sut.getUrls()).toEqual({
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

      await initialize({ switchUser: false });

      expect(sut.hasBaseUrl()).toBe(false);
      expect(sut.getWebVaultUrl()).toBe(expectedUrls.webVault);
      expect(sut.getIdentityUrl()).toBe(expectedUrls.identity);
      expect(sut.getApiUrl()).toBe(expectedUrls.api);
      expect(sut.getIconsUrl()).toBe(expectedUrls.icons);
      expect(sut.getNotificationsUrl()).toBe(expectedUrls.notifications);
      expect(sut.getEventsUrl()).toBe(expectedUrls.events);
      expect(sut.getScimUrl()).toBe(expectedUrls.scim);
      expect(sut.getSendUrl()).toBe(expectedUrls.send);
      expect(sut.getKeyConnectorUrl()).toBe(null);
      expect(sut.isCloud()).toBe(true);
      expect(sut.getUrls()).toEqual({
        base: null,
        cloudWebVault: undefined,
        webVault: expectedUrls.webVault,
        identity: expectedUrls.identity,
        api: expectedUrls.api,
        icons: expectedUrls.icons,
        notifications: expectedUrls.notifications,
        events: expectedUrls.events,
        scim: expectedUrls.scim.replace("/v2", ""),
        keyConnector: null,
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

      await initialize({ switchUser: false });

      expect(sut.getWebVaultUrl()).toBe("https://global-url.example.com");
      expect(sut.getIdentityUrl()).toBe("https://global-url.example.com/identity");
      expect(sut.getApiUrl()).toBe("https://global-url.example.com/api");
      expect(sut.getIconsUrl()).toBe("https://global-url.example.com/icons");
      expect(sut.getNotificationsUrl()).toBe("https://global-url.example.com/notifications");
      expect(sut.getEventsUrl()).toBe("https://global-url.example.com/events");
      expect(sut.getScimUrl()).toBe("https://global-url.example.com/scim/v2");
      expect(sut.getSendUrl()).toBe("https://global-url.example.com/#/send/");
      expect(sut.getKeyConnectorUrl()).toBe("https://global-key-connector.example.com");
      expect(sut.isCloud()).toBe(false);
      expect(sut.getUrls()).toEqual({
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

  it("returns US defaults when not initialized", async () => {
    setGlobalData(Region.EU, new EnvironmentUrls());
    setUserData(Region.EU, new EnvironmentUrls());

    expect(sut.initialized).toBe(false);

    expect(sut.hasBaseUrl()).toBe(false);
    expect(sut.getWebVaultUrl()).toBe("https://vault.bitwarden.com");
    expect(sut.getIdentityUrl()).toBe("https://identity.bitwarden.com");
    expect(sut.getApiUrl()).toBe("https://api.bitwarden.com");
    expect(sut.getIconsUrl()).toBe("https://icons.bitwarden.net");
    expect(sut.getNotificationsUrl()).toBe("https://notifications.bitwarden.com");
    expect(sut.getEventsUrl()).toBe("https://events.bitwarden.com");
    expect(sut.getScimUrl()).toBe("https://scim.bitwarden.com/v2");
    expect(sut.getKeyConnectorUrl()).toBe(undefined);
    expect(sut.isCloud()).toBe(true);
  });

  describe("setUrls", () => {
    it("set just a base url", async () => {
      await initialize({ switchUser: true });

      await sut.setUrls({
        base: "base.example.com",
      });

      const globalData = getGlobalData();
      expect(globalData.region).toBe(Region.SelfHosted);
      expect(globalData.urls).toEqual({
        base: "https://base.example.com",
        api: null,
        identity: null,
        webVault: null,
        icons: null,
        notifications: null,
        events: null,
        keyConnector: null,
      });
    });

    it("sets all urls", async () => {
      await initialize({ switchUser: true });

      expect(sut.getScimUrl()).toBe("https://scim.bitwarden.com/v2");

      await sut.setUrls({
        base: "base.example.com",
        api: "api.example.com",
        identity: "identity.example.com",
        webVault: "vault.example.com",
        icons: "icons.example.com",
        notifications: "notifications.example.com",
        scim: "scim.example.com",
      });

      const globalData = getGlobalData();
      expect(globalData.region).toBe(Region.SelfHosted);
      expect(globalData.urls).toEqual({
        base: "https://base.example.com",
        api: "https://api.example.com",
        identity: "https://identity.example.com",
        webVault: "https://vault.example.com",
        icons: "https://icons.example.com",
        notifications: "https://notifications.example.com",
        events: null,
        keyConnector: null,
      });
      expect(sut.getScimUrl()).toBe("https://scim.example.com/v2");
    });
  });

  describe("setRegion", () => {
    it("sets the region on the global object even if there is a user.", async () => {
      setGlobalData(Region.EU, new EnvironmentUrls());
      setUserData(Region.EU, new EnvironmentUrls());

      await initialize({ switchUser: true });

      await sut.setRegion(Region.US);

      const globalData = getGlobalData();
      expect(globalData.region).toBe(Region.US);
    });
  });

  describe("getHost", () => {
    it.each([
      { region: Region.US, expectedHost: "bitwarden.com" },
      { region: Region.EU, expectedHost: "bitwarden.eu" },
    ])("gets it from user data if there is an active user", async ({ region, expectedHost }) => {
      setGlobalData(Region.US, new EnvironmentUrls());
      setUserData(region, new EnvironmentUrls());

      await initialize({ switchUser: true });

      const host = await sut.getHost();
      expect(host).toBe(expectedHost);
    });

    it.each([
      { region: Region.US, expectedHost: "bitwarden.com" },
      { region: Region.EU, expectedHost: "bitwarden.eu" },
    ])("gets it from global data if there is no active user", async ({ region, expectedHost }) => {
      setGlobalData(region, new EnvironmentUrls());
      setUserData(Region.US, new EnvironmentUrls());

      await initialize({ switchUser: false });

      const host = await sut.getHost();
      expect(host).toBe(expectedHost);
    });

    it.each([
      { region: Region.US, expectedHost: "bitwarden.com" },
      { region: Region.EU, expectedHost: "bitwarden.eu" },
    ])(
      "gets it from global state if there is no active user even if a user id is passed in.",
      async ({ region, expectedHost }) => {
        setGlobalData(region, new EnvironmentUrls());
        setUserData(Region.US, new EnvironmentUrls());

        await initialize({ switchUser: false });

        const host = await sut.getHost(testUser);
        expect(host).toBe(expectedHost);
      },
    );

    it.each([
      { region: Region.US, expectedHost: "bitwarden.com" },
      { region: Region.EU, expectedHost: "bitwarden.eu" },
    ])(
      "gets it from the passed in userId if there is any active user: %s",
      async ({ region, expectedHost }) => {
        setGlobalData(Region.US, new EnvironmentUrls());
        setUserData(Region.US, new EnvironmentUrls());
        setUserData(region, new EnvironmentUrls(), alternateTestUser);

        await initialize({ switchUser: true });

        const host = await sut.getHost(alternateTestUser);
        expect(host).toBe(expectedHost);
      },
    );

    it("gets it from base url saved in self host config", async () => {
      const globalSelfHostUrls = new EnvironmentUrls();
      globalSelfHostUrls.base = "https://base.example.com";
      setGlobalData(Region.SelfHosted, globalSelfHostUrls);
      setUserData(Region.EU, new EnvironmentUrls());

      await initialize({ switchUser: false });

      const host = await sut.getHost();
      expect(host).toBe("base.example.com");
    });

    it("gets it from webVault url saved in self host config", async () => {
      const globalSelfHostUrls = new EnvironmentUrls();
      globalSelfHostUrls.webVault = "https://vault.example.com";
      globalSelfHostUrls.base = "https://base.example.com";
      setGlobalData(Region.SelfHosted, globalSelfHostUrls);
      setUserData(Region.EU, new EnvironmentUrls());

      await initialize({ switchUser: false });

      const host = await sut.getHost();
      expect(host).toBe("vault.example.com");
    });

    it("gets it from saved self host config from passed in user when there is an active user", async () => {
      setGlobalData(Region.US, new EnvironmentUrls());
      setUserData(Region.EU, new EnvironmentUrls());

      const selfHostUserUrls = new EnvironmentUrls();
      selfHostUserUrls.base = "https://base.example.com";
      setUserData(Region.SelfHosted, selfHostUserUrls, alternateTestUser);

      await initialize({ switchUser: true });

      const host = await sut.getHost(alternateTestUser);
      expect(host).toBe("base.example.com");
    });
  });

  describe("setUrlsFromStorage", () => {
    it("will set the global data to Region US if no existing data", async () => {
      await sut.setUrlsFromStorage();

      expect(sut.getWebVaultUrl()).toBe("https://vault.bitwarden.com");

      const globalData = getGlobalData();
      expect(globalData.region).toBe(Region.US);
    });

    it("will set the urls to whatever is in global", async () => {
      setGlobalData(Region.EU, new EnvironmentUrls());

      await sut.setUrlsFromStorage();

      expect(sut.getWebVaultUrl()).toBe("https://vault.bitwarden.eu");
    });

    it("recovers from previous bug", async () => {
      const buggedEnvironmentUrls = new EnvironmentUrls();
      buggedEnvironmentUrls.base = "https://vault.bitwarden.com";
      buggedEnvironmentUrls.notifications = null;
      setGlobalData(null, buggedEnvironmentUrls);

      const urlEmission = firstValueFrom(sut.urls.pipe(timeout(100)));

      await sut.setUrlsFromStorage();

      await urlEmission;

      const globalData = getGlobalData();
      expect(globalData.region).toBe(Region.US);
      expect(globalData.urls).toEqual({
        base: null,
        api: null,
        identity: null,
        events: null,
        icons: null,
        notifications: null,
        keyConnector: null,
        webVault: null,
      });
    });

    it("will get urls from signed in user", async () => {
      await switchUser(testUser);

      const userUrls = new EnvironmentUrls();
      userUrls.base = "base.example.com";
      setUserData(Region.SelfHosted, userUrls);

      await sut.setUrlsFromStorage();

      expect(sut.getWebVaultUrl()).toBe("base.example.com");
    });
  });

  describe("getCloudWebVaultUrl", () => {
    it("no extra initialization, returns US vault", () => {
      expect(sut.getCloudWebVaultUrl()).toBe("https://vault.bitwarden.com");
    });

    it.each([
      { region: Region.US, expectedVault: "https://vault.bitwarden.com" },
      { region: Region.EU, expectedVault: "https://vault.bitwarden.eu" },
      { region: Region.SelfHosted, expectedVault: "https://vault.bitwarden.com" },
    ])(
      "no extra initialization, returns expected host for each region %s",
      ({ region, expectedVault }) => {
        expect(sut.setCloudWebVaultUrl(region));
        expect(sut.getCloudWebVaultUrl()).toBe(expectedVault);
      },
    );
  });
});
