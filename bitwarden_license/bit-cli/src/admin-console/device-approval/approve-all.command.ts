// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { OrganizationAuthRequestService } from "@bitwarden/bit-common/admin-console/auth-requests";
import { Response } from "@bitwarden/cli/models/response";
import { MessageResponse } from "@bitwarden/cli/models/response/message.response";
import { OrganizationService } from "@bitwarden/common/admin-console/services/organization/organization.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { ServiceContainer } from "../../service-container";

export class ApproveAllCommand {
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
      const pendingApprovals =
        await this.organizationAuthRequestService.listPendingRequests(organizationId);
      if (pendingApprovals.length == 0) {
        const res = new MessageResponse(
          "No pending device authorization requests to approve.",
          null,
        );
        return Response.success(res);
      }

      await this.organizationAuthRequestService.approvePendingRequests(
        organizationId,
        pendingApprovals,
      );

      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new ApproveAllCommand(
      serviceContainer.organizationAuthRequestService,
      serviceContainer.organizationService,
    );
  }
}
