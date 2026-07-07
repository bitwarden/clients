import { MockProxy, mock } from "jest-mock-extended";

import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";

import { LoginEmailService } from "../login-email/login-email.service";

import { DefaultLoginSuccessHandlerService } from "./default-login-success-handler.service";

describe("DefaultLoginSuccessHandlerService", () => {
  let service: DefaultLoginSuccessHandlerService;

  let loginEmailService: MockProxy<LoginEmailService>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let syncService: MockProxy<SyncService>;
  let userAsymmetricKeysRegenerationService: MockProxy<UserAsymmetricKeysRegenerationService>;
  let encryptedMigrator: MockProxy<EncryptedMigrator>;

  const userId = "USER_ID" as UserId;
  const testEmail = "test@bitwarden.com";

  beforeEach(() => {
    loginEmailService = mock<LoginEmailService>();
    ssoLoginService = mock<SsoLoginServiceAbstraction>();
    syncService = mock<SyncService>();
    userAsymmetricKeysRegenerationService = mock<UserAsymmetricKeysRegenerationService>();
    encryptedMigrator = mock<EncryptedMigrator>();

    service = new DefaultLoginSuccessHandlerService(
      loginEmailService,
      ssoLoginService,
      syncService,
      userAsymmetricKeysRegenerationService,
      encryptedMigrator,
    );

    syncService.fullSync.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("run", () => {
    it("should call required services on successful login", async () => {
      await service.run(userId, null);

      expect(syncService.fullSync).toHaveBeenCalledWith(true, { skipTokenRefresh: true });
      expect(userAsymmetricKeysRegenerationService.regenerateIfNeeded).toHaveBeenCalledWith(userId);
      expect(loginEmailService.clearLoginEmail).toHaveBeenCalled();
    });

    it("should get SSO email", async () => {
      await service.run(userId, null);

      expect(ssoLoginService.getSsoEmail).toHaveBeenCalled();
    });

    describe("given SSO email is not found", () => {
      beforeEach(() => {
        ssoLoginService.getSsoEmail.mockResolvedValue(null);
      });

      it("should not call updateSsoRequiredCache() and clearSsoEmail()", async () => {
        await service.run(userId, null);

        expect(ssoLoginService.updateSsoRequiredCache).not.toHaveBeenCalled();
        expect(ssoLoginService.clearSsoEmail).not.toHaveBeenCalled();
      });
    });

    describe("given SSO email is found", () => {
      beforeEach(() => {
        ssoLoginService.getSsoEmail.mockResolvedValue(testEmail);
      });

      it("should call updateSsoRequiredCache() and clearSsoEmail()", async () => {
        await service.run(userId, null);

        expect(ssoLoginService.updateSsoRequiredCache).toHaveBeenCalledWith(testEmail, userId);
        expect(ssoLoginService.clearSsoEmail).toHaveBeenCalled();
      });
    });
  });
});
