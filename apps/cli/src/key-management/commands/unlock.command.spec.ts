import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { ConsoleLogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import { MessageResponse } from "../../models/response/message.response";
import { I18nService } from "../../platform/services/i18n.service";
import { ConvertToKeyConnectorCommand } from "../convert-to-key-connector.command";

import { UnlockCommand } from "./unlock.command";

describe("UnlockCommand", () => {
  let command: UnlockCommand;

  const accountService = mock<AccountService>();
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
  const keyService = mock<KeyService>();
  const userVerificationService = mock<UserVerificationService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const logService = mock<ConsoleLogService>();
  const keyConnectorService = mock<KeyConnectorService>();
  const environmentService = mock<EnvironmentService>();
  const organizationApiService = mock<OrganizationApiServiceAbstraction>();
  const logout = jest.fn();
  const i18nService = mock<I18nService>();
  const masterPasswordUnlockService = mock<MasterPasswordUnlockService>();
  const configService = mock<ConfigService>();

  const mockMasterPassword = "testExample";
  const activeAccount: Account = {
    id: "user-id" as UserId,
    email: "user@example.com",
    emailVerified: true,
    name: "User",
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

    command = new UnlockCommand(
      accountService,
      masterPasswordService,
      keyService,
      userVerificationService,
      cryptoFunctionService,
      logService,
      keyConnectorService,
      environmentService,
      organizationApiService,
      logout,
      i18nService,
      masterPasswordUnlockService,
      configService,
    );
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

    describe("ForceUpdateKDFSettings feature flag enabled", () => {
      beforeEach(() => {
        configService.getFeatureFlag$.mockReturnValue(of(true));
      });

      it("calls masterPasswordUnlockService successfully", async () => {
        masterPasswordUnlockService.unlockWithMasterPassword.mockResolvedValue(mockUserKey);

        const response = await command.run(mockMasterPassword, {});

        expect(response).not.toBeNull();
        expect(response.success).toEqual(true);
        expect(response.data).toEqual(expectedSuccessMessage);
        expect(masterPasswordUnlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
          mockMasterPassword,
          activeAccount,
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
          activeAccount,
        );
        expect(keyService.setUserKey).not.toHaveBeenCalled();
      });

      it("calls convertToKeyConnectorCommand if required and returns failure", async () => {
        masterPasswordUnlockService.unlockWithMasterPassword.mockResolvedValue(mockUserKey);
        keyConnectorService.convertAccountRequired$ = of(true);

        // Mock the ConvertToKeyConnectorCommand
        const mockRun = jest.fn().mockResolvedValue({ success: false, message: "convert failed" });
        jest.spyOn(ConvertToKeyConnectorCommand.prototype, "run").mockImplementation(mockRun);

        const response = await command.run(mockMasterPassword, {});

        expect(response).not.toBeNull();
        expect(response.success).toEqual(false);
        expect(response.message).toEqual("convert failed");
        expect(masterPasswordUnlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
          mockMasterPassword,
          activeAccount,
        );
        expect(keyService.setUserKey).toHaveBeenCalledWith(mockUserKey, activeAccount.id);
      });

      it("calls convertToKeyConnectorCommand if required and returns expected success", async () => {
        masterPasswordUnlockService.unlockWithMasterPassword.mockResolvedValue(mockUserKey);
        keyConnectorService.convertAccountRequired$ = of(true);

        // Mock the ConvertToKeyConnectorCommand
        const mockRun = jest.fn().mockResolvedValue({ success: true });
        jest.spyOn(ConvertToKeyConnectorCommand.prototype, "run").mockImplementation(mockRun);

        const response = await command.run(mockMasterPassword, {});

        expect(response).not.toBeNull();
        expect(response.success).toEqual(true);
        expect(response.data).toEqual(expectedSuccessMessage);
        expect(masterPasswordUnlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
          mockMasterPassword,
          activeAccount,
        );
        expect(keyService.setUserKey).toHaveBeenCalledWith(mockUserKey, activeAccount.id);
      });
    });
  });
});
