import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptedMigrator } from "@bitwarden/common/key-management/encrypted-migrator/encrypted-migrator.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { ConsoleLogService } from "@bitwarden/logging";
import { UnlockService } from "@bitwarden/unlock";
import { UserId } from "@bitwarden/user-core";

import { MessageResponse } from "../../models/response/message.response";
import { I18nService } from "../../platform/services/i18n.service";
import { ConvertToKeyConnectorCommand } from "../convert-to-key-connector.command";

import { UnlockCommand } from "./unlock.command";

describe("UnlockCommand", () => {
  let command: UnlockCommand;

  const accountService = mock<AccountService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const logService = mock<ConsoleLogService>();
  const keyConnectorService = mock<KeyConnectorService>();
  const environmentService = mock<EnvironmentService>();
  const organizationApiService = mock<OrganizationApiServiceAbstraction>();
  const logout = jest.fn();
  const i18nService = mock<I18nService>();
  const encryptedMigrator = mock<EncryptedMigrator>();
  const unlockService = mock<UnlockService>();

  const mockMasterPassword = "testExample";
  const activeAccount: Account = {
    id: "user-id" as UserId,
    ...mockAccountInfoWith({
      email: "user@example.com",
      name: "User",
    }),
  };
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
      cryptoFunctionService,
      logService,
      keyConnectorService,
      environmentService,
      organizationApiService,
      logout,
      i18nService,
      encryptedMigrator,
      unlockService,
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
        expect(unlockService.unlockWithMasterPassword).not.toHaveBeenCalled();
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
        expect(unlockService.unlockWithMasterPassword).not.toHaveBeenCalled();
      },
    );

    it("calls unlockService successfully", async () => {
      unlockService.unlockWithMasterPassword.mockResolvedValue(undefined);

      const response = await command.run(mockMasterPassword, {});

      expect(response).not.toBeNull();
      expect(response.success).toEqual(true);
      expect(response.data).toEqual(expectedSuccessMessage);
      expect(unlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
        activeAccount.id,
        mockMasterPassword,
      );
    });

    it("returns error response if unlockWithMasterPassword fails", async () => {
      unlockService.unlockWithMasterPassword.mockRejectedValue(new Error("Unlock failed"));

      const response = await command.run(mockMasterPassword, {});

      expect(response).not.toBeNull();
      expect(response.success).toEqual(false);
      expect(response.message).toEqual("Unlock failed");
      expect(unlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
        activeAccount.id,
        mockMasterPassword,
      );
    });

    describe("calls convertToKeyConnectorCommand if required", () => {
      let convertToKeyConnectorSpy: jest.SpyInstance;
      beforeEach(() => {
        keyConnectorService.convertAccountRequired$ = of(true);
        unlockService.unlockWithMasterPassword.mockResolvedValue(undefined);
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
        expect(convertToKeyConnectorSpy).toHaveBeenCalled();

        expect(unlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
          activeAccount.id,
          mockMasterPassword,
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
        expect(convertToKeyConnectorSpy).toHaveBeenCalled();

        expect(unlockService.unlockWithMasterPassword).toHaveBeenCalledWith(
          activeAccount.id,
          mockMasterPassword,
        );
      });
    });
  });
});
