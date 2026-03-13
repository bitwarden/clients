import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  LoginStrategyServiceAbstraction,
  SsoUrlService,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { TwoFactorApiService, TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { LoginCommand } from "./login.command";

describe("LoginCommand", () => {
  let command: LoginCommand;

  const logoutCallback = jest.fn(async () => {});
  const userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
  const keyService = mock<KeyService>();

  beforeEach(() => {
    jest.clearAllMocks();

    command = new LoginCommand(
      mock<LoginStrategyServiceAbstraction>(),
      mock<AuthService>(),
      mock<TwoFactorApiService>(),
      mock<MasterPasswordApiService>(),
      mock<CryptoFunctionService>(),
      mock<EnvironmentService>(),
      mock<PasswordGenerationServiceAbstraction>(),
      mock<PasswordStrengthServiceAbstraction>(),
      mock<PlatformUtilsService>(),
      mock<AccountService>(),
      keyService,
      mock<PolicyService>(),
      mock<TwoFactorService>(),
      mock<SyncService>(),
      mock<KeyConnectorService>(),
      mock<PolicyApiServiceAbstraction>(),
      mock<OrganizationService>(),
      logoutCallback,
      mock<KdfConfigService>(),
      mock<SsoUrlService>(),
      mock<I18nService>(),
      mock<MasterPasswordServiceAbstraction>(),
      userDecryptionOptionsService,
      mock<EncryptedMigrator>(),
    );
  });

  describe("validateSsoUserInMpEncryptionOrgHasMp", () => {
    it("fails login for SSO users without a master password and without a user key (regression for #18992)", async () => {
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        of({
          hasMasterPassword: false,
          trustedDeviceOption: { encryptedPrivateKey: "present" },
          keyConnectorOption: null,
        } as any),
      );
      keyService.hasUserKey.mockResolvedValue(false);

      await expect(
        (command as any).validateSsoUserInMpEncryptionOrgHasMp("user-id" as UserId),
      ).rejects.toMatchObject({ success: false });

      expect(logoutCallback).toHaveBeenCalled();
    });

    it("allows no-master-password SSO users when key connector is configured", async () => {
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        of({
          hasMasterPassword: false,
          trustedDeviceOption: null,
          keyConnectorOption: { keyConnectorUrl: "https://kc.example" },
        } as any),
      );

      await expect(
        (command as any).validateSsoUserInMpEncryptionOrgHasMp("user-id" as UserId),
      ).resolves.toBeUndefined();

      expect(keyService.hasUserKey).not.toHaveBeenCalled();
      expect(logoutCallback).not.toHaveBeenCalled();
    });

    it("allows login when SSO user has no master password but has a user key available", async () => {
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        of({
          hasMasterPassword: false,
          trustedDeviceOption: { encryptedPrivateKey: "present" },
          keyConnectorOption: null,
        } as any),
      );
      keyService.hasUserKey.mockResolvedValue(true);

      await expect(
        (command as any).validateSsoUserInMpEncryptionOrgHasMp("user-id" as UserId),
      ).resolves.toBeUndefined();

      expect(logoutCallback).not.toHaveBeenCalled();
    });

    it("allows login when SSO user has a master password", async () => {
      userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        of({
          hasMasterPassword: true,
          trustedDeviceOption: null,
          keyConnectorOption: null,
        } as any),
      );

      await expect(
        (command as any).validateSsoUserInMpEncryptionOrgHasMp("user-id" as UserId),
      ).resolves.toBeUndefined();

      expect(keyService.hasUserKey).not.toHaveBeenCalled();
      expect(logoutCallback).not.toHaveBeenCalled();
    });
  });
});
