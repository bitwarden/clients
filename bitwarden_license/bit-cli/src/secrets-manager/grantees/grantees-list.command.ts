import { AccessPolicyService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmGranteeResponse } from "../models/sm-grantee.response";
import { SmOrganization, smErrorResponse } from "../sm-command.utils";

export const SmGranteeKinds = ["people", "machine-accounts", "projects"] as const;
export type SmGranteeKind = (typeof SmGranteeKinds)[number];

export class GranteesListCommand {
  constructor(private accessPolicyService: AccessPolicyService) {}

  async run(org: SmOrganization, kind: string): Promise<Response> {
    if (!SmGranteeKinds.includes(kind as SmGranteeKind)) {
      return Response.badRequest(
        "Unknown grantee type `" + kind + "`. Expected one of: " + SmGranteeKinds.join(", ") + ".",
      );
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
    return new GranteesListCommand(serviceContainer.accessPolicyService);
  }
}
