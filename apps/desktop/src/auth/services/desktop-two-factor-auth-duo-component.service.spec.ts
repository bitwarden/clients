import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";

import { DesktopTwoFactorAuthDuoComponentService } from "./desktop-two-factor-auth-duo-component.service";

describe("DesktopTwoFactorAuthDuoComponentService", () => {
  let desktopTwoFactorAuthDuoComponentService: DesktopTwoFactorAuthDuoComponentService;
  let messageListener: MockProxy<MessageListener>;
  let environmentService: MockProxy<EnvironmentService>;
  let i18nService: MockProxy<I18nService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;

  beforeEach(() => {
    jest.clearAllMocks();

    messageListener = mock<MessageListener>();
    environmentService = mock<EnvironmentService>();
    i18nService = mock<I18nService>();
    platformUtilsService = mock<PlatformUtilsService>();

    desktopTwoFactorAuthDuoComponentService = new DesktopTwoFactorAuthDuoComponentService(
      messageListener,
      environmentService,
      i18nService,
      platformUtilsService,
    );
  });

  describe("listenForDuo2faResult$", () => {
    it("should return an observable that emits a duo 2FA result when a duo result message is received", async () => {
      const message: { code: string; state: string } = {
        code: "123456",
        state: "abcdef",
      };
      const expectedDuo2faResult = {
        code: message.code,
        state: message.state,
        token: `${message.code}|${message.state}`,
      };

      const messages = new BehaviorSubject(message);
      messageListener.messages$.mockReturnValue(messages);

      const duo2faResult = await firstValueFrom(
        desktopTwoFactorAuthDuoComponentService.listenForDuo2faResult$(),
      );
      expect(duo2faResult).toEqual(expectedDuo2faResult);
    });
  });

  describe("launchDuoFrameless", () => {
    it("should build and launch the duo frameless URL", async () => {
      // Arrange
      const duoFramelessUrl = "https://duoFramelessUrl";
      const webVaultUrl = "https://webVaultUrl";

      i18nService.t.mockImplementation((key) => key);

      const handOffMessage = {
        title: "youSuccessfullyLoggedIn",
        message: "youMayCloseThisWindow",
        isCountdown: false,
      };

      const mockEnvironment = {
        getWebVaultUrl: () => webVaultUrl,
      } as unknown as Environment;
      const environmentBSubject = new BehaviorSubject(mockEnvironment);
      environmentService.environment$ = environmentBSubject.asObservable();

      // Act
      await desktopTwoFactorAuthDuoComponentService.launchDuoFrameless(duoFramelessUrl);

      // Assert
      const launchUrl =
        webVaultUrl +
        "/duo-redirect-connector.html" +
        "?duoFramelessUrl=" +
        encodeURIComponent(duoFramelessUrl) +
        "&handOffMessage=" +
        encodeURIComponent(JSON.stringify(handOffMessage));
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(launchUrl);
    });
  });
});
