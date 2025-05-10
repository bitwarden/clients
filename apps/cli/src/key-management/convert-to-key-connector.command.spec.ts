import { createPromptModule } from "inquirer";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import {
  Environment,
  EnvironmentService,
  Region,
  Urls,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { UserId } from "@bitwarden/common/types/guid";

import { Response } from "../models/response";
import { MessageResponse } from "../models/response/message.response";

import { ConvertToKeyConnectorCommand } from "./convert-to-key-connector.command";

jest.mock("inquirer", () => {
  return {
    createPromptModule: jest.fn(() => jest.fn(() => Promise.resolve({ convert: "" }))),
  };
});

describe("ConvertToKeyConnectorCommand", () => {
  let command: ConvertToKeyConnectorCommand;

  const userId = "test-user-id" as UserId;
  const organization = {
    id: "test-organization-id",
    name: "Test Organization",
    keyConnectorUrl: "https://keyconnector.example.com",
  } as Organization;

  const keyConnectorService = mock<KeyConnectorService>();
  const environmentService = mock<EnvironmentService>();
  const organizationApiService = mock<OrganizationApiServiceAbstraction>();
  const logout = jest.fn();

  beforeEach(async () => {
    command = new ConvertToKeyConnectorCommand(
      userId,
      keyConnectorService,
      environmentService,
      organizationApiService,
      logout,
    );
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
            "An organization you are a member of is using Key Connector. In order to access the vault, you must opt-in to Key Connector now via the web vault. You have been logged out.",
            null,
          ),
        ),
      );
      expect(logout).toHaveBeenCalled();
    });

    it("should logout and return error response if interaction answer is exit", async () => {
      process.env.BW_NOINTERACTION = "false";
      keyConnectorService.getManagingOrganization.mockResolvedValue(organization);

      (createPromptModule as jest.Mock).mockImplementation(() =>
        jest.fn(() => Promise.resolve({ convert: "exit" })),
      );

      const response = await command.run();

      expect(response).not.toBeNull();
      expect(response.success).toEqual(false);
      expect(response).toEqual(Response.error("You have been logged out."));
      expect(logout).toHaveBeenCalled();
    });

    it("should key connector migrate user and return success response if answer is remove", async () => {
      process.env.BW_NOINTERACTION = "false";
      keyConnectorService.getManagingOrganization.mockResolvedValue(organization);
      environmentService.environment$ = of({
        getUrls: () =>
          ({
            keyConnector: "old-key-connector-url",
          }) as Urls,
      } as Environment);

      (createPromptModule as jest.Mock).mockImplementation(() =>
        jest.fn(() => Promise.resolve({ convert: "remove" })),
      );

      const response = await command.run();

      expect(response).not.toBeNull();
      expect(response.success).toEqual(true);
      expect(keyConnectorService.migrateUser).toHaveBeenCalledWith(userId);
      expect(environmentService.setEnvironment).toHaveBeenCalledWith(Region.SelfHosted, {
        keyConnector: organization.keyConnectorUrl,
      } as Urls);
    });

    it("should logout and throw error if key connector migrate user fails", async () => {
      process.env.BW_NOINTERACTION = "false";
      keyConnectorService.getManagingOrganization.mockResolvedValue(organization);

      (createPromptModule as jest.Mock).mockImplementation(() =>
        jest.fn(() => Promise.resolve({ convert: "remove" })),
      );

      keyConnectorService.migrateUser.mockRejectedValue(new Error("Migration failed"));

      await expect(command.run()).rejects.toThrow("Migration failed");
      expect(logout).toHaveBeenCalled();
    });

    it("should leave organization and return success response if answer is leave", async () => {
      process.env.BW_NOINTERACTION = "false";
      keyConnectorService.getManagingOrganization.mockResolvedValue(organization);

      (createPromptModule as jest.Mock).mockImplementation(() =>
        jest.fn(() => Promise.resolve({ convert: "leave" })),
      );

      const response = await command.run();

      expect(response).not.toBeNull();
      expect(response.success).toEqual(true);
      expect(organizationApiService.leave).toHaveBeenCalledWith(organization.id);
    });
  });
});
