import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, Subject, firstValueFrom } from "rxjs";

import { Duo2faResult } from "@bitwarden/auth/angular";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { awaitAsync } from "@bitwarden/common/spec";

import { ZonedMessageListenerService } from "../../platform/browser/zoned-message-listener.service";
import I18nService from "../../platform/services/i18n.service";
import { isValidVaultReferrer } from "../../platform/utils/valid-vault-referrer";

import { ExtensionTwoFactorAuthDuoComponentService } from "./extension-two-factor-auth-duo-component.service";

jest.mock("../../platform/utils/valid-vault-referrer");

const isValidVaultReferrerMock = jest.mocked(isValidVaultReferrer);

/** A promise whose settlement the test drives, so message overlap can be staged deterministically. */
const deferred = () => {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>((r) => (resolve = r));
  return { promise, resolve };
};

describe("ExtensionTwoFactorAuthDuoComponentService", () => {
  const vaultHostname = "vault.bitwarden.com";

  let extensionTwoFactorAuthDuoComponentService: ExtensionTwoFactorAuthDuoComponentService;
  let browserMessagingApi: MockProxy<ZonedMessageListenerService>;
  let environmentService: MockProxy<EnvironmentService>;
  let i18nService: MockProxy<I18nService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let logService: MockProxy<LogService>;

  const duoResultMessage = (overrides: Record<string, unknown> = {}) => ({
    command: "duoResult",
    code: "123456",
    state: "abcdef",
    referrer: vaultHostname,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    browserMessagingApi = mock<ZonedMessageListenerService>();
    environmentService = mock<EnvironmentService>();
    i18nService = mock<I18nService>();
    platformUtilsService = mock<PlatformUtilsService>();
    logService = mock<LogService>();

    isValidVaultReferrerMock.mockResolvedValue(true);

    extensionTwoFactorAuthDuoComponentService = new ExtensionTwoFactorAuthDuoComponentService(
      browserMessagingApi,
      environmentService,
      i18nService,
      platformUtilsService,
      logService,
    );
  });

  describe("listenForDuo2faResult$", () => {
    /** Subscribes, pumps the supplied messages through, and returns everything that survived. */
    const collectEmissions = async (messages: unknown[]) => {
      const messages$ = new Subject<unknown>();
      browserMessagingApi.messageListener$.mockReturnValue(messages$);

      const emitted: Duo2faResult[] = [];
      const subscription = extensionTwoFactorAuthDuoComponentService
        .listenForDuo2faResult$()
        .subscribe((result) => emitted.push(result));

      for (const message of messages) {
        messages$.next(message);
        await awaitAsync();
      }

      subscription.unsubscribe();
      return emitted;
    };

    it("validates the referrer the content script attached against the known vault hostnames", async () => {
      await collectEmissions([duoResultMessage()]);

      expect(isValidVaultReferrerMock).toHaveBeenCalledWith(environmentService, vaultHostname);
    });

    it("emits a duo 2FA result when the referrer is a known vault", async () => {
      const message = duoResultMessage();

      const messageStream$ = new BehaviorSubject(message);
      browserMessagingApi.messageListener$.mockReturnValue(messageStream$);

      const duo2faResult = await firstValueFrom(
        extensionTwoFactorAuthDuoComponentService.listenForDuo2faResult$(),
      );

      expect(duo2faResult).toEqual({
        code: message.code,
        state: message.state,
        token: `${message.code}|${message.state}`,
      });
    });

    it("emits nothing and logs a warning when the referrer is not a known vault", async () => {
      isValidVaultReferrerMock.mockResolvedValue(false);

      const emitted = await collectEmissions([duoResultMessage({ referrer: "attacker.test" })]);

      expect(emitted).toEqual([]);
      expect(logService.warning).toHaveBeenCalled();
    });

    it("does not name the rejected origin in the log, to keep browsing context out of the logs", async () => {
      isValidVaultReferrerMock.mockResolvedValue(false);

      await collectEmissions([duoResultMessage({ referrer: "attacker.test" })]);

      const logged = logService.warning.mock.calls.flat().join(" ");
      expect(logged).not.toContain("attacker.test");
    });

    it("hands an absent referrer to the validator rather than short-circuiting", async () => {
      isValidVaultReferrerMock.mockResolvedValue(false);

      const emitted = await collectEmissions([duoResultMessage({ referrer: undefined })]);

      expect(isValidVaultReferrerMock).toHaveBeenCalledWith(environmentService, undefined);
      expect(emitted).toEqual([]);
    });

    it("ignores messages for other commands without validating them", async () => {
      const emitted = await collectEmissions([{ command: "authResult", referrer: vaultHostname }]);

      expect(emitted).toEqual([]);
      expect(isValidVaultReferrerMock).not.toHaveBeenCalled();
    });

    it("does not drop an in-flight validation when a second message arrives", async () => {
      const first = deferred();
      const second = deferred();
      isValidVaultReferrerMock
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      const messages$ = new Subject<unknown>();
      browserMessagingApi.messageListener$.mockReturnValue(messages$);

      const emitted: Duo2faResult[] = [];
      const subscription = extensionTwoFactorAuthDuoComponentService
        .listenForDuo2faResult$()
        .subscribe((result) => emitted.push(result));

      messages$.next(duoResultMessage({ code: "first", state: "s1" }));
      messages$.next(duoResultMessage({ code: "second", state: "s2" }));

      first.resolve(true);
      await awaitAsync();
      second.resolve(true);
      await awaitAsync();

      expect(emitted.map((result) => result.code)).toEqual(["first", "second"]);

      subscription.unsubscribe();
    });

    it("keeps listening when the validator cannot complete", async () => {
      isValidVaultReferrerMock
        .mockRejectedValueOnce(new Error("environment unavailable"))
        .mockResolvedValue(true);

      const messages$ = new Subject<unknown>();
      browserMessagingApi.messageListener$.mockReturnValue(messages$);

      const emitted: Duo2faResult[] = [];
      let streamError: unknown = null;
      const subscription = extensionTwoFactorAuthDuoComponentService
        .listenForDuo2faResult$()
        .subscribe({
          next: (result) => emitted.push(result),
          error: (error: unknown) => (streamError = error),
        });

      messages$.next(duoResultMessage({ code: "during-failure" }));
      await awaitAsync();
      messages$.next(duoResultMessage({ code: "after-failure" }));
      await awaitAsync();

      expect(streamError).toBeNull();
      expect(emitted.map((result) => result.code)).toEqual(["after-failure"]);

      subscription.unsubscribe();
    });

    it("drops the message and logs an error when the validator cannot complete", async () => {
      isValidVaultReferrerMock.mockRejectedValue(new Error("environment unavailable"));

      const emitted = await collectEmissions([duoResultMessage()]);

      expect(emitted).toEqual([]);
      expect(logService.error).toHaveBeenCalled();
    });

    it("still emits a valid result that follows a rejected one", async () => {
      isValidVaultReferrerMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      const emitted = await collectEmissions([
        duoResultMessage({ code: "rejected", referrer: "attacker.test" }),
        duoResultMessage({ code: "accepted" }),
      ]);

      expect(emitted.map((result) => result.code)).toEqual(["accepted"]);
    });
  });

  describe("launchDuoFrameless", () => {
    it("should launch the duo frameless url", async () => {
      // Arrange
      const duoFramelessUrl = "https://duoFramelessUrl";
      const webVaultUrl = "https://webVaultUrl";

      i18nService.t.mockImplementation((key) => key);

      const launchUrl = `${webVaultUrl}/duo-redirect-connector.html?duoFramelessUrl=${encodeURIComponent(
        duoFramelessUrl,
      )}&handOffMessage=${encodeURIComponent(
        JSON.stringify({
          title: "youSuccessfullyLoggedIn",
          message: "youMayCloseThisWindow",
          isCountdown: false,
        }),
      )}`;

      const mockEnvironment = {
        getWebVaultUrl: () => webVaultUrl,
      } as unknown as Environment;

      const environmentBSubject = new BehaviorSubject(mockEnvironment);
      environmentService.environment$ = environmentBSubject.asObservable();

      // Act
      await extensionTwoFactorAuthDuoComponentService.launchDuoFrameless(duoFramelessUrl);

      // Assert
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(launchUrl);
    });
  });
});
