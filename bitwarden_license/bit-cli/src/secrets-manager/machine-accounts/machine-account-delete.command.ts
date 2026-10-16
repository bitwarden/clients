import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import {
  parseSmIds,
  resolveSmOrganization,
  smBulkResponse,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class MachineAccountDeleteCommand {
  constructor(
    private serviceAccountService: ServiceAccountService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, machineAccountIds: string[]): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
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
    return new MachineAccountDeleteCommand(
      serviceContainer.serviceAccountService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
