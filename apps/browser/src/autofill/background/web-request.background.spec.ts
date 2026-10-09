import { mock } from "jest-mock-extended";
import { BehaviorSubject, defer, NEVER, of, Subject } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { flushPromises } from "../spec/testing-utils";

import WebRequestBackground, {
  getInitiatorOrigin,
  shouldAnswerAuthChallenge,
} from "./web-request.background";

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
  let authService: ReturnType<typeof mock<AuthService>>;
  let accountService: ReturnType<typeof mock<AccountService>>;
  let autofillSettingsService: ReturnType<typeof mock<AutofillSettingsServiceAbstraction>>;
  let eventCollectionService: ReturnType<typeof mock<EventCollectionService>>;
  let logService: ReturnType<typeof mock<LogService>>;
  let activeAccount$: BehaviorSubject<Account | null>;
  let resolvedSetting$: BehaviorSubject<boolean>;
  let webRequest: {
    onAuthRequired: WebRequestEventMock;
    onCompleted: WebRequestEventMock;
    onErrorOccurred: WebRequestEventMock;
  };
  let webRequestBackground: WebRequestBackground;

  const createWebRequestBackground = () =>
    new WebRequestBackground(
      platformUtilsService,
      cipherService,
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
    authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));

    activeAccount$ = new BehaviorSubject<Account | null>(account);
    accountService = mock<AccountService>();
    accountService.activeAccount$ = activeAccount$;

    resolvedSetting$ = new BehaviorSubject<boolean>(true);
    autofillSettingsService = mock<AutofillSettingsServiceAbstraction>();
    autofillSettingsService.resolvedEnableBasicAuthResponse$ = resolvedSetting$;

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
    it("registers listeners when the resolved setting is enabled", () => {
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

    it("does not register listeners or resolve the setting on Safari", () => {
      let resolvedSettingSubscribed = false;
      autofillSettingsService.resolvedEnableBasicAuthResponse$ = defer(() => {
        resolvedSettingSubscribed = true;
        return of(true);
      });
      platformUtilsService.isSafari.mockReturnValue(true);
      webRequestBackground = createWebRequestBackground();

      webRequestBackground.startListening();

      expectListenersRegistered(0);
      expect(resolvedSettingSubscribed).toBe(false);
    });

    it("does not register listeners when the resolved setting is disabled", () => {
      resolvedSetting$.next(false);

      webRequestBackground.startListening();

      expectListenersRegistered(0);
    });

    it("does not register listeners when there is no active user", () => {
      activeAccount$.next(null);

      webRequestBackground.startListening();

      expectListenersRegistered(0);
    });

    it("does not register listeners when resolving the setting errors", () => {
      const erroringResolvedSetting$ = new Subject<boolean>();
      autofillSettingsService.resolvedEnableBasicAuthResponse$ = erroringResolvedSetting$;

      webRequestBackground.startListening();
      erroringResolvedSetting$.error(new Error("config unavailable"));

      expectListenersRegistered(0);
    });

    it("keeps reacting to account changes after resolving the setting errors", () => {
      const erroringResolvedSetting$ = new Subject<boolean>();
      autofillSettingsService.resolvedEnableBasicAuthResponse$ = erroringResolvedSetting$;

      webRequestBackground.startListening();
      erroringResolvedSetting$.error(new Error("config unavailable"));
      autofillSettingsService.resolvedEnableBasicAuthResponse$ = resolvedSetting$;
      activeAccount$.next({ ...account });

      expectListenersRegistered(1);
    });

    it("removes the same listeners it registered when the resolved setting is disabled", () => {
      webRequestBackground.startListening();

      resolvedSetting$.next(false);

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

    it("removes listeners when the active user changes to one with the setting disabled", () => {
      const otherUserId = "other-user-id" as UserId;
      webRequestBackground.startListening();

      autofillSettingsService.resolvedEnableBasicAuthResponse$ = of(false);
      activeAccount$.next({ id: otherUserId, ...mockAccountInfoWith() });

      expectListenersUnregistered(1);
    });

    it("removes listeners when the active user logs out", () => {
      webRequestBackground.startListening();

      activeAccount$.next(null);

      expectListenersUnregistered(1);
    });

    it("re-registers listeners when the resolved setting is re-enabled", () => {
      webRequestBackground.startListening();

      resolvedSetting$.next(false);
      resolvedSetting$.next(true);

      expectListenersRegistered(2);
      expectListenersUnregistered(1);
    });

    it("does not register listeners more than once for repeated enabled emissions", () => {
      webRequestBackground.startListening();

      resolvedSetting$.next(true);
      activeAccount$.next({ ...account });

      expectListenersRegistered(1);
    });

    it("does not remove listeners that were never registered", () => {
      resolvedSetting$.next(false);
      webRequestBackground.startListening();

      activeAccount$.next(null);

      expectListenersUnregistered(0);
    });

    it("does not stack subscriptions when called more than once", () => {
      webRequestBackground.startListening();
      webRequestBackground.startListening();

      resolvedSetting$.next(false);

      expectListenersRegistered(1);
      expectListenersUnregistered(1);
    });
  });

  describe("handling auth challenges", () => {
    const url = "https://example.com/protected";
    let callback: jest.Mock;

    const createCipher = (
      username: string | null,
      password: string | null,
      id = "cipher-id",
      organizationId: string | null = "organization-id",
    ) => ({ id, organizationId, login: { username, password } }) as unknown as CipherView;

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

    it("does not look up ciphers when the active user changes while the setting is read", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", "fake-password"),
      ]);
      const otherAccount: Account = {
        id: "other-user-id" as UserId,
        ...mockAccountInfoWith(),
      };
      let accountSwitched = false;
      autofillSettingsService.resolvedEnableBasicAuthResponse$ = defer(() => {
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

    it("declines without waiting when the active user logs out while the setting is read", async () => {
      let loggedOut = false;
      autofillSettingsService.resolvedEnableBasicAuthResponse$ = defer(() => {
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

    it("does not look up ciphers when the resolved setting is disabled before the listeners are removed", async () => {
      // The handler is captured from the registration while enabled, then
      // invoked as a challenge already in flight would be.
      const handleAuthRequired = webRequest.onAuthRequired.addListener.mock.calls[0][0];
      autofillSettingsService.resolvedEnableBasicAuthResponse$ = of(false);

      await handleAuthRequired(buildAuthRequiredDetails({ url, requestId: "request-1" }), callback);

      expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({});
    });

    it("does not look up ciphers when resolving the setting errors", async () => {
      const erroringResolvedSetting$ = new Subject<boolean>();
      autofillSettingsService.resolvedEnableBasicAuthResponse$ = erroringResolvedSetting$;

      const challenge = triggerAuthRequired();
      erroringResolvedSetting$.error(new Error("state unavailable"));
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

      resolvedSetting$.next(false);
      resolvedSetting$.next(true);
      callback.mockClear();
      await triggerAuthRequired();

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledTimes(2);
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
