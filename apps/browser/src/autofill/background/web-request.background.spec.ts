import { mock } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { flushPromises } from "../spec/testing-utils";

import WebRequestBackground, { shouldAnswerAuthChallenge } from "./web-request.background";

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
  let configService: ReturnType<typeof mock<ConfigService>>;
  let autofillSettingsService: ReturnType<typeof mock<AutofillSettingsServiceAbstraction>>;
  let activeAccount$: BehaviorSubject<Account | null>;
  let featureFlag$: BehaviorSubject<boolean>;
  let userSetting$: BehaviorSubject<boolean>;
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
      configService,
      autofillSettingsService,
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
    cipherService = mock<CipherService>();
    authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));

    activeAccount$ = new BehaviorSubject<Account | null>(account);
    accountService = mock<AccountService>();
    accountService.activeAccount$ = activeAccount$;

    featureFlag$ = new BehaviorSubject<boolean>(true);
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(featureFlag$);

    userSetting$ = new BehaviorSubject<boolean>(true);
    autofillSettingsService = mock<AutofillSettingsServiceAbstraction>();
    autofillSettingsService.enableBasicAuthResponse$ = userSetting$;

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
    it("evaluates the basic auth response feature flag", () => {
      webRequestBackground.startListening();

      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.EnableBasicAuthResponse,
      );
    });

    it("registers listeners when the feature flag and user setting are both enabled", () => {
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

    it("does not register listeners when the feature flag is disabled", () => {
      featureFlag$.next(false);

      webRequestBackground.startListening();

      expectListenersRegistered(0);
    });

    it("does not register listeners when the user setting is disabled", () => {
      userSetting$.next(false);

      webRequestBackground.startListening();

      expectListenersRegistered(0);
    });

    it("does not register listeners when there is no active user", () => {
      activeAccount$.next(null);

      webRequestBackground.startListening();

      expectListenersRegistered(0);
    });

    it("does not register listeners when evaluating the feature flag errors", () => {
      const erroringFeatureFlag$ = new Subject<boolean>();
      configService.getFeatureFlag$.mockReturnValue(erroringFeatureFlag$);

      webRequestBackground.startListening();
      erroringFeatureFlag$.error(new Error("config unavailable"));

      expectListenersRegistered(0);
    });

    it("removes the same listeners it registered when the user setting is disabled", () => {
      webRequestBackground.startListening();

      userSetting$.next(false);

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

    it("removes listeners when the feature flag is disabled", () => {
      webRequestBackground.startListening();

      featureFlag$.next(false);

      expectListenersUnregistered(1);
    });

    it("removes listeners when the active user logs out", () => {
      webRequestBackground.startListening();

      activeAccount$.next(null);

      expectListenersUnregistered(1);
    });

    it("re-registers listeners when the user setting is re-enabled", () => {
      webRequestBackground.startListening();

      userSetting$.next(false);
      userSetting$.next(true);

      expectListenersRegistered(2);
      expectListenersUnregistered(1);
    });

    it("does not register listeners more than once for repeated enabled emissions", () => {
      webRequestBackground.startListening();

      userSetting$.next(true);
      featureFlag$.next(true);

      expectListenersRegistered(1);
    });

    it("does not remove listeners that were never registered", () => {
      userSetting$.next(false);
      webRequestBackground.startListening();

      featureFlag$.next(false);

      expectListenersUnregistered(0);
    });

    it("does not stack subscriptions when called more than once", () => {
      webRequestBackground.startListening();
      webRequestBackground.startListening();

      userSetting$.next(false);

      expectListenersRegistered(1);
      expectListenersUnregistered(1);
    });
  });

  describe("handling auth challenges", () => {
    const url = "https://example.com/protected";
    let callback: jest.Mock;

    const createCipher = (username: string | null, password: string | null) =>
      ({ login: { username, password } }) as unknown as CipherView;

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

    it("does not respond with credentials when more than one login matches", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", "fake-password"),
        createCipher("john.doe@example.com", "other-fake-password"),
      ]);

      await triggerAuthRequired();

      expect(callback).toHaveBeenCalledWith({});
    });

    it("does not respond with credentials when the matching login has no password", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        createCipher("jane.doe@example.com", null),
      ]);

      await triggerAuthRequired();

      expect(callback).toHaveBeenCalledWith({});
    });

    it("does not respond with credentials when the cipher lookup throws", async () => {
      cipherService.getAllDecryptedForUrl.mockRejectedValue(new Error("lookup failed"));

      await triggerAuthRequired();

      expect(callback).toHaveBeenCalledWith({});
    });

    it("does not look up ciphers when the vault is locked", async () => {
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));

      await triggerAuthRequired();

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

      userSetting$.next(false);
      userSetting$.next(true);
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
    const answerableSubresourceTypes = [["xmlhttprequest"], ["sub_frame"]];
    const passiveAssetTypes = [
      ["image"],
      ["script"],
      ["stylesheet"],
      ["font"],
      ["media"],
      ["object"],
    ];

    it.each(answerableSubresourceTypes)("declines a cross-origin %s", (type) => {
      const details = buildAuthRequiredDetails({
        type: type as chrome.webRequest.OnAuthRequiredDetails["type"],
        initiator: "https://attacker.example",
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(false);
    });

    it.each(answerableSubresourceTypes)("answers a same-origin %s", (type) => {
      const details = buildAuthRequiredDetails({
        type: type as chrome.webRequest.OnAuthRequiredDetails["type"],
        initiator: "https://example.com",
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(true);
    });

    it.each(passiveAssetTypes)("declines a same-origin %s", (type) => {
      const details = buildAuthRequiredDetails({
        type: type as chrome.webRequest.OnAuthRequiredDetails["type"],
        initiator: "https://example.com",
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(false);
    });

    it("declines a subresource whose initiator differs only by port", () => {
      const details = buildAuthRequiredDetails({
        type: "xmlhttprequest",
        initiator: "https://example.com:8443",
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(false);
    });

    it.each(answerableSubresourceTypes)(
      "declines a %s when no initiating context is reported",
      (type) => {
        const details = buildAuthRequiredDetails({
          type: type as chrome.webRequest.OnAuthRequiredDetails["type"],
          initiator: undefined,
        });

        expect(shouldAnswerAuthChallenge(details)).toBe(false);
      },
    );

    it("answers a top-level navigation when no initiating context is reported", () => {
      const details = buildAuthRequiredDetails({ type: "main_frame", initiator: undefined });

      expect(shouldAnswerAuthChallenge(details)).toBe(true);
    });

    describe("firefox, which reports originUrl rather than initiator", () => {
      const asFirefoxDetails = (
        overrides: Partial<chrome.webRequest.OnAuthRequiredDetails> & {
          originUrl?: string;
          documentUrl?: string;
        },
      ) =>
        buildAuthRequiredDetails({
          initiator: undefined,
          challenger: { host: "example.com", port: -1 },
          ...overrides,
        } as Partial<chrome.webRequest.OnAuthRequiredDetails>);

      it.each(answerableSubresourceTypes)("answers a same-origin %s", (type) => {
        const details = asFirefoxDetails({
          type: type as chrome.webRequest.OnAuthRequiredDetails["type"],
          originUrl: "https://example.com/app/index.html",
        });

        expect(shouldAnswerAuthChallenge(details)).toBe(true);
      });

      it.each(answerableSubresourceTypes)("declines a cross-origin %s", (type) => {
        const details = asFirefoxDetails({
          type: type as chrome.webRequest.OnAuthRequiredDetails["type"],
          originUrl: "https://attacker.example/page.html",
        });

        expect(shouldAnswerAuthChallenge(details)).toBe(false);
      });

      it("falls back to documentUrl when originUrl is absent", () => {
        const details = asFirefoxDetails({
          type: "sub_frame",
          documentUrl: "https://example.com/app/index.html",
        });

        expect(shouldAnswerAuthChallenge(details)).toBe(true);
      });

      it("answers a top-level navigation reached from another origin", () => {
        const details = asFirefoxDetails({
          type: "main_frame",
          originUrl: "https://attacker.example/page.html",
        });

        expect(shouldAnswerAuthChallenge(details)).toBe(true);
      });

      it("declines a same-origin subresource when the host does not match", () => {
        const details = asFirefoxDetails({
          type: "xmlhttprequest",
          challenger: { host: "attacker.example", port: -1 },
          originUrl: "https://example.com/app/index.html",
        });

        expect(shouldAnswerAuthChallenge(details)).toBe(false);
      });
    });

    it("declines a subresource with an opaque initiator", () => {
      const details = buildAuthRequiredDetails({ type: "xmlhttprequest", initiator: "null" });

      expect(shouldAnswerAuthChallenge(details)).toBe(false);
    });

    it("answers a top-level navigation regardless of initiator", () => {
      const details = buildAuthRequiredDetails({
        type: "main_frame",
        initiator: "https://attacker.example",
      });

      expect(shouldAnswerAuthChallenge(details)).toBe(true);
    });
  });

  it("declines a request with no owning tab", () => {
    expect(shouldAnswerAuthChallenge(buildAuthRequiredDetails({ tabId: -1 }))).toBe(false);
  });

  it("declines an unparsable url", () => {
    expect(shouldAnswerAuthChallenge(buildAuthRequiredDetails({ url: "not a url" }))).toBe(false);
  });
});
