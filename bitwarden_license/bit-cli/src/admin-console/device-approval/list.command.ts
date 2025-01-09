import { firstValueFrom } from "rxjs";

import { OrganizationAuthRequestService } from "@bitwarden/bit-common/admin-console/auth-requests";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { ServiceContainer } from "../../service-container";

import { PendingAuthRequestResponse } from "./pending-auth-request.response";

export class ListCommand {
  constructor(
    private organizationAuthRequestService: OrganizationAuthRequestService,
    private organizationService: OrganizationService,
  ) {}

  async run(organizationId: string): Promise<Response> {
    if (organizationId != null) {
      organizationId = organizationId.toLowerCase();
    }

    if (!Utils.isGuid(organizationId)) {
      return Response.badRequest("`" + organizationId + "` is not a GUID.");
    }

    const organization = await firstValueFrom(this.organizationService.get$(organizationId));
    if (!organization?.canManageUsersPassword) {
      return Response.error(
        "You do not have permission to approve pending device authorization requests.",
      );
    }

    try {
      const requests =
        await this.organizationAuthRequestService.listPendingRequests(organizationId);
      const res = new ListResponse(requests.map((r) => new PendingAuthRequestResponse(r)));
      return Response.success(res);
    } catch (e) {
      return Response.error(e);
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new ListCommand(
      serviceContainer.organizationAuthRequestService,
      serviceContainer.organizationService,
    );
  }
}
