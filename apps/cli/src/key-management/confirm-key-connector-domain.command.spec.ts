import { createPromptModule } from "inquirer";
import { mock } from "jest-mock-extended";

import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { UserId } from "@bitwarden/common/types/guid";

import { Response } from "../models/response";
import { MessageResponse } from "../models/response/message.response";
import { I18nService } from "../platform/services/i18n.service";

import { ConfirmKeyConnectorDomainCommand } from "./confirm-key-connector-domain.command";

jest.mock("inquirer", () => {
  return {
    createPromptModule: jest.fn(() => jest.fn(() => Promise.resolve({ confirm: "" }))),
  };
});

describe("ConfirmKeyConnectorDomainCommand", () => {
  let command: ConfirmKeyConnectorDomainCommand;

  const userId = "test-user-id" as UserId;
  const keyConnectorUrl = "https://keyconnector.example.com";

  const keyConnectorService = mock<KeyConnectorService>();
  const logout = jest.fn();
  const i18nService = mock<I18nService>();

  beforeEach(async () => {
    command = new ConfirmKeyConnectorDomainCommand(
      userId,
      keyConnectorUrl,
      keyConnectorService,
      logout,
      i18nService,
    );

    i18nService.t.mockImplementation((key: string) => {
      switch (key) {
        case "confirmKeyConnectorDomain":
          return "Please confirm the domain below with your organization administrator. Key Connector domain: https://keyconnector.example.com";
        case "confirm":
          return "Confirm";
        case "logOut":
          return "Log out";
        case "youHaveBeenLoggedOut":
          return "You have been logged out.";
        case "organizationUsingKeyConnectorConfirmLoggedOut":
          return "An organization you are a member of is using Key Connector. In order to access the vault, you must confirm the Key Connector domain now via the web vault. You have been logged out.";
        default:
          return "";
      }
    });
  });

  describe("run", () => {
    it("should logout and return error response if no interaction available", async () => {
      process.env.BW_NOINTERACTION = "true";

      const response = await command.run();

      expect(response).not.toBeNull();
      expect(response.success).toEqual(false);
      expect(response).toEqual(
        Response.error(
          new MessageResponse(
            "An organization you are a member of is using Key Connector. In order to access the vault, you must confirm the Key Connector domain now via the web vault. You have been logged out.",
            null,
          ),
        ),
      );
      expect(logout).toHaveBeenCalled();
    });

    it("should logout and return error response if interaction answer is cancel", async () => {
      process.env.BW_NOINTERACTION = "false";

      (createPromptModule as jest.Mock).mockImplementation(() =>
        jest.fn((prompt) => {
          assertPrompt(prompt);
          return Promise.resolve({ confirm: "cancel" });
        }),
      );

      const response = await command.run();

      expect(response).not.toBeNull();
      expect(response.success).toEqual(false);
      expect(response).toEqual(Response.error("You have been logged out."));
      expect(logout).toHaveBeenCalled();
    });

    it("should convert new sso user to key connector and return success response if answer is confirmed", async () => {
      process.env.BW_NOINTERACTION = "false";

      (createPromptModule as jest.Mock).mockImplementation(() =>
        jest.fn((prompt) => {
          assertPrompt(prompt);
          return Promise.resolve({ confirm: "confirmed" });
        }),
      );

      const response = await command.run();

      expect(response).not.toBeNull();
      expect(response.success).toEqual(true);
      expect(keyConnectorService.convertNewSsoUserToKeyConnector).toHaveBeenCalledWith(userId);
    });

    it("should logout and throw error if convert new sso user to key connector failed", async () => {
      process.env.BW_NOINTERACTION = "false";

      (createPromptModule as jest.Mock).mockImplementation(() =>
        jest.fn((prompt) => {
          assertPrompt(prompt);
          return Promise.resolve({ confirm: "confirmed" });
        }),
      );

      keyConnectorService.convertNewSsoUserToKeyConnector.mockRejectedValue(
        new Error("Migration failed"),
      );

      await expect(command.run()).rejects.toThrow("Migration failed");
      expect(logout).toHaveBeenCalled();
    });

    function assertPrompt(prompt: unknown) {
      expect(typeof prompt).toEqual("object");
      expect(prompt).toHaveProperty("type");
      expect(prompt).toHaveProperty("name");
      expect(prompt).toHaveProperty("message");
      expect(prompt).toHaveProperty("choices");
      const promptObj = prompt as Record<string, unknown>;
      expect(promptObj["type"]).toEqual("list");
      expect(promptObj["name"]).toEqual("confirm");
      expect(promptObj["message"]).toEqual(
        `Please confirm the domain below with your organization administrator. Key Connector domain: ${keyConnectorUrl}`,
      );
      expect(promptObj["choices"]).toBeInstanceOf(Array);
      const choices = promptObj["choices"] as Array<Record<string, unknown>>;
      expect(choices).toHaveLength(2);
      expect(choices[0]).toEqual({
        name: "Confirm",
        value: "confirmed",
      });
      expect(choices[1]).toEqual({
        name: "Log out",
        value: "cancel",
      });
    }
  });
});
