import { AccessService, ServiceAccountService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import {
  parseSmIds,
  SmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

import { resolveSmMachineAccountId } from "./sm-access-token.utils";

export class AccessTokenRevokeCommand {
  constructor(
    private accessService: AccessService,
    private serviceAccountService: ServiceAccountService,
  ) {}

  async run(
    org: SmOrganization,
    machineAccountId: string,
    accessTokenIds: string[],
  ): Promise<Response> {
    const parsed = parseSmIds(accessTokenIds, "accessTokenId");
    if (parsed.error) {
      return parsed.error;
    }
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
      for (const id of parsed.ids) {
        if (!accessTokens.some((t) => t.id === id)) {
          return smNotFoundResponse("access token `" + id + "`");
        }
      }

      await this.accessService.revokeAccessTokens(machineAccount.machineAccountId, parsed.ids);
      return Response.success();
    } catch (e) {
      return smErrorResponse(e, "machine account");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new AccessTokenRevokeCommand(
      serviceContainer.accessService,
      serviceContainer.serviceAccountService,
    );
  }
}
