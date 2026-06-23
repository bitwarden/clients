import { firstValueFrom } from "rxjs";

import { FakeStateProvider, awaitAsync, mockAccountInfoWith } from "../../../spec";
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
      [testUser]: mockAccountInfoWith({
        name: "name",
        email: "email",
      }),
      [alternateTestUser]: mockAccountInfoWith({
        name: "name",
        email: "email",
      }),
    });
    stateProvider = new FakeStateProvider(accountService);

    sut = new DefaultEnvironmentService(stateProvider, accountService);
  });

  const switchUser = async (userId: UserId) => {
    accountService.activeAccountSubject.next({
      id: userId,
      ...mockAccountInfoWith({
        email: "test@example.com",
        name: `Test Name ${userId}`,
      }),
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
        send: "https://send.bitwarden.com",
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
        send: "https://send.bitwarden.eu",
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
        expect(env.getSendUrl()).toBe(expectedUrls.send + "/#/");
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
          send: expectedUrls.send,
        });
      },
    );

    describe("strict source-of-truth invariants", () => {
      // Invariant 1: while a user is logged in (activeAccount$ has an id), environment$ MUST
      // emit only from USER_ENVIRONMENT_KEY for that user. Global state must never be served.
      //
      // Invariant 2: while no user is logged in (activeAccount$ is null), environment$ MUST
      // emit only from GLOBAL_ENVIRONMENT_KEY. A previously-active user's environment must
      // never leak across the logout boundary.

      it("does not serve global environment while a user is logged in", async () => {
        // user state = EU, global state = US. While logged in, must serve EU regardless of global.
        setGlobalData(Region.US, new EnvironmentUrls());
        setUserData(Region.EU, new EnvironmentUrls());
        await switchUser(testUser);

        const env = await firstValueFrom(sut.environment$);
        expect(env.getRegion()).toBe(Region.EU);
      });

      it("ignores changes to global state while a user is logged in", async () => {
        setGlobalData(Region.US, new EnvironmentUrls());
        setUserData(Region.EU, new EnvironmentUrls());
        await switchUser(testUser);

        // While logged in, mutate global to SelfHosted. environment$ must NOT emit SelfHosted.
        const selfHostedUrls = new EnvironmentUrls();
        selfHostedUrls.base = "https://self-hosted.example.com";
        setGlobalData(Region.SelfHosted, selfHostedUrls);
        await awaitAsync();

        const env = await firstValueFrom(sut.environment$);
        expect(env.getRegion()).toBe(Region.EU);
      });

      it("holds the last user environment when user state is cleared mid-logout", async () => {
        // Distinguishes the new behavior from the old "fall back to global" behavior:
        // setting global to US and user to EU, then clearing user state — old code would
        // emit US (global fallback); new code holds EU (last buffered user value).
        setGlobalData(Region.US, new EnvironmentUrls());
        setUserData(Region.EU, new EnvironmentUrls());
        await switchUser(testUser);

        const before = await firstValueFrom(sut.environment$);
        expect(before.getRegion()).toBe(Region.EU);

        // USER_ENVIRONMENT_KEY is asynchronously cleared by the logout event handler,
        // but activeAccount$ has not yet transitioned to null.
        stateProvider.singleUser.getFake(testUser, USER_ENVIRONMENT_KEY).nextState(null);
        await awaitAsync();

        // Strict invariant: still logged in, so global must not be served. Last user value
        // (EU) is held by shareReplay; the null state is filtered out before mapping.
        const after = await firstValueFrom(sut.environment$);
        expect(after.getRegion()).toBe(Region.EU);
      });

      it("does not leak a prior user's environment after logout", async () => {
        // User logged in with EU, global is US. After logout, environment$ must emit US.
        setGlobalData(Region.US, new EnvironmentUrls());
        setUserData(Region.EU, new EnvironmentUrls());
        await switchUser(testUser);

        const loggedIn = await firstValueFrom(sut.environment$);
        expect(loggedIn.getRegion()).toBe(Region.EU);

        // Logout: activeAccount$ → null. (clearOn handles user state on its own track.)
        accountService.activeAccountSubject.next(null);
        await awaitAsync();

        const loggedOut = await firstValueFrom(sut.environment$);
        expect(loggedOut.getRegion()).toBe(Region.US);
      });

      it("does not leak a prior user's environment after logout even if user state survives", async () => {
        // Defense in depth: even if USER_ENVIRONMENT_KEY were NOT cleared by clearOn (e.g.,
        // race where activeAccount$ → null arrives first), environment$ must still read
        // from global once activeAccount$ is null.
        setGlobalData(Region.US, new EnvironmentUrls());
        setUserData(Region.EU, new EnvironmentUrls());
        await switchUser(testUser);

        accountService.activeAccountSubject.next(null);
        // Intentionally do NOT clear USER_ENVIRONMENT_KEY here.
        await awaitAsync();

        const env = await firstValueFrom(sut.environment$);
        expect(env.getRegion()).toBe(Region.US);
      });

      it("serves the buffered user environment to a late subscriber mid-logout", async () => {
        // Reproduces the PM-39218 self-hosted dialog pattern: take(1) + filter for SelfHosted.
        // The dialog subscribes after a logout-clear has fired but before activeAccount$ → null.
        // Without shareReplay, take(1) could capture a null/default emission; with shareReplay,
        // the late subscriber receives the last buffered user value immediately.
        const userUrls = new EnvironmentUrls();
        userUrls.base = "https://self-hosted.example.com";
        setGlobalData(Region.US, new EnvironmentUrls());
        setUserData(Region.SelfHosted, userUrls);
        await switchUser(testUser);

        // Prime shareReplay by ensuring environment$ has emitted at least once.
        const primed = await firstValueFrom(sut.environment$);
        expect(primed.getRegion()).toBe(Region.SelfHosted);

        // Logout-clear arrives but activeAccount$ has not yet transitioned.
        stateProvider.singleUser.getFake(testUser, USER_ENVIRONMENT_KEY).nextState(null);
        await awaitAsync();

        // Late subscriber simulating the self-hosted dialog ngOnInit pattern.
        const env = await firstValueFrom(sut.environment$);
        expect(env.getRegion()).toBe(Region.SelfHosted);
      });

      it("switches cleanly between users without emitting global in between", async () => {
        // User A: EU, User B: US, Global: SelfHosted. Switching A → B must never expose
        // the global SelfHosted value to a downstream subscriber.
        const globalUrls = new EnvironmentUrls();
        globalUrls.base = "https://self-hosted.example.com";
        setGlobalData(Region.SelfHosted, globalUrls);
        setUserData(Region.EU, new EnvironmentUrls(), testUser);
        setUserData(Region.US, new EnvironmentUrls(), alternateTestUser);

        await switchUser(testUser);
        const a = await firstValueFrom(sut.environment$);
        expect(a.getRegion()).toBe(Region.EU);

        await switchUser(alternateTestUser);
        const b = await firstValueFrom(sut.environment$);
        expect(b.getRegion()).toBe(Region.US);
      });

      it("ignores user state changes after logout", async () => {
        setGlobalData(Region.US, new EnvironmentUrls());
        setUserData(Region.EU, new EnvironmentUrls());
        await switchUser(testUser);

        accountService.activeAccountSubject.next(null);
        await awaitAsync();

        const loggedOut = await firstValueFrom(sut.environment$);
        expect(loggedOut.getRegion()).toBe(Region.US);

        // Some background process resurrects user state. environment$ must not pick it up.
        setUserData(Region.EU, new EnvironmentUrls());
        await awaitAsync();

        const stillLoggedOut = await firstValueFrom(sut.environment$);
        expect(stillLoggedOut.getRegion()).toBe(Region.US);
      });

      it("emits the new user environment on login, not the prior global", async () => {
        // Pre-auth global is US. User has SelfHosted in their user state.
        // On login, environment$ must transition from global US to user SelfHosted —
        // it must not stay on global.
        const userUrls = new EnvironmentUrls();
        userUrls.base = "https://self-hosted.example.com";
        setGlobalData(Region.US, new EnvironmentUrls());
        setUserData(Region.SelfHosted, userUrls);

        const preLogin = await firstValueFrom(sut.environment$);
        expect(preLogin.getRegion()).toBe(Region.US);

        await switchUser(testUser);

        const postLogin = await firstValueFrom(sut.environment$);
        expect(postLogin.getRegion()).toBe(Region.SelfHosted);
      });
    });

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
        send: null,
      });
    });

    it("getSendUrl falls back to webVault when only webVault is configured (regression)", async () => {
      // Regression: self-hosted user sets only webVault (no base, no send).
      // getSendUrl() must use the self-hosted webVault, not the Bitwarden cloud send URL.
      const userEnvironmentUrls = new EnvironmentUrls();
      userEnvironmentUrls.webVault = "https://vault.myserver.com";
      setUserData(Region.SelfHosted, userEnvironmentUrls);

      await switchUser(testUser);

      const env = await firstValueFrom(sut.environment$);

      expect(env.getWebVaultUrl()).toBe("https://vault.myserver.com");
      // Must NOT return "https://send.bitwarden.com/#/" (cloud fallback)
      expect(env.getSendUrl()).toBe("https://vault.myserver.com/#/send/");
    });

    it("getScimUrl falls back to webVault when only webVault is configured (regression)", async () => {
      // Regression: self-hosted user sets only webVault (no base, no scim).
      // getScimUrl() must use the self-hosted webVault, not the Bitwarden cloud scim URL.
      const userEnvironmentUrls = new EnvironmentUrls();
      userEnvironmentUrls.webVault = "https://vault.myserver.com";
      setUserData(Region.SelfHosted, userEnvironmentUrls);

      await switchUser(testUser);

      const env = await firstValueFrom(sut.environment$);

      expect(env.getWebVaultUrl()).toBe("https://vault.myserver.com");
      // Must NOT return "https://scim.bitwarden.com/v2" (cloud fallback)
      expect(env.getScimUrl()).toBe("https://vault.myserver.com/scim/v2");
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
      expect(env.getSendUrl()).toBe(expectedUrls.send + "/#/");
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
        send: expectedUrls.send,
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
        send: null,
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
        send: null,
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
        send: null,
      });
      expect(env.getScimUrl()).toBe("https://vault.example.com/scim/v2");
    });

    it("sets the region", async () => {
      await sut.setEnvironment(Region.US);

      const data = await firstValueFrom(sut.environment$);

      expect(data.getRegion()).toBe(Region.US);
    });

    it("normalizes a blank send url to null", async () => {
      await sut.setEnvironment(Region.SelfHosted, {
        base: "base.example.com",
        send: "", // empty string from the dialog — should be normalized to null
      });
      await awaitAsync();

      const env = await firstValueFrom(sut.environment$);

      // A blank send URL should fall back through base, not persist as "" causing getSendUrl() to return "/#/"
      expect(env.getSendUrl()).toBe("https://base.example.com/#/send/");
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
