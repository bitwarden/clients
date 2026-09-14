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
