import { inject, Injectable, signal, WritableSignal } from "@angular/core";
import { concatMap, firstValueFrom, lastValueFrom, switchMap, take } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserInviteRequest,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  asUuid,
  SdkService,
  uuidAsString,
} from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import {
  OrganizationId as SdkOrganizationId,
  OrganizationUserBulkResponse as SdkOrganizationUserBulkResponse,
  OrganizationUserId,
  OrganizationUsersManagementClient,
  OrganizationUserStatusType,
} from "@bitwarden/sdk-internal";
import { ProviderUser } from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";

import { OrganizationUserView } from "../../../core/views/organization-user.view";
import { UserConfirmComponent } from "../../../manage/user-confirm.component";
import { MemberDialogManagerService } from "../member-dialog-manager/member-dialog-manager.service";

import {
  BulkActionResult,
  MemberActionResult,
  OrganizationUserBulkResult,
  REQUESTS_PER_BATCH,
} from "./member-actions.types";

// Provided in root so that EditMemberDialogComponent can resolve it. DialogService parents a
// dialog's injector to the environment injector DialogService itself was created in, so dialogs
// opened via the root-provided MemberDialogManagerService resolve against root — a module-scoped
// provider is never in that chain.
@Injectable({ providedIn: "root" })
export class MemberActionsService {
  private organizationUserApiService = inject(OrganizationUserApiService);
  private organizationUserService = inject(OrganizationUserService);
  private organizationMetadataService = inject(OrganizationMetadataServiceAbstraction);
  private apiService = inject(ApiService);
  private dialogService = inject(DialogService);
  private legacyCompatKeyService = inject(LegacyCompatKeyService);
  private logService = inject(LogService);
  private orgManagementPrefs = inject(OrganizationManagementPreferencesService);
  private userNamePipe = inject(UserNamePipe);
  private memberDialogManager = inject(MemberDialogManagerService);
  private accountService = inject(AccountService);
  private sdkService = inject(SdkService);

  readonly isProcessing = signal(false);

  private startProcessing(length?: number): void {
    this.isProcessing.set(true);
    if (length != null && length > REQUESTS_PER_BATCH) {
      this.memberDialogManager
        .openBulkProgressDialog(this.progressCount, length)
        .closed.pipe(take(1))
        .subscribe(() => {
          this.progressCount.set(0);
        });
    }
  }

  private endProcessing(): void {
    this.isProcessing.set(false);
  }

  private readonly progressCount: WritableSignal<number> = signal(0);

  async invite(
    organizationId: OrganizationId,
    request: OrganizationUserInviteRequest,
  ): Promise<MemberActionResult> {
    this.startProcessing();
    try {
      await this.organizationUserApiService.postOrganizationUserInvite(organizationId, request);
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
      await firstValueFrom(this.organizationUserService.restoreUser(organization, userId));

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
      await this.withMembersClient((client) =>
        client.reinvite(
          asUuid<SdkOrganizationId>(organization.id),
          asUuid<OrganizationUserId>(userId),
        ),
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: this.sdkErrorMessage(error) };
    } finally {
      this.endProcessing();
    }
  }

  async sendInvite(organization: Organization, userId: string): Promise<MemberActionResult> {
    const result = await this.bulkSendInvite(organization, [userId]);
    const failure = result.failed[0];

    return failure ? { success: false, error: failure.error } : { success: true };
  }

  /**
   * Promotes staged members to invited. The endpoint skips members that are no longer staged and reports
   * them per row, so a stale selection degrades to a partial send. A seat expansion failure still fails
   * the whole call, because seats are reserved once for the entire set.
   */
  async bulkSendInvite(organization: Organization, userIds: string[]): Promise<BulkActionResult> {
    const result = new BulkActionResult();
    this.startProcessing();

    try {
      const response = await this.withMembersClient((client) =>
        client.send_staged_invites(
          asUuid<SdkOrganizationId>(organization.id),
          userIds.map((id) => asUuid<OrganizationUserId>(id)),
        ),
      );

      for (const memberResult of response.map(toBulkResult)) {
        if (memberResult.error) {
          result.failed.push({ id: memberResult.id, error: memberResult.error });
        } else {
          result.successful.push(memberResult);
        }
      }

      if (result.successful.length > 0) {
        this.organizationMetadataService.refreshMetadataCache();
      }
    } catch (error) {
      result.failed = userIds.map((id) => ({
        id,
        error: this.sdkErrorMessage(error),
      }));
    } finally {
      this.endProcessing();
    }

    return result;
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

  async bulkReinvite(
    organization: Organization,
    users: OrganizationUserView[],
  ): Promise<BulkActionResult> {
    let result = new BulkActionResult();
    this.startProcessing(users.length);

    try {
      result = await this.processBatchedOperation(users, REQUESTS_PER_BATCH, async (userBatch) => {
        const response = await this.withMembersClient((client) =>
          client.bulk_reinvite(
            asUuid<SdkOrganizationId>(organization.id),
            userBatch.map((u) => asUuid<OrganizationUserId>(u.id)),
          ),
        );
        return response.map(toBulkResult);
      });

      if (result.failed.length > 0) {
        const resendUsers = await firstValueFrom(
          this.memberDialogManager.openBulkReinviteFailureDialog(organization, users, result),
        );

        if (resendUsers.length > 0) {
          await this.bulkReinvite(organization, resendUsers);
        }
      }
    } catch (error) {
      result.failed = users.map((user) => ({
        id: user.id,
        error: this.sdkErrorMessage(error),
      }));
    } finally {
      this.endProcessing();
    }
    return result;
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

    const statusAllowed =
      orgUser.status === OrganizationUserStatusType.Confirmed ||
      orgUser.status === OrganizationUserStatusType.Revoked ||
      orgUser.status === OrganizationUserStatusType.Accepted;

    return (
      organization.canManageUsersPassword &&
      callingUserHasPermission &&
      organization.useResetPassword &&
      organization.hasPublicAndPrivateKeys &&
      orgUser.resetPasswordEnrolled &&
      resetPasswordEnabled &&
      statusAllowed
    );
  }

  /**
   * Processes user IDs in sequential batches and aggregates results.
   * @param users - Array of users to process
   * @param batchSize - Number of IDs to process per batch
   * @param processBatch - Async function that processes a single batch from the provided param `users` and returns the result.
   * @returns Aggregated bulk action result
   */
  private async processBatchedOperation(
    users: OrganizationUserView[],
    batchSize: number,
    processBatch: (batch: OrganizationUserView[]) => Promise<OrganizationUserBulkResult[]>,
  ): Promise<BulkActionResult> {
    const allSuccessful: OrganizationUserBulkResult[] = [];
    const allFailed: { id: string; error: string }[] = [];

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      try {
        for (const response of await processBatch(batch)) {
          if (response.error) {
            allFailed.push({ id: response.id, error: response.error });
          } else {
            allSuccessful.push(response);
          }
        }
      } catch (error) {
        allFailed.push(
          ...batch.map((user) => ({
            id: user.id,
            error: this.sdkErrorMessage(error),
          })),
        );
      }

      this.progressCount.update((value) => value + batch.length);
    }

    return {
      successful: allSuccessful,
      failed: allFailed,
    };
  }

  /**
   * Runs one operation against the member administration client of the active user. The account is
   * pinned at call time so a mutation is never replayed against a different user, and the client is
   * only valid inside the callback.
   */
  private withMembersClient<T>(
    operation: (client: OrganizationUsersManagementClient) => Promise<T>,
  ): Promise<T> {
    return firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        take(1),
        switchMap((userId) => this.sdkService.userClient$(userId)),
        concatMap(async (sdk) => {
          using ref = sdk.take();
          return await operation(ref.value.organization_users_management());
        }),
      ),
    );
  }

  /**
   * The SDK renders a rejected request as `error in response: status code <status>: <json body>`.
   * The server's own message inside that body is the one worth showing; anything else passes through.
   */
  private sdkErrorMessage(error: unknown): string {
    const message = (error as Error).message ?? String(error);
    const bodyStart = message.indexOf("{");
    if (bodyStart === -1) {
      return message;
    }

    try {
      const body = JSON.parse(message.slice(bodyStart, message.lastIndexOf("}") + 1)) as {
        message?: unknown;
      };
      return typeof body.message === "string" ? body.message : message;
    } catch {
      return message;
    }
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
        const fingerprint = await this.legacyCompatKeyService.getFingerprint(
          user.userId,
          publicKey,
        );
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

function toBulkResult(result: SdkOrganizationUserBulkResponse): OrganizationUserBulkResult {
  return { id: uuidAsString(result.id), error: result.error };
}
