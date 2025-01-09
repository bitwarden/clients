import { firstValueFrom } from "rxjs";

import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { OrganizationAuthRequestService } from "../../../../bit-common/src/admin-console/auth-requests";
import { ServiceContainer } from "../../service-container";

export class ApproveCommand {
  constructor(
    private organizationService: OrganizationService,
    private organizationAuthRequestService: OrganizationAuthRequestService,
  ) {}

  async run(organizationId: string, id: string): Promise<Response> {
    if (organizationId != null) {
      organizationId = organizationId.toLowerCase();
    }

    if (!Utils.isGuid(organizationId)) {
      return Response.badRequest("`" + organizationId + "` is not a GUID.");
    }

    if (id != null) {
      id = id.toLowerCase();
    }

    if (!Utils.isGuid(id)) {
      return Response.badRequest("`" + id + "` is not a GUID.");
    }

    const organization = await firstValueFrom(this.organizationService.get$(organizationId));
    if (!organization?.canManageUsersPassword) {
      return Response.error(
        "You do not have permission to approve pending device authorization requests.",
      );
    }

    try {
      const pendingRequests =
        await this.organizationAuthRequestService.listPendingRequests(organizationId);

      const request = pendingRequests.find((r) => r.id == id);
      if (request == null) {
        return Response.error("The request id is invalid.");
      }

      await this.organizationAuthRequestService.approvePendingRequest(organizationId, request);
      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new ApproveCommand(
      serviceContainer.organizationService,
      serviceContainer.organizationAuthRequestService,
    );
  }
}
