import { ServiceAccountView } from "@bitwarden/bit-common/secrets-manager/models/view/service-account.view";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmMachineAccountResponse } from "../models/sm-machine-account.response";
import {
  checkSmRequestOrganization,
  parseSmId,
  parseSmRequest,
  readSmName,
  resolveSmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class MachineAccountEditCommand {
  constructor(
    private serviceAccountService: ServiceAccountService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(
    organizationId: string,
    machineAccountId: string,
    requestJson: unknown,
  ): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
    const machineAccount = parseSmId(machineAccountId, "machineAccountId");
    if (machineAccount.error) {
      return machineAccount.error;
    }
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

    try {
      const existing = await this.serviceAccountService.getByServiceAccountId(
        machineAccount.id,
        org.organizationId,
      );
      if (existing.organizationId !== org.organizationId) {
        return smNotFoundResponse("machine account");
      }

      const view = new ServiceAccountView();
      view.id = machineAccount.id;
      view.organizationId = org.organizationId;
      view.name = name.name!;

      const updated = await this.serviceAccountService.update(
        machineAccount.id,
        org.organizationId,
        view,
      );
      return Response.success(new SmMachineAccountResponse(updated));
    } catch (e) {
      return smErrorResponse(e, "machine account");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new MachineAccountEditCommand(
      serviceContainer.serviceAccountService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
