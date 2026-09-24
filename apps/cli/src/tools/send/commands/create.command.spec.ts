// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendDecryptionService } from "@bitwarden/common/tools/send/services/send-decryption.service";
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
  const policyService = mock<PolicyService>();
  const configService = mock<ConfigService>();
  const sendDecryptionService = mock<SendDecryptionService>();

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
      getSendUrl: () => "https://send.bitwarden.com/#",
    } as any);
    configService.getFeatureFlag.mockResolvedValue(false);

    command = new SendCreateCommand(
      sendService,
      environmentService,
      sendApiService,
      accountProfileService,
      accountService,
      policyService,
      configService,
      sendDecryptionService,
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
          emails: ["test@example.com"],
        };

        sendApiService.saveView.mockResolvedValue({ id: "send-id" } as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        expect(sendApiService.saveView).toHaveBeenCalledWith(
          expect.objectContaining({
            type: SendType.Text,
          }),
          null,
          undefined,
        );
        const savedView = sendApiService.saveView.mock.calls[0][0];
        expect(savedView.authType).toBe(AuthType.Email);
        expect(savedView.emails).toEqual(["test@example.com"]);
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

        sendApiService.saveView.mockResolvedValue({ id: "send-id" } as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        expect(sendApiService.saveView).toHaveBeenCalledWith(
          expect.any(Object),
          null as any,
          "testPassword123",
        );
        const savedView = sendApiService.saveView.mock.calls[0][0];
        expect(savedView.authType).toBe(AuthType.Password);
      });

      it("should set authType to None when neither emails nor password provided", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
        };

        const cmdOptions = {};

        sendApiService.saveView.mockResolvedValue({ id: "send-id" } as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        expect(sendApiService.saveView).toHaveBeenCalledWith(expect.any(Object), null, undefined);
        const savedView = sendApiService.saveView.mock.calls[0][0];
        expect(savedView.authType).toBe(AuthType.None);
      });

      it("should return error when both emails and password provided via CLI", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
        };

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
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
          emails: ["test@example.com", "another@example.com"],
        };

        sendApiService.saveView.mockResolvedValue({ id: "send-id" } as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(true);
        const savedView = sendApiService.saveView.mock.calls[0][0];
        expect(savedView.authType).toBe(AuthType.Email);
        expect(savedView.emails).toEqual(["test@example.com", "another@example.com"]);
      });

      it("should set authType to Password when password provided in JSON", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
          password: "jsonPassword123",
        };

        sendApiService.saveView.mockResolvedValue({ id: "send-id" } as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(true);
        const savedView = sendApiService.saveView.mock.calls[0][0];
        expect(savedView.authType).toBe(AuthType.Password);
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
          emails: ["cli@example.com"],
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

      // `createSend` resolves `req.emails ?? options.emails`, so the JSON value wins on create.
      // Note this is the opposite of `SendEditCommand`, where the CLI flag overrides the JSON —
      // an inconsistency between the two commands, not something this test asserts is correct.
      // The previous version of this test claimed the CLI value won, but only ever inspected a
      // hard-coded `sendService.encrypt` mock return, so it never exercised the precedence.
      it("uses the JSON value when JSON and CLI disagree on the same field", async () => {
        const requestJson = {
          type: SendType.Text,
          text: { text: "test content", hidden: false },
          deletionDate: futureDate,
          emails: ["json@example.com"],
        };

        const cmdOptions = {
          emails: ["cli@example.com"],
        };

        sendApiService.saveView.mockResolvedValue({ id: "send-id" } as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        const savedView = sendApiService.saveView.mock.calls[0][0];
        expect(savedView.authType).toBe(AuthType.Email);
        expect(savedView.emails).toEqual(["json@example.com"]);
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

        sendApiService.saveView.mockResolvedValue({ id: "send-id" } as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, {});

        expect(response.success).toBe(true);
        const savedView = sendApiService.saveView.mock.calls[0][0];
        expect(savedView.authType).toBe(AuthType.None);
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

        sendApiService.saveView.mockResolvedValue({ id: "send-id" } as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        const savedView = sendApiService.saveView.mock.calls[0][0];
        expect(savedView.authType).toBe(AuthType.None);
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

        sendApiService.saveView.mockResolvedValue({ id: "send-id" } as any);
        sendService.getFromState.mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue({}),
        } as any);

        const response = await command.run(requestJson, cmdOptions);

        expect(response.success).toBe(true);
        const savedView = sendApiService.saveView.mock.calls[0][0];
        expect(savedView.authType).toBe(AuthType.None);
      });
    });
  });

  it("with SendControls feature flag OFF, policy enforcement function is not called", async () => {
    policyService.policiesByType$.mockReturnValue(of([]));

    const requestJson = {
      type: SendType.Text,
      text: { text: "Test Send", hidden: false },
      deletionDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    sendApiService.saveView.mockResolvedValue({ id: "send-id" } as any);
    sendService.getFromState.mockResolvedValue({
      decrypt: jest.fn().mockResolvedValue({}),
    } as any);

    const response = await command.run(requestJson, {});
    expect(response.success).toEqual(true);
    expect(policyService.policiesByType$).not.toHaveBeenCalled();
  });

  describe("with SendControls feature flag ON", () => {
    it("enforces whoCanAccess with SpecificPeople and domains", async () => {
      // Turn on the SendControls policy feature flag and mock the policy
      configService.getFeatureFlag.mockResolvedValue(true);
      policyService.policiesByType$.mockReturnValue(
        of([
          {
            type: PolicyType.SendControls,
            data: {
              whoCanAccess: WhoCanAccessType.SpecificPeople,
              allowedDomains: "bitwarden.com",
            },
          } as any as Policy,
        ]),
      );

      const requestJson = {
        type: SendType.Text,
        text: { text: "Test Send", hidden: false },
        deletionDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        authType: AuthType.Email,
        emails: ["user@badguys.com"],
      };

      sendApiService.saveView.mockResolvedValue({ id: "send-id" } as any);
      sendService.getFromState.mockResolvedValue({
        decrypt: jest.fn().mockResolvedValue({}),
      } as any);

      const response = await command.run(requestJson, {});
      expect(response.success).toEqual(false);
      expect(response.message).toEqual(
        "Organization policy restricts email domains. The following emails are not allowed: user@badguys.com. Allowed domains: bitwarden.com.",
      );
    });

    it("enforces deletionHours from policy over user command input", async () => {
      // Turn on the SendControls policy feature flag and mock the policy
      configService.getFeatureFlag.mockImplementation(async (flag) => {
        return flag === FeatureFlag.SendControls;
      });
      policyService.policiesByType$.mockReturnValue(
        of([
          {
            type: PolicyType.SendControls,
            data: {
              deletionHours: 24,
            },
          } as any as Policy,
        ]),
      );

      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const requestJson = {
        type: SendType.Text,
        text: { text: "Test Send", hidden: false },
        deletionDate: threeDaysFromNow,
      };
      const cmdOptions = {
        deleteInDays: 3,
      };

      sendApiService.saveView.mockResolvedValue({ id: "send-id" } as any);
      sendService.getFromState.mockResolvedValue({
        decrypt: jest.fn().mockResolvedValue({}),
      } as any);

      const response = await command.run(requestJson, cmdOptions);
      expect(response.success).toEqual(true);
      const savedSendView = sendApiService.saveView.mock.calls[0][0];
      // We expect the deletion date to have been set to 24 hours from now, plus or minus a minute for clock skew
      expect(
        Math.abs(savedSendView.deletionDate.getTime() - 24 * 60 * 60 * 1000 - Date.now()),
      ).toBeLessThan(60 * 1000);
    });
  });
});
