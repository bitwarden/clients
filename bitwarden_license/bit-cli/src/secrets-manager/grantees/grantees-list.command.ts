import { AccessPolicyService } from "@bitwarden/bit-common/secrets-manager/shared/access-policies/access-policy.service";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmGranteeResponse } from "../models/sm-grantee.response";
import { resolveSmOrganization, smErrorResponse } from "../sm-command.utils";

export const SmGranteeKinds = ["people", "machine-accounts", "projects"] as const;
export type SmGranteeKind = (typeof SmGranteeKinds)[number];

export class GranteesListCommand {
  constructor(
    private accessPolicyService: AccessPolicyService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, kind: string): Promise<Response> {
    if (!SmGranteeKinds.includes(kind as SmGranteeKind)) {
      return Response.badRequest(
        "Unknown grantee type `" + kind + "`. Expected one of: " + SmGranteeKinds.join(", ") + ".",
      );
    }

    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }

    try {
      const grantees = await this.getGrantees(org.organizationId, kind as SmGranteeKind);
      return Response.success(new ListResponse(grantees.map((g) => new SmGranteeResponse(g))));
    } catch (e) {
      return smErrorResponse(e, "organization");
    }
  }

  private getGrantees(organizationId: string, kind: SmGranteeKind) {
    switch (kind) {
      case "people":
        return this.accessPolicyService.getPeoplePotentialGrantees(organizationId);
      case "machine-accounts":
        return this.accessPolicyService.getServiceAccountsPotentialGrantees(organizationId);
      case "projects":
        return this.accessPolicyService.getProjectsPotentialGrantees(organizationId);
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new GranteesListCommand(
      serviceContainer.accessPolicyService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
