import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmMachineAccountResponse } from "../models/sm-machine-account.response";
import { resolveSmOrganization, smErrorResponse } from "../sm-command.utils";

export class MachineAccountListCommand {
  constructor(
    private serviceAccountService: ServiceAccountService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }

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
    return new MachineAccountListCommand(
      serviceContainer.serviceAccountService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
