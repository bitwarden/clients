import { Injectable } from "@angular/core";
import { firstValueFrom, switchMap, map } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserBulkResponse,
  OrganizationUserConfirmRequest,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import {
  OrganizationUserType,
  OrganizationUserStatusType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { OrganizationUserView } from "../../../core/views/organization-user.view";

export const REQUESTS_PER_BATCH = 500;

export interface MemberActionResult {
  success: boolean;
  error?: string;
}

export interface BulkActionResult {
  successful?: ListResponse<OrganizationUserBulkResponse>;
  failed: { id: string; error: string }[];
}

@Injectable()
export class MemberActionsService {
  private userId$ = this.accountService.activeAccount$.pipe(getUserId);

  constructor(
    private organizationUserApiService: OrganizationUserApiService,
    private organizationUserService: OrganizationUserService,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private configService: ConfigService,
    private accountService: AccountService,
    private organizationMetadataService: OrganizationMetadataServiceAbstraction,
  ) {}

  async inviteUser(
    organization: Organization,
    email: string,
    type: OrganizationUserType,
    permissions?: any,
    collections?: any[],
    groups?: string[],
  ): Promise<MemberActionResult> {
    try {
      await this.organizationUserApiService.postOrganizationUserInvite(organization.id, {
        emails: [email],
        type,
        accessSecretsManager: false,
        collections: collections ?? [],
        groups: groups ?? [],
        permissions,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    }
  }

  async removeUser(organization: Organization, userId: string): Promise<MemberActionResult> {
    try {
      await this.organizationUserApiService.removeOrganizationUser(organization.id, userId);
      this.organizationMetadataService.refreshMetadataCache();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    }
  }

  async revokeUser(organization: Organization, userId: string): Promise<MemberActionResult> {
    try {
      await this.organizationUserApiService.revokeOrganizationUser(organization.id, userId);
      this.organizationMetadataService.refreshMetadataCache();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    }
  }

  async restoreUser(organization: Organization, userId: string): Promise<MemberActionResult> {
    try {
      await this.organizationUserApiService.restoreOrganizationUser(organization.id, userId);
      this.organizationMetadataService.refreshMetadataCache();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    }
  }

  async deleteUser(organization: Organization, userId: string): Promise<MemberActionResult> {
    try {
      await this.organizationUserApiService.deleteOrganizationUser(organization.id, userId);
      this.organizationMetadataService.refreshMetadataCache();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    }
  }

  async reinviteUser(organization: Organization, userId: string): Promise<MemberActionResult> {
    try {
      await this.organizationUserApiService.postOrganizationUserReinvite(organization.id, userId);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    }
  }

  async confirmUser(
    user: OrganizationUserView,
    publicKey: Uint8Array,
    organization: Organization,
  ): Promise<MemberActionResult> {
    try {
      if (
        await firstValueFrom(this.configService.getFeatureFlag$(FeatureFlag.CreateDefaultLocation))
      ) {
        await firstValueFrom(
          this.organizationUserService.confirmUser(organization, user.id, publicKey),
        );
      } else {
        const request = await firstValueFrom(
          this.userId$.pipe(
            switchMap((userId) => this.keyService.orgKeys$(userId)),
            map((orgKeys) => {
              if (orgKeys == null || orgKeys[organization.id] == null) {
                throw new Error("Organization keys not found for provided User.");
              }
              return orgKeys[organization.id];
            }),
            switchMap((orgKey) => this.encryptService.encapsulateKeyUnsigned(orgKey, publicKey)),
            map((encKey) => {
              const req = new OrganizationUserConfirmRequest();
              req.key = encKey.encryptedString;
              return req;
            }),
          ),
        );

        await this.organizationUserApiService.postOrganizationUserConfirm(
          organization.id,
          user.id,
          request,
        );
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    }
  }

  async bulkReinvite(organization: Organization, userIds: UserId[]): Promise<BulkActionResult> {
    const increaseBulkReinviteLimitForCloud = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.IncreaseBulkReinviteLimitForCloud),
    );
    if (increaseBulkReinviteLimitForCloud) {
      return await this.vNextBulkReinvite(organization, userIds);
    } else {
      try {
        const result = await this.organizationUserApiService.postManyOrganizationUserReinvite(
          organization.id,
          userIds,
        );
        return { successful: result, failed: [] };
      } catch (error) {
        return {
          failed: userIds.map((id) => ({ id, error: (error as Error).message ?? String(error) })),
        };
      }
    }
  }

  async vNextBulkReinvite(
    organization: Organization,
    userIds: UserId[],
  ): Promise<BulkActionResult> {
    return this.processBatchedOperation(userIds, REQUESTS_PER_BATCH, (batch) =>
      this.organizationUserApiService.postManyOrganizationUserReinvite(organization.id, batch),
    );
  }

  allowResetPassword(
    orgUser: OrganizationUserView,
    organization: Organization,
    resetPasswordEnabled: boolean,
  ): boolean {
    let callingUserHasPermission = false;

    switch (organization.type) {
      case OrganizationUserType.Owner:
        callingUserHasPermission = true;
        break;
      case OrganizationUserType.Admin:
        callingUserHasPermission = orgUser.type !== OrganizationUserType.Owner;
        break;
      case OrganizationUserType.Custom:
        callingUserHasPermission =
          orgUser.type !== OrganizationUserType.Owner &&
          orgUser.type !== OrganizationUserType.Admin;
        break;
    }

    return (
      organization.canManageUsersPassword &&
      callingUserHasPermission &&
      organization.useResetPassword &&
      organization.hasPublicAndPrivateKeys &&
      orgUser.resetPasswordEnrolled &&
      resetPasswordEnabled &&
      orgUser.status === OrganizationUserStatusType.Confirmed
    );
  }

  /**
   * Processes user IDs in sequential batches and aggregates results.
   * @param userIds - Array of user IDs to process
   * @param batchSize - Number of IDs to process per batch
   * @param processBatch - Async function that processes a single batch and returns the result
   * @returns Aggregated bulk action result
   */
  private async processBatchedOperation(
    userIds: UserId[],
    batchSize: number,
    processBatch: (batch: string[]) => Promise<ListResponse<OrganizationUserBulkResponse>>,
  ): Promise<BulkActionResult> {
    const allSuccessful: OrganizationUserBulkResponse[] = [];
    const allFailed: { id: string; error: string }[] = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      try {
        const result = await processBatch(batch);

        if (result?.data) {
          for (const response of result.data) {
            if (response.error) {
              allFailed.push({ id: response.id, error: response.error });
            } else {
              allSuccessful.push(response);
            }
          }
        }
      } catch (error) {
        allFailed.push(
          ...batch.map((id) => ({ id, error: (error as Error).message ?? String(error) })),
        );
      }
    }

    const successful =
      allSuccessful.length > 0
        ? new ListResponse(allSuccessful, OrganizationUserBulkResponse)
        : undefined;

    return {
      successful,
      failed: allFailed,
    };
  }
}
