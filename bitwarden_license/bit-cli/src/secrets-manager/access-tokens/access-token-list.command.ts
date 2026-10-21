import { AccessService } from "@bitwarden/bit-common/secrets-manager/service-accounts/access/access.service";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmAccessTokenResponse } from "../models/sm-access-token.response";
import { resolveSmOrganization, smErrorResponse } from "../sm-command.utils";

import { resolveSmMachineAccountId } from "./sm-access-token.utils";

export class AccessTokenListCommand {
  constructor(
    private accessService: AccessService,
    private serviceAccountService: ServiceAccountService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, machineAccountId: string): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
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
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
