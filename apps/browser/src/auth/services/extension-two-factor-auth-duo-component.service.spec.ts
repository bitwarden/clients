import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ZonedMessageListenerService } from "../../platform/browser/zoned-message-listener.service";
import I18nService from "../../platform/services/i18n.service";

import { ExtensionTwoFactorAuthDuoComponentService } from "./extension-two-factor-auth-duo-component.service";

describe("ExtensionTwoFactorAuthDuoComponentService", () => {
  let extensionTwoFactorAuthDuoComponentService: ExtensionTwoFactorAuthDuoComponentService;
  let browserMessagingApi: MockProxy<ZonedMessageListenerService>;
  let environmentService: MockProxy<EnvironmentService>;
  let i18nService: MockProxy<I18nService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;

  beforeEach(() => {
    jest.clearAllMocks();

    browserMessagingApi = mock<ZonedMessageListenerService>();
    environmentService = mock<EnvironmentService>();
    i18nService = mock<I18nService>();
    platformUtilsService = mock<PlatformUtilsService>();

    extensionTwoFactorAuthDuoComponentService = new ExtensionTwoFactorAuthDuoComponentService(
      browserMessagingApi,
      environmentService,
      i18nService,
      platformUtilsService,
    );
  });

  describe("listenForDuo2faResult$", () => {
    it("should return an observable that emits a duo 2FA result when a duo result message is received", async () => {
      const message = {
        command: "duoResult",
        code: "123456",
        state: "abcdef",
      };
      const expectedDuo2faResult = {
        code: message.code,
        state: message.state,
        token: `${message.code}|${message.state}`,
      };

      const messageStream$ = new BehaviorSubject(message);
      browserMessagingApi.messageListener$.mockReturnValue(messageStream$);

      const duo2faResult = await firstValueFrom(
        extensionTwoFactorAuthDuoComponentService.listenForDuo2faResult$(),
      );
      expect(duo2faResult).toEqual(expectedDuo2faResult);
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
