import { SecretService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import { SmOrganization, smErrorResponse } from "../sm-command.utils";

import { selectTrashedSecrets, SmTrashSelection, trashResultResponse } from "./trash-selection";

export class TrashEmptyCommand {
  constructor(private secretService: SecretService) {}

  async run(org: SmOrganization, selection: SmTrashSelection): Promise<Response> {
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
    return new TrashEmptyCommand(serviceContainer.secretService);
  }
}
