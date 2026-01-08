import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsStatus, KeyService } from "@bitwarden/key-management";
import { ConsoleLogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import { MessageResponse } from "../../models/response/message.response";
import { I18nService } from "../../platform/services/i18n.service";
import { CliBiometricsService } from "../cli-biometrics-service";
import { ConvertToKeyConnectorCommand } from "../convert-to-key-connector.command";

import { UnlockCommand } from "./unlock.command";

describe("UnlockCommand", () => {
  let command: UnlockCommand;

  const accountService = mock<AccountService>();
  const keyService = mock<KeyService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const logService = mock<ConsoleLogService>();
  const keyConnectorService = mock<KeyConnectorService>();
  const environmentService = mock<EnvironmentService>();
  const organizationApiService = mock<OrganizationApiServiceAbstraction>();
  const logout = jest.fn();
  const i18nService = mock<I18nService>();
  const encryptedMigrator = mock<EncryptedMigrator>();
  const masterPasswordUnlockService = mock<MasterPasswordUnlockService>();
  const biometricsService = mock<CliBiometricsService>();

  const mockMasterPassword = "testExample";
  const activeAccount: Account = {
    id: "user-id" as UserId,
    ...mockAccountInfoWith({
      email: "user@example.com",
      name: "User",
    }),
  };
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockSessionKey = new Uint8Array(64) as CsprngArray;
  const b64sessionKey = Utils.fromBufferToB64(mockSessionKey);
  const expectedSuccessMessage = new MessageResponse(
    "Your vault is now unlocked!",
    "\n" +
      "To unlock your vault, set your session key to the `BW_SESSION` environment variable. ex:\n" +
      '$ export BW_SESSION="' +
      b64sessionKey +
      '"\n' +
      '> $env:BW_SESSION="' +
      b64sessionKey +
      '"\n\n' +
      "You can also pass the session key to any command with the `--session` option. ex:\n" +
      "$ bw list items --session " +
      b64sessionKey,
  );
  expectedSuccessMessage.raw = b64sessionKey;

  beforeEach(async () => {
    jest.clearAllMocks();

    i18nService.t.mockImplementation((key: string) => key);
    accountService.activeAccount$ = of(activeAccount);
    keyConnectorService.convertAccountRequired$ = of(false);
    cryptoFunctionService.randomBytes.mockResolvedValue(mockSessionKey);

    // Mock biometrics to be unavailable by default (no Desktop app in tests)
    biometricsService.getBiometricsStatusForUser.mockResolvedValue(
      BiometricsStatus.DesktopDisconnected,
    );

    command = new UnlockCommand(
      accountService,
      keyService,
      cryptoFunctionService,
      logService,
      keyConnectorService,
      environmentService,
      organizationApiService,
      logout,
      i18nService,
      encryptedMigrator,
      masterPasswordUnlockService,
      biometricsService,
    );
  });

  afterEach(() => {
    // Clean up environment variables modified in tests
    delete process.env.BW_NOINTERACTION;
  });

  describe("run", () => {
    test.each([null as unknown as Account, undefined as unknown as Account])(
      "returns error response when the active account is %s",
      async (account) => {
        accountService.activeAccount$ = of(account);

        const response = await command.run(mockMasterPassword, {});

        expect(response).not.toBeNull();
        expect(response.success).toEqual(false);
        expect(response.message).toEqual("No active account found");
        expect(keyService.setUserKey).not.toHaveBeenCalled();
      },
    );

    test.each([null as unknown as string, undefined as unknown as string, ""])(
      "returns error response when the provided password is %s",
      async (mockMasterPassword) => {
        process.env.BW_NOINTERACTION = "true";

        const response = await command.run(mockMasterPassword, {});

        expect(response).not.toBeNull();
        expect(response.success).toEqual(false);
        expect(response.message).toEqual(
          "Master password is required. Try again in interactive mode or provide a password file or environment variable.",
        );
        expect(keyService.setUserKey).not.toHaveBeenCalled();
      },
    );

    it("calls masterPasswordUnlockService successfully", async () => {
      masterPasswordUnlockService.unlockWithMasterPassword.mockResolvedValue(mockUserKey);

      const response = await command.run(mockMasterPassword, {});

      expect(response).not.toBeNull();
      expect(response.success).toEqual(true);
      expect(response.data).toEqual(expectedSuccessMessage);
      expect(masterPasswordUnlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
        mockMasterPassword,
        activeAccount.id,
      );
      expect(keyService.setUserKey).toHaveBeenCalledWith(mockUserKey, activeAccount.id);
    });

    it("returns error response if unlockWithMasterPassword fails", async () => {
      masterPasswordUnlockService.unlockWithMasterPassword.mockRejectedValue(
        new Error("Unlock failed"),
      );

      const response = await command.run(mockMasterPassword, {});

      expect(response).not.toBeNull();
      expect(response.success).toEqual(false);
      expect(response.message).toEqual("Unlock failed");
      expect(masterPasswordUnlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
        mockMasterPassword,
        activeAccount.id,
      );
      expect(keyService.setUserKey).not.toHaveBeenCalled();
    });

    describe("biometric unlock flow", () => {
      beforeEach(() => {
        configService.getFeatureFlag$.mockReturnValue(of(true));
        masterPasswordUnlockService.unlockWithMasterPassword.mockResolvedValue(mockUserKey);
      });

      it("skips biometrics when password is explicitly provided", async () => {
        biometricsService.getBiometricsStatusForUser.mockResolvedValue(BiometricsStatus.Available);

        const response = await command.run(mockMasterPassword, {});

        expect(response.success).toEqual(true);
        expect(biometricsService.unlockWithBiometricsForUser).not.toHaveBeenCalled();
        expect(masterPasswordUnlockService.unlockWithMasterPassword).toHaveBeenCalled();
      });

      it("skips biometrics when BW_NOINTERACTION is true", async () => {
        process.env.BW_NOINTERACTION = "true";
        biometricsService.getBiometricsStatusForUser.mockResolvedValue(BiometricsStatus.Available);

        const response = await command.run(mockMasterPassword, {});

        expect(response.success).toEqual(true);
        expect(biometricsService.unlockWithBiometricsForUser).not.toHaveBeenCalled();
      });

      it("skips biometrics when not available", async () => {
        process.env.BW_NOINTERACTION = "true";
        biometricsService.getBiometricsStatusForUser.mockResolvedValue(
          BiometricsStatus.DesktopDisconnected,
        );

        const response = await command.run(mockMasterPassword, {});

        expect(response.success).toEqual(true);
        expect(biometricsService.unlockWithBiometricsForUser).not.toHaveBeenCalled();
      });
    });

    describe("calls convertToKeyConnectorCommand if required", () => {
      let convertToKeyConnectorSpy: jest.SpyInstance;
      beforeEach(() => {
        keyConnectorService.convertAccountRequired$ = of(true);
        masterPasswordUnlockService.unlockWithMasterPassword.mockResolvedValue(mockUserKey);
      });

      it("returns error on failure", async () => {
        // Mock the ConvertToKeyConnectorCommand
        const mockRun = jest.fn().mockResolvedValue({ success: false, message: "convert failed" });
        convertToKeyConnectorSpy = jest
          .spyOn(ConvertToKeyConnectorCommand.prototype, "run")
          .mockImplementation(mockRun);

        const response = await command.run(mockMasterPassword, {});

        expect(response).not.toBeNull();
        expect(response.success).toEqual(false);
        expect(response.message).toEqual("convert failed");
        expect(keyService.setUserKey).toHaveBeenCalledWith(mockUserKey, activeAccount.id);
        expect(convertToKeyConnectorSpy).toHaveBeenCalled();

        expect(masterPasswordUnlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
          mockMasterPassword,
          activeAccount.id,
        );
      });

      it("returns success on successful conversion", async () => {
        // Mock the ConvertToKeyConnectorCommand
        const mockRun = jest.fn().mockResolvedValue({ success: true });
        const convertToKeyConnectorSpy = jest
          .spyOn(ConvertToKeyConnectorCommand.prototype, "run")
          .mockImplementation(mockRun);

        const response = await command.run(mockMasterPassword, {});

        expect(response).not.toBeNull();
        expect(response.success).toEqual(true);
        expect(response.data).toEqual(expectedSuccessMessage);
        expect(keyService.setUserKey).toHaveBeenCalledWith(mockUserKey, activeAccount.id);
        expect(convertToKeyConnectorSpy).toHaveBeenCalled();

        expect(masterPasswordUnlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
          mockMasterPassword,
          activeAccount.id,
        );
      });
    });
  });
});
