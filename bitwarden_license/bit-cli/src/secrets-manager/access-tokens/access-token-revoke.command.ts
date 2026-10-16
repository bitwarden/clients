import { AccessService } from "@bitwarden/bit-common/secrets-manager/service-accounts/access/access.service";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import {
  parseSmIds,
  resolveSmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

import { resolveSmMachineAccountId } from "./sm-access-token.utils";

export class AccessTokenRevokeCommand {
  constructor(
    private accessService: AccessService,
    private serviceAccountService: ServiceAccountService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(
    organizationId: string,
    machineAccountId: string,
    accessTokenIds: string[],
  ): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
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
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
