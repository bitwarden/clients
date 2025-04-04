import * as inquirer from "inquirer";
import { firstValueFrom } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import {
  EnvironmentService,
  Region,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { UserId } from "@bitwarden/common/types/guid";

import { Response } from "../models/response";
import { MessageResponse } from "../models/response/message.response";

export class ConvertToKeyConnectorCommand {
  constructor(
    private readonly userId: UserId,
    private keyConnectorService: KeyConnectorService,
    private environmentService: EnvironmentService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private logout: () => Promise<void>,
  ) {}

  async run(): Promise<Response> {
    // If no interaction available, alert user to use web vault
    const canInteract = process.env.BW_NOINTERACTION !== "true";
    if (!canInteract) {
      await this.logout();
      return Response.error(
        new MessageResponse(
          "An organization you are a member of is using Key Connector. " +
            "In order to access the vault, you must opt-in to Key Connector now via the web vault. You have been logged out.",
          null,
        ),
      );
    }

    const organization = await this.keyConnectorService.getManagingOrganization(this.userId);

    const answer: inquirer.Answers = await inquirer.createPromptModule({ output: process.stderr })({
      type: "list",
      name: "convert",
      message:
        organization.name +
        " is using a self-hosted key server. A master password is no longer required to log in for members of this organization. ",
      choices: [
        {
          name: "Remove master password and unlock",
          value: "remove",
        },
        {
          name: "Leave organization and unlock",
          value: "leave",
        },
        {
          name: "Log out",
          value: "exit",
        },
      ],
    });

    if (answer.convert === "remove") {
      try {
        await this.keyConnectorService.migrateUser(this.userId);
      } catch (e) {
        await this.logout();
        throw e;
      }

      // Update environment URL - required for api key login
      const env = await firstValueFrom(this.environmentService.environment$);
      const urls = env.getUrls();
      urls.keyConnector = organization.keyConnectorUrl;
      await this.environmentService.setEnvironment(Region.SelfHosted, urls);

      return Response.success();
    } else if (answer.convert === "leave") {
      await this.organizationApiService.leave(organization.id);
      return Response.success();
    } else {
      await this.logout();
      return Response.error("You have been logged out.");
    }
  }
}
