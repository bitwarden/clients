// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { UserId } from "@bitwarden/user-core";

import { SendCreateCommand } from "./create.command";

describe("SendCreateCommand", () => {
  let command: SendCreateCommand;

  const sendService = mock<SendService>();
  const environmentService = mock<EnvironmentService>();
  const sendApiService = mock<SendApiService>();
  const accountProfileService = mock<BillingAccountProfileStateService>();
  const accountService = mock<AccountService>();

  const activeAccount = {
    id: "user-id" as UserId,
    ...mockAccountInfoWith({
      email: "user@example.com",
      name: "User",
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    accountService.activeAccount$ = of(activeAccount);
    accountProfileService.hasPremiumFromAnySource$.mockReturnValue(of(false));
    environmentService.environment$ = of({
      getWebVaultUrl: () => "https://vault.bitwarden.com",
    } as any);

    command = new SendCreateCommand(
      sendService,
      environmentService,
      sendApiService,
      accountProfileService,
      accountService,
    );
  });

  describe("authType inference", () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    describe("with CLI flags", () => {
      it("should set authType to Email when emails are provided via CLI", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
        };

        const cmdOptions = {
          email: ["test@example.com"],
        };

        sendService.encrypt.mockResolvedValue([
          { id: "send-id", emails: "test@example.com", authType: AuthType.Email } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        expect(sendService.encrypt).toHaveBeenCalledWith(
          expect.objectContaining({
            type: SendType.Text,
          }),
          null,
          undefined,
        );
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.Email);
        expect(savedCall[0].emails).toBe("test@example.com");
      });

      it("should set authType to Password when password is provided via CLI", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
        };

        const cmdOptions = {
          password: "testPassword123",
        };

        sendService.encrypt.mockResolvedValue([
          { id: "send-id", authType: AuthType.Password } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        expect(sendService.encrypt).toHaveBeenCalledWith(
          expect.any(Object),
          null as any,
          "testPassword123",
        );
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.Password);
      });

      it("should set authType to None when neither emails nor password provided", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
        };

        const cmdOptions = {};

        sendService.encrypt.mockResolvedValue([
          { id: "send-id", authType: AuthType.None } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        expect(sendService.encrypt).toHaveBeenCalledWith(expect.any(Object), null, undefined);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.None);
      });

      it("should return error when both emails and password provided via CLI", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
        };

        const cmdOptions = {
          email: ["test@example.com"],
          password: "testPassword123",
        };

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(false);
        expect(response.message).toBe("--password and --emails are mutually exclusive.");
      });
    });

    describe("with JSON input", () => {
      it("should set authType to Email when emails provided in JSON", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
          emails: ["test@example.com", "another@example.com"],
        };

        sendService.encrypt.mockResolvedValue([
          {
            id: "send-id",
            emails: "test@example.com,another@example.com",
            authType: AuthType.Email,
          } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.Email);
        expect(savedCall[0].emails).toBe("test@example.com,another@example.com");
      });

      it("should set authType to Password when password provided in JSON", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
          password: "jsonPassword123",
        };

        sendService.encrypt.mockResolvedValue([
          { id: "send-id", authType: AuthType.Password } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.Password);
      });

      it("should return error when both emails and password provided in JSON", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
          emails: ["test@example.com"],
          password: "jsonPassword123",
        };

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("--password and --emails are mutually exclusive.");
      });
    });

    describe("with mixed CLI and JSON input", () => {
      it("should return error when CLI emails combined with JSON password", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
          password: "jsonPassword123",
        };

        const cmdOptions = {
          email: ["cli@example.com"],
        };

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(false);
        expect(response.message).toBe("--password and --emails are mutually exclusive.");
      });

      it("should return error when CLI password combined with JSON emails", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
          emails: ["json@example.com"],
        };

        const cmdOptions = {
          password: "cliPassword123",
        };

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(false);
        expect(response.message).toBe("--password and --emails are mutually exclusive.");
      });

      it("should use CLI value when JSON has different value of same type", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
          emails: ["json@example.com"],
        };

        const cmdOptions = {
          email: ["cli@example.com"],
        };

        sendService.encrypt.mockResolvedValue([
          { id: "send-id", emails: "cli@example.com", authType: AuthType.Email } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.Email);
        expect(savedCall[0].emails).toBe("cli@example.com");
      });
    });

    describe("edge cases", () => {
      it("should set authType to None when emails array is empty", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
          emails: [] as string[],
        };

        sendService.encrypt.mockResolvedValue([
          { id: "send-id", authType: AuthType.None } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.None);
      });

      it("should set authType to None when password is empty string", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
        };

        const cmdOptions = {
          password: "",
        };

        sendService.encrypt.mockResolvedValue([
          { id: "send-id", authType: AuthType.None } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.None);
      });

      it("should set authType to None when password is whitespace only", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
        };

        const cmdOptions = {
          password: "   ",
        };

        sendService.encrypt.mockResolvedValue([
          { id: "send-id", authType: AuthType.None } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.None);
      });
    });
  });
});
