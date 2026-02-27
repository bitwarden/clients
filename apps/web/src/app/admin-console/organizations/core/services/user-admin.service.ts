import { Injectable } from "@angular/core";

import {
  OrganizationUserApiService,
  OrganizationUserInviteRequest,
  OrganizationUserUpdateRequest,
} from "@bitwarden/admin-console/common";

import { CoreOrganizationModule } from "../core-organization.module";
import { OrganizationUserAdminView } from "../views/organization-user-admin-view";

@Injectable({ providedIn: CoreOrganizationModule })
export class UserAdminService {
  constructor(private organizationUserApiService: OrganizationUserApiService) {}

  async get(
    organizationId: string,
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

  async save(user: OrganizationUserAdminView): Promise<void> {
    const request = new OrganizationUserUpdateRequest();
    request.permissions = user.permissions;
    request.type = user.type;
    request.collections = user.collections;
    request.groups = user.groups;
    request.accessSecretsManager = user.accessSecretsManager;

    await this.organizationUserApiService.putOrganizationUser(
      user.organizationId,
      user.id,
      request,
    );
  }

  async invite(emails: string[], user: OrganizationUserAdminView): Promise<void> {
    const request = new OrganizationUserInviteRequest();
    request.emails = emails;
    request.permissions = user.permissions;
    request.type = user.type;
    request.collections = user.collections;
    request.groups = user.groups;
    request.accessSecretsManager = user.accessSecretsManager;

    await this.organizationUserApiService.postOrganizationUserInvite(user.organizationId, request);
  }
}
