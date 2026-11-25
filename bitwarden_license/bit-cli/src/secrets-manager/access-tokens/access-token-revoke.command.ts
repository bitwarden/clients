import { AccessService, BulkOperationStatus, ServiceAccountService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmBulkStatusResponse } from "../models/sm-bulk-status.response";
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
      const statuses: BulkOperationStatus[] = [];
      for (const id of parsed.ids) {
        const token = accessTokens.find((t) => t.id === id);
        if (token == null) {
          return smNotFoundResponse("access token `" + id + "`");
        }
        const status = new BulkOperationStatus();
        status.id = token.id;
        status.name = token.name;
        statuses.push(status);
      }

      await this.accessService.revokeAccessTokens(machineAccount.machineAccountId, parsed.ids);
      return Response.success(new ListResponse(statuses.map((s) => new SmBulkStatusResponse(s))));
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
