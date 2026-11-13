import { ServiceAccountService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import {
  parseSmIds,
  SmOrganization,
  smBulkResponse,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class MachineAccountDeleteCommand {
  constructor(private serviceAccountService: ServiceAccountService) {}

  async run(org: SmOrganization, machineAccountIds: string[]): Promise<Response> {
    const parsed = parseSmIds(machineAccountIds, "machineAccountId");
    if (parsed.error) {
      return parsed.error;
    }

    try {
      const machineAccounts = await this.serviceAccountService.getServiceAccounts(
        org.organizationId,
      );
      const toDelete = [];
      for (const id of parsed.ids) {
        const machineAccount = machineAccounts.find((m) => m.id === id);
        if (machineAccount == null) {
          return smNotFoundResponse("machine account `" + id + "`");
        }
        toDelete.push(machineAccount);
      }

      const results = await this.serviceAccountService.delete(toDelete);
      return smBulkResponse(results, "deleted");
    } catch (e) {
      return smErrorResponse(e, "machine account");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new MachineAccountDeleteCommand(serviceContainer.serviceAccountService);
  }
}
