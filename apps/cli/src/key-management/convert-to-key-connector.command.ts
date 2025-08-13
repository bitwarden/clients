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
import { I18nService } from "../platform/services/i18n.service";

export class ConvertToKeyConnectorCommand {
  constructor(
    private readonly userId: UserId,
    private keyConnectorService: KeyConnectorService,
    private environmentService: EnvironmentService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private logout: () => Promise<void>,
    private i18nService: I18nService,
  ) {}

  async run(): Promise<Response> {
    // If no interaction available, alert user to use web vault
    const canInteract = process.env.BW_NOINTERACTION !== "true";
    if (!canInteract) {
      await this.logout();
      return Response.error(
        new MessageResponse(
          this.i18nService.t("organizationUsingKeyConnectorOptInLoggedOut"),
          null,
        ),
      );
    }

    const organization = await this.keyConnectorService.getManagingOrganization(this.userId);

    const answer: inquirer.Answers = await inquirer.createPromptModule({ output: process.stderr })({
      type: "list",
      name: "convert",
      message: this.i18nService.t(
        "removeMasterPasswordForOrganizationUserKeyConnector",
        organization.name,
        organization.keyConnectorUrl,
      ),
      choices: [
        {
          name: this.i18nService.t("removeMasterPasswordAndUnlock"),
          value: "remove",
        },
        {
          name: this.i18nService.t("leaveOrganizationAndUnlock"),
          value: "leave",
        },
        {
          name: this.i18nService.t("logOut"),
          value: "exit",
        },
      ],
    });

    if (answer.convert === "remove") {
      try {
        await this.keyConnectorService.migrateUser(organization.keyConnectorUrl, this.userId);
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
      return Response.error(this.i18nService.t("youHaveBeenLoggedOut"));
    }
  }
}
