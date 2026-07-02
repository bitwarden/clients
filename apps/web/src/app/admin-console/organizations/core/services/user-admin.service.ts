import { Injectable } from "@angular/core";
import { firstValueFrom, switchMap } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserInviteRequest,
  OrganizationUserService,
  OrganizationUserUpdateRequest,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { getById } from "@bitwarden/common/platform/misc";
import { Guid, OrganizationId } from "@bitwarden/common/types/guid";

import { CoreOrganizationModule } from "../core-organization.module";
import { OrganizationUserAdminView } from "../views/organization-user-admin-view";

@Injectable({ providedIn: CoreOrganizationModule })
export class UserAdminService {
  constructor(
    private organizationUserApiService: OrganizationUserApiService,
    private organizationUserService: OrganizationUserService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
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
  async save(userView: OrganizationUserAdminView): Promise<void> {
    const request = new OrganizationUserUpdateRequest({
      type: userView.type,
      permissions: userView.permissions,
      collections: userView.collections,
      groups: userView.groups,
      accessSecretsManager: userView.accessSecretsManager,
    });

    await this.saveV2(request, userView.id, userView.organizationId);
  }

  async saveV2(
    request: OrganizationUserUpdateRequest,
    userId: Guid,
    organizationId: OrganizationId,
  ): Promise<void> {
    await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((activeUserId) => this.organizationService.organizations$(activeUserId)),
        getById(organizationId),
        switchMap((organization) => {
          if (organization == null) {
            throw new Error("Organization not found");
          }

          return this.organizationUserService.updateUser(organization, userId, request);
        }),
      ),
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
