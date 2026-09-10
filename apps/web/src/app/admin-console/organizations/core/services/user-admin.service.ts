import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserInviteRequest,
  OrganizationUserService,
  OrganizationUserUpdateRequest,
} from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Guid, OrganizationId } from "@bitwarden/common/types/guid";

import { OrganizationUserAdminView } from "../views/organization-user-admin-view";

// Provided in root, not CoreOrganizationModule: standalone components (EditMemberDialogComponent)
// resolve against the root injector, not the organization module's, so a module-scoped provider is
// not visible to them. Matches GroupApiService in this folder. Both dependencies below are
// provided by the eager CoreModule.
@Injectable({ providedIn: "root" })
export class UserAdminService {
  constructor(
    private organizationUserApiService: OrganizationUserApiService,
    private organizationUserService: OrganizationUserService,
  ) {}

  async get(
    organizationId: OrganizationId,
    organizationUserId: string,
  ): Promise<OrganizationUserAdminView | undefined> {
    const userResponse = await this.organizationUserApiService.getOrganizationUser(
      organizationId,
      organizationUserId,
      {
        includeGroups: true,
      },
    );

    if (userResponse == null) {
      return undefined;
    }

    return OrganizationUserAdminView.fromResponse(organizationId, userResponse);
  }

  // TODO: Remove this wrapper once MemberDialogComponent (the old dialog) is deleted.
  // Callers should use saveV2() directly with an OrganizationUserUpdateRequest.
  async save(userView: OrganizationUserAdminView, organization: Organization): Promise<void> {
    const request = new OrganizationUserUpdateRequest({
      type: userView.type,
      permissions: userView.permissions,
      collections: userView.collections,
      groups: userView.groups,
      accessSecretsManager: userView.accessSecretsManager,
    });

    await this.saveV2(request, userView.id, organization);
  }

  async saveV2(
    request: OrganizationUserUpdateRequest,
    organizationUserId: Guid,
    organization: Organization,
  ): Promise<void> {
    await firstValueFrom(
      this.organizationUserService.updateUser(organization, organizationUserId, request),
    );
  }

  async invite(emails: string[], user: OrganizationUserAdminView): Promise<void> {
    const request = new OrganizationUserInviteRequest({
      emails,
      permissions: user.permissions,
      type: user.type,
      collections: user.collections,
      groups: user.groups,
      accessSecretsManager: user.accessSecretsManager,
    });

    await this.organizationUserApiService.postOrganizationUserInvite(user.organizationId, request);
  }
}
