import { SecretService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { validateSmOrganizationAccess, smErrorResponse } from "../sm-command.utils";

import { selectTrashedSecrets, SmTrashSelection, trashResultResponse } from "./trash-selection";

export class TrashEmptyCommand {
  constructor(
    private secretService: SecretService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, selection: SmTrashSelection): Promise<Response> {
    const org = await validateSmOrganizationAccess(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
    const hasNoSecretIds = selection.secretIds == null || selection.secretIds.length === 0;
    if (!selection.all && hasNoSecretIds) {
      return Response.badRequest("Provide one or more secret ids, or `--all`.");
    }

    try {
      const trashed = await this.secretService.getTrashedSecrets(org.organizationId);
      const selected = selectTrashedSecrets(trashed, selection);
      if (selected.error) {
        return selected.error;
      }

      if (selected.secrets.length > 0) {
        await this.secretService.deleteTrashed(
          org.organizationId,
          selected.secrets.map((s) => s.id),
        );
      }
      return trashResultResponse(selected.secrets);
    } catch (e) {
      return smErrorResponse(e, "organization");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new TrashEmptyCommand(
      serviceContainer.secretService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
