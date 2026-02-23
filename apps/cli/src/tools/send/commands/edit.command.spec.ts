// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { UserId } from "@bitwarden/user-core";

import { Response } from "../../../models/response";
import { SendResponse } from "../models/send.response";

import { SendEditCommand } from "./edit.command";
import { SendGetCommand } from "./get.command";

describe("SendEditCommand", () => {
  let command: SendEditCommand;

  const sendService = mock<SendService>();
  const getCommand = mock<SendGetCommand>();
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

  const mockSendId = "send-123";
  const mockSendView = {
    id: mockSendId,
    type: SendType.Text,
    name: "Test Send",
    text: { text: "test content", hidden: false },
    deletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  } as SendView;

  const mockSend = {
    id: mockSendId,
    type: SendType.Text,
    decrypt: jest.fn().mockResolvedValue(mockSendView),
  };

  const encodeRequest = (data: any) => Buffer.from(JSON.stringify(data)).toString("base64");

  beforeEach(() => {
    jest.clearAllMocks();

    accountService.activeAccount$ = of(activeAccount);
    accountProfileService.hasPremiumFromAnySource$.mockReturnValue(of(false));
    sendService.getFromState.mockResolvedValue(mockSend as any);
    getCommand.run.mockResolvedValue(Response.success(new SendResponse(mockSendView)) as any);

    command = new SendEditCommand(
      sendService,
      getCommand,
      sendApiService,
      accountProfileService,
      accountService,
    );
  });

  describe("authType inference", () => {
    describe("with CLI flags", () => {
      it("should set authType to Email when emails are provided via CLI", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.Text,
          name: "Test Send",
        };
        const requestJson = encodeRequest(requestData);

        const cmdOptions = {
          emails: ["test@example.com"],
        };

        sendService.encrypt.mockResolvedValue([
          { id: mockSendId, emails: "test@example.com", authType: AuthType.Email } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.Email);
        expect(savedCall[0].emails).toBe("test@example.com");
      });

      it("should set authType to Password when password is provided via CLI", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.Text,
          name: "Test Send",
        };
        const requestJson = encodeRequest(requestData);

        const cmdOptions = {
          password: "testPassword123",
        };

        sendService.encrypt.mockResolvedValue([
          { id: mockSendId, authType: AuthType.Password } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.Password);
      });

      it("should set authType to None when neither emails nor password provided", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.Text,
          name: "Test Send",
        };
        const requestJson = encodeRequest(requestData);

        const cmdOptions = {};

        sendService.encrypt.mockResolvedValue([
          { id: mockSendId, authType: AuthType.None } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.None);
      });

      it("should return error when both emails and password provided via CLI", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.Text,
          name: "Test Send",
        };
        const requestJson = encodeRequest(requestData);

        const cmdOptions = {
          emails: ["test@example.com"],
          password: "testPassword123",
        };

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(false);
        expect(response.message).toBe("--password and --emails are mutually exclusive.");
      });
    });

    describe("with JSON input", () => {
      it("should set authType to Email when emails provided in JSON", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.Text,
          name: "Test Send",
          emails: ["test@example.com", "another@example.com"],
        };
        const requestJson = encodeRequest(requestData);

        sendService.encrypt.mockResolvedValue([
          { id: mockSendId, authType: AuthType.Email } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.Email);
      });

      it("should set authType to Password when password provided in JSON", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.Text,
          name: "Test Send",
          password: "jsonPassword123",
        };
        const requestJson = encodeRequest(requestData);

        sendService.encrypt.mockResolvedValue([
          { id: mockSendId, authType: AuthType.Password } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.Password);
      });

      it("should return error when both emails and password provided in JSON", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.Text,
          name: "Test Send",
          emails: ["test@example.com"],
          password: "jsonPassword123",
        };
        const requestJson = encodeRequest(requestData);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("--password and --emails are mutually exclusive.");
      });
    });

    describe("with mixed CLI and JSON input", () => {
      it("should return error when CLI emails combined with JSON password", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.Text,
          name: "Test Send",
          password: "jsonPassword123",
        };
        const requestJson = encodeRequest(requestData);

        const cmdOptions = {
          emails: ["cli@example.com"],
        };

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(false);
        expect(response.message).toBe("--password and --emails are mutually exclusive.");
      });

      it("should return error when CLI password combined with JSON emails", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.Text,
          name: "Test Send",
          emails: ["json@example.com"],
        };
        const requestJson = encodeRequest(requestData);

        const cmdOptions = {
          password: "cliPassword123",
        };

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(false);
        expect(response.message).toBe("--password and --emails are mutually exclusive.");
      });

      it("should prioritize CLI value when JSON has different value of same type", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.Text,
          name: "Test Send",
          emails: ["json@example.com"],
        };
        const requestJson = encodeRequest(requestData);

        const cmdOptions = {
          emails: ["cli@example.com"],
        };

        sendService.encrypt.mockResolvedValue([
          { id: mockSendId, emails: "cli@example.com", authType: AuthType.Email } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.Email);
        expect(savedCall[0].emails).toBe("cli@example.com");
      });
    });

    describe("edge cases", () => {
      it("should set authType to None when emails array is empty", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.Text,
          name: "Test Send",
          emails: [] as string[],
        };
        const requestJson = encodeRequest(requestData);

        sendService.encrypt.mockResolvedValue([
          { id: mockSendId, authType: AuthType.None } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.None);
      });

      it("should set authType to None when password is empty string", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.Text,
          name: "Test Send",
          password: "",
        };
        const requestJson = encodeRequest(requestData);

        sendService.encrypt.mockResolvedValue([
          { id: mockSendId, authType: AuthType.None } as any,
          null as any,
        ]);
        sendApiService.save.mockResolvedValue(undefined as any);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(true);
        const savedCall = sendApiService.save.mock.calls[0][0];
        expect(savedCall[0].authType).toBe(AuthType.None);
      });

      it("should handle send not found", async () => {
        sendService.getFromState.mockResolvedValue(null);

        const requestData = {
          id: "nonexistent-id",
          type: SendType.Text,
          name: "Test Send",
        };
        const requestJson = encodeRequest(requestData);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(false);
      });

      it("should handle type mismatch", async () => {
        const requestData = {
          id: mockSendId,
          type: SendType.File,
          name: "Test Send",
        };
        const requestJson = encodeRequest(requestData);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(false);
        expect(response.message).toBe("Cannot change a Send's type");
      });
    });
  });

  describe("validation", () => {
    it("should return error when requestJson is empty", async () => {
      // Set BW_SERVE to prevent readStdin call
      process.env.BW_SERVE = "true";

      const response = await command.run("", {});

      expect(response.success).toBe(false);
      expect(response.message).toBe("`requestJson` was not provided.");

      delete process.env.BW_SERVE;
    });

    it("should return error when id is not provided", async () => {
      const requestData = {
        type: SendType.Text,
        name: "Test Send",
      };
      const requestJson = encodeRequest(requestData);

      const response = await command.run(requestJson, {});

      expect(response.success).toBe(false);
      expect(response.message).toBe("`itemid` was not provided.");
    });
  });
});
