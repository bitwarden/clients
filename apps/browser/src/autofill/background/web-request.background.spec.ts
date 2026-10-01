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

import WebRequestBackground from "./web-request.background";

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

    const triggerAuthRequired = async (requestId = "request-1") => {
      const handleAuthRequired = webRequest.onAuthRequired.addListener.mock.calls[0][0];
      await handleAuthRequired({ url, requestId }, callback);
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

      const response = await handleAuthRequired({ url, requestId: "request-1" }, callback);

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
        return handleAuthRequired({ url, requestId });
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
