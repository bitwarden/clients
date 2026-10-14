import { inject, Injectable, signal, WritableSignal } from "@angular/core";
import {
  catchError,
  concatMap,
  defer,
  finalize,
  firstValueFrom,
  from,
  lastValueFrom,
  map,
  MonoTypeOperatorFunction,
  Observable,
  of,
  reduce,
  switchMap,
  take,
  tap,
} from "rxjs";

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

  reinviteUser(organization: Organization, userId: string): Observable<MemberActionResult> {
    return this.withMembersClient$((client) =>
      client.reinvite(
        asUuid<SdkOrganizationId>(organization.id),
        asUuid<OrganizationUserId>(userId),
      ),
    ).pipe(
      map((): MemberActionResult => ({ success: true })),
      catchError((error: unknown) =>
        of<MemberActionResult>({ success: false, error: this.sdkErrorMessage(error) }),
      ),
      this.trackProcessing(),
    );
  }

  sendInvite(organization: Organization, userId: string): Observable<MemberActionResult> {
    return this.bulkSendInvite(organization, [userId]).pipe(
      map((result): MemberActionResult => {
        const failure = result.failed[0];
        return failure ? { success: false, error: failure.error } : { success: true };
      }),
    );
  }

  /**
   * Promotes staged members to invited. The endpoint skips members that are no longer staged and reports
   * them per row, so a stale selection degrades to a partial send. A seat expansion failure still fails
   * the whole call, because seats are reserved once for the entire set.
   */
  bulkSendInvite(organization: Organization, userIds: string[]): Observable<BulkActionResult> {
    return this.withMembersClient$((client) =>
      client.send_staged_invites(
        asUuid<SdkOrganizationId>(organization.id),
        userIds.map((id) => asUuid<OrganizationUserId>(id)),
      ),
    ).pipe(
      map((rows) => partitionResults(rows.map(toBulkResult))),
      tap((result) => {
        if (result.successful.length > 0) {
          this.organizationMetadataService.refreshMetadataCache();
        }
      }),
      catchError((error: unknown) => of(this.failAll(userIds, error))),
      this.trackProcessing(),
    );
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

  bulkReinvite(
    organization: Organization,
    users: OrganizationUserView[],
  ): Observable<BulkActionResult> {
    return this.processBatched$(users, REQUESTS_PER_BATCH, (userBatch) =>
      this.withMembersClient$((client) =>
        client.bulk_reinvite(
          asUuid<SdkOrganizationId>(organization.id),
          userBatch.map((u) => asUuid<OrganizationUserId>(u.id)),
        ),
      ).pipe(map((rows) => rows.map(toBulkResult))),
    ).pipe(
      concatMap((result) =>
        result.failed.length > 0 ? this.offerResend(organization, users, result) : of(result),
      ),
      catchError((error: unknown) =>
        of(
          this.failAll(
            users.map((user) => user.id),
            error,
          ),
        ),
      ),
      this.trackProcessing(users.length),
    );
  }

  /** Lets the admin retry the failed members. The original outcome is reported either way. */
  private offerResend(
    organization: Organization,
    users: OrganizationUserView[],
    result: BulkActionResult,
  ): Observable<BulkActionResult> {
    return this.memberDialogManager.openBulkReinviteFailureDialog(organization, users, result).pipe(
      take(1),
      concatMap((resendUsers) =>
        resendUsers.length > 0 ? this.bulkReinvite(organization, resendUsers) : of(undefined),
      ),
      map(() => result),
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
   * Processes users in sequential batches and aggregates the outcomes.
   * @param users - Users to process
   * @param batchSize - Number of users per batch
   * @param processBatch - Processes a single batch and emits the outcome for each of its members
   * @returns Aggregated bulk action result
   */
  private processBatched$(
    users: OrganizationUserView[],
    batchSize: number,
    processBatch: (batch: OrganizationUserView[]) => Observable<OrganizationUserBulkResult[]>,
  ): Observable<BulkActionResult> {
    const batches = Array.from({ length: Math.ceil(users.length / batchSize) }, (_, i) =>
      users.slice(i * batchSize, (i + 1) * batchSize),
    );

    return from(batches).pipe(
      concatMap((batch) =>
        processBatch(batch).pipe(
          take(1),
          map((results) => partitionResults(results)),
          catchError((error: unknown) =>
            of(
              this.failAll(
                batch.map((user) => user.id),
                error,
              ),
            ),
          ),
          tap(() => this.progressCount.update((value) => value + batch.length)),
        ),
      ),
      reduce(
        (all, batchResult) => ({
          successful: [...all.successful, ...batchResult.successful],
          failed: [...all.failed, ...batchResult.failed],
        }),
        new BulkActionResult(),
      ),
    );
  }

  /** Handles the progress dialog while the action is executing */
  private trackProcessing<T>(length?: number): MonoTypeOperatorFunction<T> {
    return (source) =>
      defer(() => {
        this.startProcessing(length);
        return source;
      }).pipe(finalize(() => this.endProcessing()));
  }

  /** Marks every given member as failed with the message of a request that failed as a whole. */
  private failAll(ids: string[], error: unknown): BulkActionResult {
    const result = new BulkActionResult();
    result.failed = ids.map((id) => ({ id, error: this.sdkErrorMessage(error) }));
    return result;
  }

  /**
   * Runs one operation against the member administration client of the active user. The account is
   * pinned at call time so a mutation is never replayed against a different user, and the client is
   * only valid inside the callback.
   */
  private withMembersClient$<T>(
    operation: (client: OrganizationUsersManagementClient) => Promise<T>,
  ): Observable<T> {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      take(1),
      switchMap((userId) => this.sdkService.userClient$(userId)),
      concatMap(async (sdk) => {
        using ref = sdk.take();
        return await operation(ref.value.organization_users_management());
      }),
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

/** Splits per-member outcomes into the members that succeeded and the ones that reported an error. */
function partitionResults(results: OrganizationUserBulkResult[]): BulkActionResult {
  const partitioned = new BulkActionResult();
  for (const result of results) {
    if (result.error) {
      partitioned.failed.push({ id: result.id, error: result.error });
    } else {
      partitioned.successful.push(result);
    }
  }
  return partitioned;
}
