import { ServiceAccountService, ServiceAccountView } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import { SmMachineAccountResponse } from "../models/sm-machine-account.response";
import {
  checkSmRequestOrganization,
  parseSmRequest,
  readSmName,
  SmOrganization,
  smErrorResponse,
} from "../sm-command.utils";

export class MachineAccountCreateCommand {
  constructor(private serviceAccountService: ServiceAccountService) {}

  async run(org: SmOrganization, requestJson: unknown): Promise<Response> {
    const parsed = await parseSmRequest<Record<string, unknown>>(requestJson);
    if (parsed.error) {
      return parsed.error;
    }
    const orgMismatch = checkSmRequestOrganization(
      org.organizationId,
      parsed.request.organizationId,
    );
    if (orgMismatch) {
      return orgMismatch;
    }
    const name = readSmName(parsed.request);
    if (name.error) {
      return name.error;
    }

    const view = new ServiceAccountView();
    view.organizationId = org.organizationId;
    view.name = name.name!;

    try {
      const machineAccount = await this.serviceAccountService.create(org.organizationId, view);
      return Response.success(new SmMachineAccountResponse(machineAccount));
    } catch (e) {
      return smErrorResponse(e, "organization");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new MachineAccountCreateCommand(serviceContainer.serviceAccountService);
  }
}
