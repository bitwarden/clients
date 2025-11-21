import { MockProxy, mock } from "jest-mock-extended";

import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { LoginEmailService } from "../login-email/login-email.service";

import { DefaultLoginSuccessHandlerService } from "./default-login-success-handler.service";

describe("DefaultLoginSuccessHandlerService", () => {
  let service: DefaultLoginSuccessHandlerService;

  let configService: MockProxy<ConfigService>;
  let loginEmailService: MockProxy<LoginEmailService>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let syncService: MockProxy<SyncService>;
  let userAsymmetricKeysRegenerationService: MockProxy<UserAsymmetricKeysRegenerationService>;
  let logService: MockProxy<LogService>;

  const userId = "USER_ID" as UserId;
  const testEmail = "test@bitwarden.com";

  beforeEach(() => {
    configService = mock<ConfigService>();
    loginEmailService = mock<LoginEmailService>();
    ssoLoginService = mock<SsoLoginServiceAbstraction>();
    syncService = mock<SyncService>();
    userAsymmetricKeysRegenerationService = mock<UserAsymmetricKeysRegenerationService>();
    logService = mock<LogService>();

    service = new DefaultLoginSuccessHandlerService(
      configService,
      loginEmailService,
      ssoLoginService,
      syncService,
      userAsymmetricKeysRegenerationService,
      logService,
    );

    syncService.fullSync.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("run", () => {
    it("should call required services on successful login", async () => {
      await service.run(userId);

      expect(syncService.fullSync).toHaveBeenCalledWith(true, { skipTokenRefresh: true });
      expect(userAsymmetricKeysRegenerationService.regenerateIfNeeded).toHaveBeenCalledWith(userId);
      expect(loginEmailService.clearLoginEmail).toHaveBeenCalled();
    });

    it("should get SSO email", async () => {
      await service.run(userId);

      expect(ssoLoginService.getSsoEmail).toHaveBeenCalled();
    });

    describe("given SSO email is not found", () => {
      beforeEach(() => {
        ssoLoginService.getSsoEmail.mockResolvedValue(null);
      });

      it("should log error and return early", async () => {
        await service.run(userId);

        expect(logService.error).toHaveBeenCalledWith("SSO login email not found.");
        expect(ssoLoginService.updateSsoRequiredCache).not.toHaveBeenCalled();
      });
    });

    describe("given SSO email is found", () => {
      beforeEach(() => {
        ssoLoginService.getSsoEmail.mockResolvedValue(testEmail);
      });

      it("should call updateSsoRequiredCache() and clearSsoEmail()", async () => {
        await service.run(userId);

        expect(ssoLoginService.updateSsoRequiredCache).toHaveBeenCalledWith(testEmail, userId);
        expect(ssoLoginService.clearSsoEmail).toHaveBeenCalled();
      });
    });
  });
});
