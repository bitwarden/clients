import * as inquirer from "inquirer";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { Response } from "../models/response";
import { MessageResponse } from "../models/response/message.response";

export class ConfirmKeyConnectorDomainCommand {
  constructor(
    private readonly userId: UserId,
    private readonly keyConnectorUrl: string,
    private readonly organizationSsoIdentifier: string,
    private keyConnectorService: KeyConnectorService,
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
          this.i18nService.t("organizationUsingKeyConnectorConfirmLoggedOut"),
          null,
        ),
      );
    }

    const answer: inquirer.Answers = await inquirer.createPromptModule({ output: process.stderr })({
      type: "list",
      name: "confirm",
      message: this.i18nService.t("confirmKeyConnectorDomain", this.keyConnectorUrl),
      choices: [
        {
          name: this.i18nService.t("confirm"),
          value: "confirmed",
        },
        {
          name: this.i18nService.t("logOut"),
          value: "cancel",
        },
      ],
    });

    if (answer.confirm === "confirmed") {
      try {
        const autoEnrollStatus = await this.organizationApiService.getAutoEnrollStatus(
          this.organizationSsoIdentifier,
        );
        // The CLI stores no organization invites and shows no invite message, so it does not use
        // the returned invite result.
        await this.keyConnectorService.convertNewSsoUserToKeyConnector(
          this.userId,
          autoEnrollStatus.id as OrganizationId,
        );
      } catch (e) {
        await this.logout();
        throw e;
      }

      return Response.success();
    } else {
      await this.logout();
      return Response.error(this.i18nService.t("youHaveBeenLoggedOut"));
    }
  }
}
