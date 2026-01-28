import { inject, Injectable, signal } from "@angular/core";
import { lastValueFrom, firstValueFrom } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserBulkResponse,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import {
  OrganizationUserType,
  OrganizationUserStatusType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";
import { ProviderUser } from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";

import { OrganizationUserView } from "../../../core/views/organization-user.view";
import { UserConfirmComponent } from "../../../manage/user-confirm.component";

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
  private organizationUserApiService = inject(OrganizationUserApiService);
  private organizationUserService = inject(OrganizationUserService);
  private organizationMetadataService = inject(OrganizationMetadataServiceAbstraction);
  private apiService = inject(ApiService);
  private dialogService = inject(DialogService);
  private keyService = inject(KeyService);
  private logService = inject(LogService);
  private orgManagementPrefs = inject(OrganizationManagementPreferencesService);
  private userNamePipe = inject(UserNamePipe);

  readonly isProcessing = signal(false);

  private startProcessing(): void {
    this.isProcessing.set(true);
  }

  private endProcessing(): void {
    this.isProcessing.set(false);
  }

  async inviteUser(
    organization: Organization,
    email: string,
    type: OrganizationUserType,
    permissions?: any,
    collections?: any[],
    groups?: string[],
  ): Promise<MemberActionResult> {
    this.startProcessing();
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
    } finally {
      this.endProcessing();
    }
  }

  async removeUser(organization: Organization, userId: string): Promise<MemberActionResult> {
    this.startProcessing();
    try {
      await this.organizationUserApiService.removeOrganizationUser(organization.id, userId);
      this.organizationMetadataService.refreshMetadataCache();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    } finally {
      this.endProcessing();
    }
  }

  async revokeUser(organization: Organization, userId: string): Promise<MemberActionResult> {
    this.startProcessing();
    try {
      await this.organizationUserApiService.revokeOrganizationUser(organization.id, userId);
      this.organizationMetadataService.refreshMetadataCache();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    } finally {
      this.endProcessing();
    }
  }

  async restoreUser(organization: Organization, userId: string): Promise<MemberActionResult> {
    this.startProcessing();
    try {
      await this.organizationUserApiService.restoreOrganizationUser(organization.id, userId);
      this.organizationMetadataService.refreshMetadataCache();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    } finally {
      this.endProcessing();
    }
  }

  async deleteUser(organization: Organization, userId: string): Promise<MemberActionResult> {
    this.startProcessing();
    try {
      await this.organizationUserApiService.deleteOrganizationUser(organization.id, userId);
      this.organizationMetadataService.refreshMetadataCache();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    } finally {
      this.endProcessing();
    }
  }

  async reinviteUser(organization: Organization, userId: string): Promise<MemberActionResult> {
    this.startProcessing();
    try {
      await this.organizationUserApiService.postOrganizationUserReinvite(organization.id, userId);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    } finally {
      this.endProcessing();
    }
  }

  async confirmUser(
    user: OrganizationUserView,
    publicKey: Uint8Array,
    organization: Organization,
  ): Promise<MemberActionResult> {
    this.startProcessing();
    try {
      await firstValueFrom(
        this.organizationUserService.confirmUser(organization, user.id, publicKey),
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message ?? String(error) };
    } finally {
      this.endProcessing();
    }
  }

  async bulkReinvite(organization: Organization, userIds: UserId[]): Promise<BulkActionResult> {
    this.startProcessing();
    try {
      return this.processBatchedOperation(userIds, REQUESTS_PER_BATCH, (batch) =>
        this.organizationUserApiService.postManyOrganizationUserReinvite(organization.id, batch),
      );
    } catch (error) {
      return {
        failed: userIds.map((id) => ({ id, error: (error as Error).message ?? String(error) })),
      };
    } finally {
      this.endProcessing();
    }
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

  /**
   * Shared dialog workflow that returns the public key when the user accepts the selected confirmation
   * action.
   *
   * @param user - The user to confirm (must implement ConfirmableUser interface)
   * @param userNamePipe - Pipe to transform user names for display
   * @param orgManagementPrefs - Service providing organization management preferences
   * @returns Promise containing the pulic key that resolves when the confirm action is accepted
   * or undefined when cancelled
   */
  async getPublicKeyForConfirm(
    user: OrganizationUserView | ProviderUser,
  ): Promise<Uint8Array | undefined> {
    try {
      assertNonNullish(user, "Cannot confirm null user.");

      const autoConfirmFingerPrint = await firstValueFrom(
        this.orgManagementPrefs.autoConfirmFingerPrints.state$,
      );

      const publicKeyResponse = await this.apiService.getUserPublicKey(user.userId);
      const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);

      if (autoConfirmFingerPrint == null || !autoConfirmFingerPrint) {
        const fingerprint = await this.keyService.getFingerprint(user.userId, publicKey);
        this.logService.info(`User's fingerprint: ${fingerprint.join("-")}`);

        const confirmed = UserConfirmComponent.open(this.dialogService, {
          data: {
            name: this.userNamePipe.transform(user),
            userId: user.userId,
            publicKey: publicKey,
          },
        });

        if (!(await lastValueFrom(confirmed.closed))) {
          return;
        }
      }

      return publicKey;
    } catch (e) {
      this.logService.error(`Handled exception: ${e}`);
    }
  }
}
