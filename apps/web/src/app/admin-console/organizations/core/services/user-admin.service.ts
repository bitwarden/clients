import { Injectable } from "@angular/core";

import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import {
  OrganizationUserInviteRequest,
  OrganizationUserUpdateRequest,
} from "@bitwarden/common/admin-console/abstractions/organization-user/requests";
import { OrganizationUserDetailsResponse } from "@bitwarden/common/admin-console/abstractions/organization-user/responses";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { CoreOrganizationModule } from "../core-organization.module";
import { OrganizationUserAdminView } from "../views/organization-user-admin-view";

@Injectable({ providedIn: CoreOrganizationModule })
export class UserAdminService {
  constructor(
    private configService: ConfigService,
    private organizationUserService: OrganizationUserService,
  ) {}

  async get(
    organizationId: string,
    organizationUserId: string,
  ): Promise<OrganizationUserAdminView | undefined> {
    const userResponse = await this.organizationUserService.getOrganizationUser(
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
    request.accessAll = user.accessAll;
    request.permissions = user.permissions;
    request.type = user.type;
    request.collections = user.collections;
    request.groups = user.groups;
    request.accessSecretsManager = user.accessSecretsManager;

    await this.organizationUserService.putOrganizationUser(user.organizationId, user.id, request);
  }

  async invite(emails: string[], user: OrganizationUserAdminView): Promise<void> {
    const request = new OrganizationUserInviteRequest();
    request.emails = emails;
    request.accessAll = user.accessAll;
    request.permissions = user.permissions;
    request.type = user.type;
    request.collections = user.collections;
    request.groups = user.groups;
    request.accessSecretsManager = user.accessSecretsManager;

    await this.organizationUserService.postOrganizationUserInvite(user.organizationId, request);
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
      view.accessAll = u.accessAll;
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

      return view;
    });

    return await Promise.all(promises);
  }
}
