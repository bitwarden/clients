import { ServiceAccountService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import { SmMachineAccountResponse } from "../models/sm-machine-account.response";
import {
  isInSmOrganization,
  parseSmId,
  SmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class MachineAccountGetCommand {
  constructor(private serviceAccountService: ServiceAccountService) {}

  async run(org: SmOrganization, machineAccountId: string): Promise<Response> {
    const machineAccount = parseSmId(machineAccountId, "machineAccountId");
    if (machineAccount.error) {
      return machineAccount.error;
    }

    try {
      const view = await this.serviceAccountService.getByServiceAccountId(
        machineAccount.id,
        org.organizationId,
      );
      if (!isInSmOrganization(view, org)) {
        return smNotFoundResponse("machine account");
      }
      return Response.success(new SmMachineAccountResponse(view));
    } catch (e) {
      return smErrorResponse(e, "machine account");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new MachineAccountGetCommand(serviceContainer.serviceAccountService);
  }
}
