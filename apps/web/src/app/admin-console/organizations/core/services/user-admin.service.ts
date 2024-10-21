import { Injectable } from "@angular/core";

import {
  OrganizationUserApiService,
  OrganizationUserInviteRequest,
  OrganizationUserUpdateRequest,
  OrganizationUserDetailsResponse,
} from "@bitwarden/admin-console/common";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { CoreOrganizationModule } from "../core-organization.module";
import { OrganizationUserAdminView } from "../views/organization-user-admin-view";

@Injectable({ providedIn: CoreOrganizationModule })
export class UserAdminService {
  constructor(
    private configService: ConfigService,
    private organizationUserApiService: OrganizationUserApiService,
  ) {}

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

    const [view] = await this.decryptMany(organizationId, [userResponse]);

    return view;
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

  private async decryptMany(
    organizationId: string,
    users: OrganizationUserDetailsResponse[],
  ): Promise<OrganizationUserAdminView[]> {
    const promises = users.map(async (u) => {
      const view = new OrganizationUserAdminView();

      view.id = u.id;
      view.organizationId = organizationId;
      view.userId = u.userId;
      view.type = u.type;
      view.status = u.status;
      view.externalId = u.externalId;
      view.permissions = u.permissions;
      view.resetPasswordEnrolled = u.resetPasswordEnrolled;
      view.collections = u.collections.map((c) => ({
        id: c.id,
        hidePasswords: c.hidePasswords,
        readOnly: c.readOnly,
        manage: c.manage,
      }));
      view.groups = u.groups;
      view.accessSecretsManager = u.accessSecretsManager;
      view.hasMasterPassword = u.hasMasterPassword;
      view.managedByOrganization = u.managedByOrganization;

      return view;
    });

    return await Promise.all(promises);
  }
}
