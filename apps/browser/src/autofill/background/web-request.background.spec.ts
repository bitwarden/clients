import { mock } from "jest-mock-extended";
import { BehaviorSubject, defer, NEVER, of, Subject } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { devFlagEnabled } from "@bitwarden/common/platform/misc/flags";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { CipherUse } from "../services/abstractions/fill-cipher-policy";
import { DefaultFillCipherPolicy } from "../services/default-fill-cipher-policy";
import { flushPromises } from "../spec/testing-utils";

import WebRequestBackground, {
  getInitiatorOrigin,
  shouldAnswerAuthChallenge,
} from "./web-request.background";

jest.mock("@bitwarden/common/platform/misc/flags", () => ({
  ...jest.requireActual("@bitwarden/common/platform/misc/flags"),
  devFlagEnabled: jest.fn(),
}));

const mockDevFlagEnabled = devFlagEnabled as jest.Mock;

type WebRequestEventMock = {
  addListener: jest.Mock;
  removeListener: jest.Mock;
};

const createWebRequestEventMock = (): WebRequestEventMock => ({
  addListener: jest.fn(),
  removeListener: jest.fn(),
});

describe("WebRequestBackground", () => {
  const userId = "test-user-id" as UserId;
  const account: Account = { id: userId, ...mockAccountInfoWith() };

  let platformUtilsService: ReturnType<typeof mock<PlatformUtilsService>>;
  let cipherService: ReturnType<typeof mock<CipherService>>;
  let fillCipherPolicy: DefaultFillCipherPolicy;
  let authService: ReturnType<typeof mock<AuthService>>;
  let accountService: ReturnType<typeof mock<AccountService>>;
  let autofillSettingsService: ReturnType<typeof mock<AutofillSettingsServiceAbstraction>>;
  let eventCollectionService: ReturnType<typeof mock<EventCollectionService>>;
  let logService: ReturnType<typeof mock<LogService>>;
  let activeAccount$: BehaviorSubject<Account | null>;
  let httpAuthenticationAvailable$: BehaviorSubject<boolean>;
  let globalSetting$: BehaviorSubject<boolean>;
  let webRequest: {
    onAuthRequired: WebRequestEventMock;
    onCompleted: WebRequestEventMock;
    onErrorOccurred: WebRequestEventMock;
  };
  let webRequestBackground: WebRequestBackground;

  const createWebRequestBackground = () =>
    new WebRequestBackground(
      platformUtilsService,
      fillCipherPolicy,
      authService,
      accountService,
      webRequest as unknown as typeof chrome.webRequest,
      autofillSettingsService,
      eventCollectionService,
      logService,
    );

  const expectListenersRegistered = (timesRegistered: number) => {
    expect(webRequest.onAuthRequired.addListener).toHaveBeenCalledTimes(timesRegistered);
    expect(webRequest.onCompleted.addListener).toHaveBeenCalledTimes(timesRegistered);
    expect(webRequest.onErrorOccurred.addListener).toHaveBeenCalledTimes(timesRegistered);
  };

  const expectListenersUnregistered = (timesUnregistered: number) => {
    expect(webRequest.onAuthRequired.removeListener).toHaveBeenCalledTimes(timesUnregistered);
    expect(webRequest.onCompleted.removeListener).toHaveBeenCalledTimes(timesUnregistered);
    expect(webRequest.onErrorOccurred.removeListener).toHaveBeenCalledTimes(timesUnregistered);
  };

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.isFirefox.mockReturnValue(false);
    platformUtilsService.isSafari.mockReturnValue(false);
    cipherService = mock<CipherService>();
    fillCipherPolicy = new DefaultFillCipherPolicy(cipherService);
    jest.spyOn(fillCipherPolicy, "ciphersForUrl");
    authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));

    activeAccount$ = new BehaviorSubject<Account | null>(account);
    accountService = mock<AccountService>();
    accountService.activeAccount$ = activeAccount$;

    // By default only the login-level setting applies: the global setting is off and the
    // login-level controls are shown.
    mockDevFlagEnabled.mockImplementation(
      (flag: string) => flag === "httpAuthenticationCipherControls",
    );
    httpAuthenticationAvailable$ = new BehaviorSubject<boolean>(true);
    globalSetting$ = new BehaviorSubject<boolean>(false);
    autofillSettingsService = mock<AutofillSettingsServiceAbstraction>();
    autofillSettingsService.httpAuthenticationAvailable$ = httpAuthenticationAvailable$;
    autofillSettingsService.resolvedEnableBasicAuthResponse$ = globalSetting$;

    eventCollectionService = mock<EventCollectionService>();
    eventCollectionService.collect.mockResolvedValue(undefined);
    logService = mock<LogService>();

    webRequest = {
      onAuthRequired: createWebRequestEventMock(),
      onCompleted: createWebRequestEventMock(),
      onErrorOccurred: createWebRequestEventMock(),
    };

    webRequestBackground = createWebRequestBackground();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("startListening", () => {
    it("registers listeners when HTTP authentication is available", () => {
      webRequestBackground.startListening();

      expectListenersRegistered(1);
      expect(webRequest.onAuthRequired.addListener).toHaveBeenCalledWith(
        expect.any(Function),
        { urls: ["http://*/*", "https://*/*"] },
        ["asyncBlocking"],
      );
    });

    it("registers the auth listener as blocking on Firefox", () => {
      platformUtilsService.isFirefox.mockReturnValue(true);
      webRequestBackground = createWebRequestBackground();

      webRequestBackground.startListening();

      expect(webRequest.onAuthRequired.addListener).toHaveBeenCalledWith(
        expect.any(Function),
        { urls: ["http://*/*", "https://*/*"] },
        ["blocking"],
      );
    });

    it("does not register listeners or resolve availability on Safari", () => {
      let availabilitySubscribed = false;
      autofillSettingsService.httpAuthenticationAvailable$ = defer(() => {
        availabilitySubscribed = true;
        return of(true);
      });
      platformUtilsService.isSafari.mockReturnValue(true);
      webRequestBackground = createWebRequestBackground();

      webRequestBackground.startListening();

      expectListenersRegistered(0);
      expect(availabilitySubscribed).toBe(false);
    });

    it("does not register listeners when HTTP authentication is unavailable", () => {
      httpAuthenticationAvailable$.next(false);

      webRequestBackground.startListening();

      expectListenersRegistered(0);
    });

    it("does not register listeners when there is no active user", () => {
      activeAccount$.next(null);

      webRequestBackground.startListening();

      expectListenersRegistered(0);
    });

    it("does not register listeners when resolving availability errors", () => {
      const erroringAvailability$ = new Subject<boolean>();
      autofillSettingsService.httpAuthenticationAvailable$ = erroringAvailability$;

      webRequestBackground.startListening();
      erroringAvailability$.error(new Error("config unavailable"));

      expectListenersRegistered(0);
    });

    it("keeps reacting to account changes after resolving availability errors", () => {
      const erroringAvailability$ = new Subject<boolean>();
      autofillSettingsService.httpAuthenticationAvailable$ = erroringAvailability$;

      webRequestBackground.startListening();
      erroringAvailability$.error(new Error("config unavailable"));
      autofillSettingsService.httpAuthenticationAvailable$ = httpAuthenticationAvailable$;
      activeAccount$.next({ ...account });

      expectListenersRegistered(1);
    });

    it("removes the same listeners it registered when HTTP authentication is unavailable", () => {
      webRequestBackground.startListening();

      httpAuthenticationAvailable$.next(false);

      expectListenersUnregistered(1);
      expect(webRequest.onAuthRequired.removeListener).toHaveBeenCalledWith(
        webRequest.onAuthRequired.addListener.mock.calls[0][0],
      );
      expect(webRequest.onCompleted.removeListener).toHaveBeenCalledWith(
        webRequest.onCompleted.addListener.mock.calls[0][0],
      );
      expect(webRequest.onErrorOccurred.removeListener).toHaveBeenCalledWith(
        webRequest.onErrorOccurred.addListener.mock.calls[0][0],
      );
    });

    it("removes listeners when the active user changes to one without HTTP authentication available", () => {
      const otherUserId = "other-user-id" as UserId;
      webRequestBackground.startListening();

      autofillSettingsService.httpAuthenticationAvailable$ = of(false);
      activeAccount$.next({ id: otherUserId, ...mockAccountInfoWith() });

      expectListenersUnregistered(1);
    });

    it("removes listeners when the active user logs out", () => {
      webRequestBackground.startListening();

      activeAccount$.next(null);

      expectListenersUnregistered(1);
    });

    it("re-registers listeners when HTTP authentication becomes available again", () => {
      webRequestBackground.startListening();

      httpAuthenticationAvailable$.next(false);
      httpAuthenticationAvailable$.next(true);

      expectListenersRegistered(2);
      expectListenersUnregistered(1);
    });

    it("does not register listeners more than once for repeated available emissions", () => {
      webRequestBackground.startListening();

      httpAuthenticationAvailable$.next(true);
      activeAccount$.next({ ...account });

      expectListenersRegistered(1);
    });

    it("does not remove listeners that were never registered", () => {
      httpAuthenticationAvailable$.next(false);
      webRequestBackground.startListening();

      activeAccount$.next(null);

      expectListenersUnregistered(0);
    });

    it("does not stack subscriptions when called more than once", () => {
      webRequestBackground.startListening();
      webRequestBackground.startListening();

      httpAuthenticationAvailable$.next(false);

      expectListenersRegistered(1);
      expectListenersUnregistered(1);
    });

    describe("with the global setting", () => {
      it("keeps listeners registered while either setting applies", () => {
        globalSetting$.next(true);
        webRequestBackground.startListening();

        httpAuthenticationAvailable$.next(false);
        expectListenersUnregistered(0);

        globalSetting$.next(false);
        expectListenersUnregistered(1);
      });

      it("registers listeners when only the global setting is on", () => {
        httpAuthenticationAvailable$.next(false);
        globalSetting$.next(true);

        webRequestBackground.startListening();

        expectListenersRegistered(1);
      });

      it("registers listeners from the global setting when the login-level controls are hidden", () => {
        mockDevFlagEnabled.mockReturnValue(false);
        globalSetting$.next(true);
        webRequestBackground = createWebRequestBackground();

        webRequestBackground.startListening();

        expectListenersRegistered(1);
      });

      it("does not register listeners or read availability when only the login-level setting would apply and its controls are hidden", () => {
        let availabilitySubscribed = false;
        autofillSettingsService.httpAuthenticationAvailable$ = defer(() => {
          availabilitySubscribed = true;
          return of(true);
        });
        mockDevFlagEnabled.mockReturnValue(false);
        webRequestBackground = createWebRequestBackground();

        webRequestBackground.startListening();

        expectListenersRegistered(0);
        expect(availabilitySubscribed).toBe(false);
      });

      it("does not register listeners when resolving the global setting errors", () => {
        const erroringGlobalSetting$ = new Subject<boolean>();
        autofillSettingsService.resolvedEnableBasicAuthResponse$ = erroringGlobalSetting$;

        webRequestBackground.startListening();
        erroringGlobalSetting$.error(new Error("state unavailable"));

        expectListenersRegistered(0);
      });
    });
  });

  describe("handling auth challenges", () => {
    const url = "https://example.com/protected";
    let callback: jest.Mock;

    const createLoginUri = (uri: string, match: UriMatchStrategySetting) => {
      const loginUri = new LoginUriView();
      loginUri.uri = uri;
      loginUri.match = match;
      return loginUri;
    };

    const createCipher = (
      username: string | null,
      password: string | null,
      id = "cipher-id",
      organizationId: string | null = "organization-id",
      {
        reprompt = CipherRepromptType.None,
        uris = [createLoginUri(url, UriMatchStrategy.Host)],
        httpAuthenticationEnabled = true,
      }: {
        reprompt?: CipherRepromptType;
        uris?: LoginUriView[];
        httpAuthenticationEnabled?: boolean;
      } = {},
    ) => {
      const cipher = new CipherView();
      cipher.id = id;
      cipher.organizationId = organizationId ?? undefined;
      cipher.type = CipherType.Login;
      cipher.reprompt = reprompt;
      cipher.login = new LoginView();
      cipher.login.username = username ?? undefined;
      cipher.login.password = password ?? undefined;
      cipher.login.uris = uris;
      cipher.login.httpAuthenticationEnabled = httpAuthenticationEnabled;
      return cipher;
    };

    /** Resolves the lookup with the given ciphers that match the URL, using each URI's real match rules. */
    const resolveLookupByMatching = (ciphers: CipherView[]) => {
      cipherService.getAllDecryptedForUrl.mockImplementation(
        async (targetUrl, _userId, _includeOtherTypes, defaultMatch) =>
          ciphers.filter((cipher) =>
            cipher.login.matchesUri(targetUrl, new Set<string>(), defaultMatch),
          ),
      );
    };

    const triggerAuthRequired = async (
      requestId = "request-1",
      overrides: Partial<chrome.webRequest.OnAuthRequiredDetails> = {},
    ) => {
      const handleAuthRequired = webRequest.onAuthRequired.addListener.mock.calls[0][0];
      await handleAuthRequired(
        buildAuthRequiredDetails({ url, requestId, ...overrides }),
        callback,
      );
      await flushPromises();
    };

    beforeEach(() => {
      callback = jest.fn();
      webRequestBackground.startListening();
    });

    it("responds with the credentials of the single matching login", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", "fake-password"),
      ]);

      await triggerAuthRequired();

      expect(fillCipherPolicy.ciphersForUrl).toHaveBeenCalledWith(
        url,
        userId,
        CipherUse.AutomaticFill,
        { defaultMatch: UriMatchStrategy.Host },
      );
      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
        url,
        userId,
        undefined,
        UriMatchStrategy.Host,
      );
      expect(callback).toHaveBeenCalledWith({
        authCredentials: { username: "jane.doe@example.com", password: "fake-password" },
      });
    });

    it("records a release event for the released login before responding", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", "fake-password", "released-cipher-id"),
      ]);
      eventCollectionService.collect.mockImplementation(async () => {
        expect(callback).not.toHaveBeenCalled();
      });

      await triggerAuthRequired();

      expect(eventCollectionService.collect).toHaveBeenCalledTimes(1);
      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientHttpAuthReleased,
        "released-cipher-id",
      );
      expect(callback).toHaveBeenCalledWith({
        authCredentials: { username: "jane.doe@example.com", password: "fake-password" },
      });
    });

    it("does not respond with credentials when recording the release event fails", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", "fake-password"),
      ]);
      const error = new Error("state unavailable");
      eventCollectionService.collect.mockRejectedValue(error);

      await triggerAuthRequired();

      expect(callback).toHaveBeenCalledWith({});
      expect(logService.error).toHaveBeenCalledWith(
        "Declined an HTTP auth challenge because the credential release could not be recorded.",
        error,
      );
    });

    it("responds with the credentials of a personal vault login without recording an event", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", "fake-password", "personal-cipher-id", null),
      ]);
      eventCollectionService.collect.mockRejectedValue(new Error("state unavailable"));

      await triggerAuthRequired();

      expect(eventCollectionService.collect).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({
        authCredentials: { username: "jane.doe@example.com", password: "fake-password" },
      });
    });

    it("does not respond with credentials when more than one login matches", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", "fake-password"),
        createCipher("john.doe@example.com", "other-fake-password"),
      ]);

      await triggerAuthRequired();

      expect(callback).toHaveBeenCalledWith({});
      expect(eventCollectionService.collect).not.toHaveBeenCalled();
    });

    it("does not respond with credentials when the matching login has no password", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", null),
      ]);

      await triggerAuthRequired();

      expect(callback).toHaveBeenCalledWith({});
      expect(eventCollectionService.collect).not.toHaveBeenCalled();
    });

    it("does not respond with credentials when the cipher lookup throws", async () => {
      const error = new Error("lookup failed");
      cipherService.getAllDecryptedForUrl.mockRejectedValue(error);

      await triggerAuthRequired();

      expect(callback).toHaveBeenCalledWith({});
      expect(logService.error).toHaveBeenCalledWith(error);
    });

    it("does not look up ciphers when the vault is locked", async () => {
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));

      await triggerAuthRequired();

      expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({});
    });

    it("does not look up ciphers when the active user changes while availability is read", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", "fake-password"),
      ]);
      const otherAccount: Account = {
        id: "other-user-id" as UserId,
        ...mockAccountInfoWith(),
      };
      let accountSwitched = false;
      autofillSettingsService.httpAuthenticationAvailable$ = defer(() => {
        if (!accountSwitched) {
          accountSwitched = true;
          activeAccount$.next(otherAccount);
        }
        return of(true);
      });

      await triggerAuthRequired();

      expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({});
    });

    it("declines without waiting when the active user logs out while availability is read", async () => {
      let loggedOut = false;
      autofillSettingsService.httpAuthenticationAvailable$ = defer(() => {
        if (!loggedOut) {
          loggedOut = true;
          activeAccount$.next(null);
        }
        // The active-user stream does not emit while there is no active user.
        return NEVER;
      });

      await triggerAuthRequired();

      expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({});
    });

    it("does not look up ciphers when HTTP authentication becomes unavailable before the listeners are removed", async () => {
      // The handler is captured from the registration while enabled, then
      // invoked as a challenge already in flight would be.
      const handleAuthRequired = webRequest.onAuthRequired.addListener.mock.calls[0][0];
      autofillSettingsService.httpAuthenticationAvailable$ = of(false);

      await handleAuthRequired(buildAuthRequiredDetails({ url, requestId: "request-1" }), callback);

      expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({});
    });

    it("does not look up ciphers when resolving availability errors", async () => {
      const erroringAvailability$ = new Subject<boolean>();
      autofillSettingsService.httpAuthenticationAvailable$ = erroringAvailability$;

      const challenge = triggerAuthRequired();
      erroringAvailability$.error(new Error("state unavailable"));
      await challenge;

      expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({});
    });

    it("returns the same response it passes to the callback", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", "fake-password"),
      ]);
      const handleAuthRequired = webRequest.onAuthRequired.addListener.mock.calls[0][0];

      const response = await handleAuthRequired(
        buildAuthRequiredDetails({ url, requestId: "request-1" }),
        callback,
      );

      expect(response).toEqual({
        authCredentials: { username: "jane.doe@example.com", password: "fake-password" },
      });
      expect(callback).toHaveBeenCalledWith(response);
    });

    it("defers to the browser for a repeated challenge on the same request", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", "fake-password"),
      ]);
      await triggerAuthRequired();
      callback.mockClear();

      await triggerAuthRequired();

      expect(callback).toHaveBeenCalledWith({});
      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledTimes(1);
    });

    it("does not look up ciphers for a cross-origin subresource challenge", async () => {
      await triggerAuthRequired("request-1", {
        type: "image",
        initiator: "https://attacker.example",
      });

      expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({});
    });

    it("does not look up ciphers for a proxy challenge", async () => {
      await triggerAuthRequired("request-1", {
        isProxy: true,
        challenger: { host: "proxy.internal", port: 8080 },
      });

      expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({});
    });

    it("clears pending requests when the listeners are removed", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", "fake-password"),
      ]);
      await triggerAuthRequired();

      httpAuthenticationAvailable$.next(false);
      httpAuthenticationAvailable$.next(true);
      callback.mockClear();
      await triggerAuthRequired();

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledTimes(2);
    });

    describe("eligibility", () => {
      const expectAnswered = (username = "jane.doe@example.com", password = "fake-password") =>
        expect(callback).toHaveBeenCalledWith({ authCredentials: { username, password } });

      const expectDeclined = () => {
        expect(callback).toHaveBeenCalledWith({});
        expect(eventCollectionService.collect).not.toHaveBeenCalled();
      };

      it("answers with an opted-in organization login", async () => {
        cipherService.getAllDecryptedForUrl.mockResolvedValue([
          createCipher("jane.doe@example.com", "fake-password", "cipher-id", "organization-id"),
        ]);

        await triggerAuthRequired();

        expectAnswered();
      });

      it.each([false, undefined])(
        "declines a login that has not opted in (%s), even when it is the only match",
        async (httpAuthenticationEnabled) => {
          const cipher = createCipher("jane.doe@example.com", "fake-password");
          cipher.login.httpAuthenticationEnabled = httpAuthenticationEnabled;
          cipherService.getAllDecryptedForUrl.mockResolvedValue([cipher]);

          await triggerAuthRequired();

          expectDeclined();
        },
      );

      it("declines a login stored with both HTTP authentication and master password reprompt on, and leaves it unchanged", async () => {
        const cipher = createCipher(
          "jane.doe@example.com",
          "fake-password",
          "cipher-id",
          "organization-id",
          { reprompt: CipherRepromptType.Password },
        );
        cipherService.getAllDecryptedForUrl.mockResolvedValue([cipher]);

        await triggerAuthRequired();

        expectDeclined();
        expect(cipher.login.httpAuthenticationEnabled).toBe(true);
        expect(cipher.reprompt).toBe(CipherRepromptType.Password);
        expect(cipherService.updateWithServer).not.toHaveBeenCalled();
      });

      it("declines a login whose only URI uses the default match strategy", async () => {
        cipherService.getAllDecryptedForUrl.mockResolvedValue([
          createCipher("jane.doe@example.com", "fake-password", "cipher-id", "organization-id", {
            uris: [createLoginUri(url, null)],
          }),
        ]);

        await triggerAuthRequired();

        expectDeclined();
      });

      it("declines a login with a default-strategy URI that the lookup's default would match", async () => {
        resolveLookupByMatching([
          createCipher("jane.doe@example.com", "fake-password", "cipher-id", "organization-id", {
            uris: [createLoginUri(url, null), createLoginUri(url, UriMatchStrategy.Host)],
          }),
        ]);

        await triggerAuthRequired();

        expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
          url,
          userId,
          undefined,
          UriMatchStrategy.Host,
        );
        expectDeclined();
      });

      it("declines a login with no URIs", async () => {
        cipherService.getAllDecryptedForUrl.mockResolvedValue([
          createCipher("jane.doe@example.com", "fake-password", "cipher-id", "organization-id", {
            uris: [],
          }),
        ]);

        await triggerAuthRequired();

        expectDeclined();
      });

      it.each([
        {
          strategy: "Host",
          match: UriMatchStrategy.Host,
          matchingUri: "https://example.com/elsewhere",
          nonMatchingUri: "https://login.example.com/protected",
        },
        {
          strategy: "Base domain",
          match: UriMatchStrategy.Domain,
          matchingUri: "https://login.example.com/",
          nonMatchingUri: "https://example.org/protected",
        },
        {
          strategy: "Starts with",
          match: UriMatchStrategy.StartsWith,
          matchingUri: "https://example.com/prot",
          nonMatchingUri: "https://example.com/other",
        },
        {
          strategy: "Exact",
          match: UriMatchStrategy.Exact,
          matchingUri: url,
          nonMatchingUri: `${url}/`,
        },
        {
          strategy: "Regular expression",
          match: UriMatchStrategy.RegularExpression,
          matchingUri: "^https://example\\.com/prot",
          nonMatchingUri: "^https://example\\.org/",
        },
      ])(
        "matches an explicit $strategy URI by its own rules",
        async ({ match, matchingUri, nonMatchingUri }) => {
          resolveLookupByMatching([
            createCipher("jane.doe@example.com", "fake-password", "matching-id", null, {
              uris: [createLoginUri(matchingUri, match)],
            }),
            createCipher("john.doe@example.com", "other-fake-password", "non-matching-id", null, {
              uris: [createLoginUri(nonMatchingUri, match)],
            }),
          ]);

          await triggerAuthRequired();

          expectAnswered();
        },
      );

      it("answers only on the matching URI of a login that also has a Never URI", async () => {
        const intranetUrl = "https://intranet.example.net/protected";
        resolveLookupByMatching([
          createCipher("jane.doe@example.com", "fake-password", "cipher-id", null, {
            uris: [
              createLoginUri(url, UriMatchStrategy.Never),
              createLoginUri(intranetUrl, UriMatchStrategy.Host),
            ],
          }),
        ]);

        await triggerAuthRequired("request-1");

        expectDeclined();

        callback.mockClear();
        await triggerAuthRequired("request-2", {
          url: intranetUrl,
          challenger: { host: "intranet.example.net", port: 443 },
        });

        expectAnswered();
      });

      it("answers with the one eligible login when it matches alongside ineligible logins", async () => {
        cipherService.getAllDecryptedForUrl.mockResolvedValue([
          createCipher("reprompt@example.com", "reprompt-password", "reprompt-id", null, {
            reprompt: CipherRepromptType.Password,
          }),
          createCipher("default@example.com", "default-password", "default-id", null, {
            uris: [createLoginUri(url, null)],
          }),
          createCipher("opted-out@example.com", "opted-out-password", "opted-out-id", null, {
            httpAuthenticationEnabled: false,
          }),
          createCipher("jane.doe@example.com", "fake-password", "eligible-id", null),
        ]);

        await triggerAuthRequired();

        expectAnswered();
      });

      it("declines when more than one eligible login matches alongside ineligible logins", async () => {
        cipherService.getAllDecryptedForUrl.mockResolvedValue([
          createCipher("reprompt@example.com", "reprompt-password", "reprompt-id", null, {
            reprompt: CipherRepromptType.Password,
          }),
          createCipher("jane.doe@example.com", "fake-password", "first-eligible-id", null),
          createCipher("john.doe@example.com", "other-fake-password", "second-eligible-id", null),
        ]);

        await triggerAuthRequired();

        expectDeclined();
      });

      describe("with the global setting on", () => {
        beforeEach(() => {
          globalSetting$.next(true);
        });

        it("answers with a login that has HTTP authentication off in its own settings", async () => {
          cipherService.getAllDecryptedForUrl.mockResolvedValue([
            createCipher("jane.doe@example.com", "fake-password", "cipher-id", null, {
              httpAuthenticationEnabled: false,
            }),
          ]);

          await triggerAuthRequired();

          expectAnswered();
        });

        it("still declines a login with master password reprompt on", async () => {
          cipherService.getAllDecryptedForUrl.mockResolvedValue([
            createCipher("jane.doe@example.com", "fake-password", "cipher-id", null, {
              reprompt: CipherRepromptType.Password,
              httpAuthenticationEnabled: false,
            }),
          ]);

          await triggerAuthRequired();

          expectDeclined();
        });

        it("still declines a login whose URI uses the default match strategy", async () => {
          cipherService.getAllDecryptedForUrl.mockResolvedValue([
            createCipher("jane.doe@example.com", "fake-password", "cipher-id", null, {
              uris: [createLoginUri(url, null)],
              httpAuthenticationEnabled: false,
            }),
          ]);

          await triggerAuthRequired();

          expectDeclined();
        });

        it("declines when a login with its own setting on and one without both match", async () => {
          cipherService.getAllDecryptedForUrl.mockResolvedValue([
            createCipher("jane.doe@example.com", "fake-password", "opted-in-id", null),
            createCipher("john.doe@example.com", "other-fake-password", "opted-out-id", null, {
              httpAuthenticationEnabled: false,
            }),
          ]);

          await triggerAuthRequired();

          expectDeclined();
        });
      });

      describe("when the login-level controls are hidden", () => {
        /** Starts a handler built while the dev flag for the login-level controls is off. */
        const startListeningWithLoginControlsHidden = () => {
          mockDevFlagEnabled.mockReturnValue(false);
          webRequest.onAuthRequired.addListener.mockClear();
          webRequestBackground = createWebRequestBackground();
          webRequestBackground.startListening();
        };

        it("answers with any eligible login while the global setting is on", async () => {
          globalSetting$.next(true);
          startListeningWithLoginControlsHidden();
          cipherService.getAllDecryptedForUrl.mockResolvedValue([
            createCipher("jane.doe@example.com", "fake-password", "cipher-id", null, {
              httpAuthenticationEnabled: false,
            }),
          ]);

          await triggerAuthRequired();

          expectAnswered();
        });

        it("ignores a login's own setting while the global setting is off", async () => {
          globalSetting$.next(true);
          startListeningWithLoginControlsHidden();
          // The handler is captured from the registration while the global setting was on,
          // then invoked as a challenge already in flight would be.
          const handleAuthRequired = webRequest.onAuthRequired.addListener.mock.calls[0][0];
          globalSetting$.next(false);
          cipherService.getAllDecryptedForUrl.mockResolvedValue([
            createCipher("jane.doe@example.com", "fake-password"),
          ]);

          await handleAuthRequired(
            buildAuthRequiredDetails({ url, requestId: "request-1" }),
            callback,
          );

          expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
          expectDeclined();
        });
      });
    });

    describe("on Firefox", () => {
      const triggerFirefoxAuthRequired = (requestId = "request-1") => {
        const handleAuthRequired = webRequest.onAuthRequired.addListener.mock.calls[0][0];
        return handleAuthRequired(buildAuthRequiredDetails({ url, requestId }));
      };

      beforeEach(() => {
        jest.clearAllMocks();
        platformUtilsService.isFirefox.mockReturnValue(true);
        webRequestBackground = createWebRequestBackground();
        webRequestBackground.startListening();
      });

      it("returns the credentials of the single matching login without a callback", async () => {
        cipherService.getAllDecryptedForUrl.mockResolvedValue([
          createCipher("jane.doe@example.com", "fake-password"),
        ]);

        await expect(triggerFirefoxAuthRequired()).resolves.toEqual({
          authCredentials: { username: "jane.doe@example.com", password: "fake-password" },
        });
      });

      it("resolves to an empty response when no credentials are released", async () => {
        cipherService.getAllDecryptedForUrl.mockResolvedValue([]);

        await expect(triggerFirefoxAuthRequired()).resolves.toEqual({});
      });

      it("resolves to an empty response for a repeated challenge on the same request", async () => {
        cipherService.getAllDecryptedForUrl.mockResolvedValue([
          createCipher("jane.doe@example.com", "fake-password"),
        ]);
        await triggerFirefoxAuthRequired();

        await expect(triggerFirefoxAuthRequired()).resolves.toEqual({});
        expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledTimes(1);
      });
    });
  });
});

function buildAuthRequiredDetails(
  overrides: Partial<chrome.webRequest.OnAuthRequiredDetails> = {},
): chrome.webRequest.OnAuthRequiredDetails {
  return {
    challenger: { host: "example.com", port: 443 },
    isProxy: false,
    realm: "test realm",
    scheme: "basic",
    statusCode: 401,
    frameId: 0,
    method: "GET",
    parentFrameId: -1,
    requestId: "1",
    tabId: 7,
    timeStamp: 0,
    type: "main_frame",
    url: "https://example.com/protected",
    ...overrides,
  } as chrome.webRequest.OnAuthRequiredDetails;
}

describe("shouldAnswerAuthChallenge", () => {
  it("answers a top-level navigation challenged by the host being navigated to", () => {
    expect(shouldAnswerAuthChallenge(buildAuthRequiredDetails())).toBe(true);
  });

  it("declines when the challenge came from a proxy", () => {
    const details = buildAuthRequiredDetails({
      isProxy: true,
      challenger: { host: "proxy.internal", port: 8080 },
    });

    expect(shouldAnswerAuthChallenge(details)).toBe(false);
  });

  describe("authentication schemes", () => {
    it.each([["basic"], ["digest"], ["Basic"], ["DIGEST"]])("answers %s", (scheme) => {
      expect(shouldAnswerAuthChallenge(buildAuthRequiredDetails({ scheme }))).toBe(true);
    });

    it.each([["ntlm"], ["negotiate"], [""]])("declines %s", (scheme) => {
      expect(shouldAnswerAuthChallenge(buildAuthRequiredDetails({ scheme }))).toBe(false);
    });
  });

  describe("challenger identity", () => {
    it("declines when the challenger host differs from the request host", () => {
      const details = buildAuthRequiredDetails({
        challenger: { host: "attacker.example", port: 443 },
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(false);
    });

    it("declines when the challenger port differs from the request port", () => {
      const details = buildAuthRequiredDetails({
        challenger: { host: "example.com", port: 8443 },
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(false);
    });

    it("matches an explicit non-default port", () => {
      const details = buildAuthRequiredDetails({
        challenger: { host: "example.com", port: 8443 },
        url: "https://example.com:8443/protected",
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(true);
    });

    it("resolves the default port for http", () => {
      const details = buildAuthRequiredDetails({
        challenger: { host: "example.com", port: 80 },
        url: "http://example.com/protected",
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(true);
    });

    it("compares IPv6 literals without their brackets", () => {
      const details = buildAuthRequiredDetails({
        challenger: { host: "::1", port: 8080 },
        url: "http://[::1]:8080/protected",
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(true);
    });

    it("declines when the challenger is absent", () => {
      const details = buildAuthRequiredDetails({
        challenger: undefined as unknown as { host: string; port: number },
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(false);
    });

    it("accepts a port reported as a string", () => {
      const details = buildAuthRequiredDetails({
        challenger: { host: "example.com", port: "443" as unknown as number },
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(true);
    });

    it("declines a mismatched port reported as a string", () => {
      const details = buildAuthRequiredDetails({
        challenger: { host: "example.com", port: "8443" as unknown as number },
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(false);
    });

    it.each([[0], [-1], [undefined], [NaN]])(
      "falls back to the host comparison when the port is reported as %s",
      (port) => {
        const details = buildAuthRequiredDetails({
          challenger: { host: "example.com", port: port as unknown as number },
        });

        expect(shouldAnswerAuthChallenge(details)).toBe(true);
      },
    );

    it("still declines a host mismatch when the port is unusable", () => {
      const details = buildAuthRequiredDetails({
        challenger: { host: "attacker.example", port: undefined as unknown as number },
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(false);
    });
  });

  describe("request provenance", () => {
    const subresourceTypes = [
      ["xmlhttprequest"],
      ["sub_frame"],
      ["image"],
      ["script"],
      ["stylesheet"],
      ["font"],
      ["media"],
      ["object"],
    ];

    it("answers a top-level navigation", () => {
      expect(shouldAnswerAuthChallenge(buildAuthRequiredDetails({ type: "main_frame" }))).toBe(
        true,
      );
    });

    it("answers a top-level navigation reached from another origin", () => {
      const details = buildAuthRequiredDetails({
        type: "main_frame",
        initiator: "https://attacker.example",
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(true);
    });

    it("answers a top-level navigation when no initiating context is reported", () => {
      const details = buildAuthRequiredDetails({ type: "main_frame", initiator: undefined });

      expect(shouldAnswerAuthChallenge(details)).toBe(true);
    });

    it.each(subresourceTypes)("declines a same-origin %s", (type) => {
      const details = buildAuthRequiredDetails({
        type: type as chrome.webRequest.OnAuthRequiredDetails["type"],
        initiator: "https://example.com",
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(false);
    });

    it.each(subresourceTypes)("declines a cross-origin %s", (type) => {
      const details = buildAuthRequiredDetails({
        type: type as chrome.webRequest.OnAuthRequiredDetails["type"],
        initiator: "https://attacker.example",
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(false);
    });
  });
});

/*
 * The same-origin comparison behind `ANSWERABLE_SUBRESOURCE_TYPES` is exercised
 * directly. The allowlist is empty, so no subresource reaches this code through
 * `shouldAnswerAuthChallenge`, and these cover it against the day it does.
 */
describe("getInitiatorOrigin", () => {
  it("reads the origin Chrome reports in initiator", () => {
    const details = buildAuthRequiredDetails({ initiator: "https://example.com" });

    expect(getInitiatorOrigin(details)).toBe("https://example.com");
  });

  it("reduces the document url Firefox reports in originUrl to an origin", () => {
    const details = buildAuthRequiredDetails({
      initiator: undefined,
      originUrl: "https://example.com/app/index.html?query=1",
    } as Partial<chrome.webRequest.OnAuthRequiredDetails>);

    expect(getInitiatorOrigin(details)).toBe("https://example.com");
  });

  it("prefers initiator over originUrl when both are present", () => {
    const details = buildAuthRequiredDetails({
      initiator: "https://chrome.example",
      originUrl: "https://firefox.example/page.html",
    } as Partial<chrome.webRequest.OnAuthRequiredDetails>);

    expect(getInitiatorOrigin(details)).toBe("https://chrome.example");
  });

  it("falls back to documentUrl", () => {
    const details = buildAuthRequiredDetails({
      initiator: undefined,
      documentUrl: "https://example.com/app/index.html",
    } as Partial<chrome.webRequest.OnAuthRequiredDetails>);

    expect(getInitiatorOrigin(details)).toBe("https://example.com");
  });

  it("distinguishes origins that differ only by port", () => {
    const details = buildAuthRequiredDetails({ initiator: "https://example.com:8443" });

    expect(getInitiatorOrigin(details)).toBe("https://example.com:8443");
  });

  it("returns null when no initiating context is reported", () => {
    const details = buildAuthRequiredDetails({ initiator: undefined });

    expect(getInitiatorOrigin(details)).toBeNull();
  });

  it("returns null for an opaque initiator", () => {
    const details = buildAuthRequiredDetails({ initiator: "null" });

    expect(getInitiatorOrigin(details)).toBeNull();
  });

  it("returns null for an unparsable initiator", () => {
    const details = buildAuthRequiredDetails({ initiator: "not a url" });

    expect(getInitiatorOrigin(details)).toBeNull();
  });
});

describe("shouldAnswerAuthChallenge, remaining guards", () => {
  it("declines a request with no owning tab", () => {
    expect(shouldAnswerAuthChallenge(buildAuthRequiredDetails({ tabId: -1 }))).toBe(false);
  });

  it("declines an unparsable url", () => {
    expect(shouldAnswerAuthChallenge(buildAuthRequiredDetails({ url: "not a url" }))).toBe(false);
  });
});
