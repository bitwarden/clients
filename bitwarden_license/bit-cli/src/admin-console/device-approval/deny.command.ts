import { firstValueFrom, map } from "rxjs";

import { OrganizationAuthRequestService } from "@bitwarden/bit-common/admin-console/auth-requests";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { ServiceContainer } from "../../service-container";

export class DenyCommand {
  constructor(
    private organizationService: OrganizationService,
    private organizationAuthRequestService: OrganizationAuthRequestService,
    private accountServcie: AccountService,
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

    const userId = await firstValueFrom(this.accountServcie.activeAccount$.pipe(map((a) => a?.id)));

    if (!userId) {
      return Response.badRequest("No user found.");
    }

    const organization = await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(map((organizations) => organizations.find((o) => o.id === organizationId))),
    );
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

      await this.organizationAuthRequestService.denyPendingRequest(organizationId, id);
      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new DenyCommand(
      serviceContainer.organizationService,
      serviceContainer.organizationAuthRequestService,
      serviceContainer.accountService,
    );
  }
}
