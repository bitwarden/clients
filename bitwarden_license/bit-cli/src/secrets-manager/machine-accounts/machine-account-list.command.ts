import { ServiceAccountService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmMachineAccountResponse } from "../models/sm-machine-account.response";
import { SmOrganization, smErrorResponse } from "../sm-command.utils";

export class MachineAccountListCommand {
  constructor(private serviceAccountService: ServiceAccountService) {}

  async run(org: SmOrganization): Promise<Response> {
    try {
      const machineAccounts = await this.serviceAccountService.getServiceAccounts(
        org.organizationId,
        true,
      );
      return Response.success(
        new ListResponse(machineAccounts.map((m) => new SmMachineAccountResponse(m))),
      );
    } catch (e) {
      return smErrorResponse(e, "organization");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new MachineAccountListCommand(serviceContainer.serviceAccountService);
  }
}
