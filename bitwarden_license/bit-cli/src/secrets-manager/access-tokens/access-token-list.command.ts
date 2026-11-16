import { AccessService, ServiceAccountService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmAccessTokenResponse } from "../models/sm-access-token.response";
import { SmOrganization, smErrorResponse } from "../sm-command.utils";

import { resolveSmMachineAccountId } from "./sm-access-token.utils";

export class AccessTokenListCommand {
  constructor(
    private accessService: AccessService,
    private serviceAccountService: ServiceAccountService,
  ) {}

  async run(org: SmOrganization, machineAccountId: string): Promise<Response> {
    const machineAccount = await resolveSmMachineAccountId(
      this.serviceAccountService,
      org.organizationId,
      machineAccountId,
    );
    if (machineAccount.error) {
      return machineAccount.error;
    }

    try {
      const accessTokens = await this.accessService.getAccessTokens(
        org.organizationId,
        machineAccount.machineAccountId,
      );
      return Response.success(
        new ListResponse(
          accessTokens.map((t) => new SmAccessTokenResponse(machineAccount.machineAccountId, t)),
        ),
      );
    } catch (e) {
      return smErrorResponse(e, "machine account");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new AccessTokenListCommand(
      serviceContainer.accessService,
      serviceContainer.serviceAccountService,
    );
  }
}
