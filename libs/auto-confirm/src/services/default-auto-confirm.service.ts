import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  filter,
  firstValueFrom,
  from,
  map,
  mergeMap,
  Observable,
  switchMap,
} from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserBulkConfirmRequest,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { AutomaticUserConfirmationService } from "../abstractions/auto-confirm.service.abstraction";
import { AUTO_CONFIRM_STATE, AutoConfirmState } from "../models/auto-confirm-state.model";

export class DefaultAutomaticUserConfirmationService implements AutomaticUserConfirmationService {
  constructor(
    private apiService: ApiService,
    private organizationUserService: OrganizationUserService,
    private stateProvider: StateProvider,
    private organizationService: InternalOrganizationServiceAbstraction,
    private organizationUserApiService: OrganizationUserApiService,
    private policyService: PolicyService,
    private authService: AuthService,
    private accountService: AccountService,
    private configService: ConfigService,
  ) {
    void this.initBulkAutoConfirmOnLoginSweep();
  }

  private async initBulkAutoConfirmOnLoginSweep(): Promise<void> {
    const featureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.BulkAutoConfirmOnLogin,
    );
    if (!featureEnabled) {
      return;
    }

    const seenUserIds = new Set<string>();

    this.accountService.accounts$
      .pipe(
        mergeMap((accounts) => {
          const newUserIds = Object.keys(accounts).filter((id) => !seenUserIds.has(id));
          newUserIds.forEach((id) => seenUserIds.add(id));
          return from(newUserIds as UserId[]);
        }),
        mergeMap((userId) =>
          this.authService.authStatusFor$(userId).pipe(
            distinctUntilChanged(),
            filter((status) => status === AuthenticationStatus.Unlocked),
            map(() => userId),
            catchError(() => EMPTY),
          ),
        ),
      )
      .subscribe((userId) => {
        this.bulkAutoConfirmPendingUsers(userId).catch(() => {
          // intentionally swallowed — errors are transient (network, feature flag, etc.)
        });
      });
  }

  private async resolveAutoConfirmOrg(userId: UserId): Promise<Organization | null> {
    const canManage = await firstValueFrom(this.canManageAutoConfirm$(userId));
    if (!canManage) {
      return null;
    }

    const enabled = await firstValueFrom(
      this.configuration$(userId).pipe(map((state) => state.enabled)),
    );
    if (!enabled) {
      return null;
    }

    return await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(map((orgs) => orgs.find((o) => o.useAutomaticUserConfirmation) ?? null)),
    );
  }

  private autoConfirmState(userId: UserId) {
    return this.stateProvider.getUser(userId, AUTO_CONFIRM_STATE);
  }

  configuration$(userId: UserId): Observable<AutoConfirmState> {
    return this.autoConfirmState(userId).state$.pipe(
      map((records) => records?.[userId] ?? new AutoConfirmState()),
    );
  }

  async upsert(userId: UserId, config: AutoConfirmState): Promise<void> {
    await this.autoConfirmState(userId).update((records) => {
      return {
        ...records,
        [userId]: config,
      };
    });
  }

  canManageAutoConfirm$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.organizationService
        .organizations$(userId)
        // auto-confirm does not allow the user to be part of any other organization (even if admin or owner)
        // so we can assume that the first organization is the relevant one.
        .pipe(map((organizations) => organizations[0])),
      this.policyService.policyAppliesToUser$(PolicyType.AutoConfirm, userId),
    ]).pipe(
      map(
        ([organization, policyEnabled]) =>
          policyEnabled && (organization?.canManageAutoConfirm ?? false),
      ),
    );
  }

  async autoConfirmUser(
    userId: UserId,
    confirmedUserId: UserId,
    confirmedOrganizationUserId: UserId,
    organizationId: OrganizationId,
  ): Promise<void> {
    const org = await this.resolveAutoConfirmOrg(userId);
    if (!org) {
      return;
    }

    const publicKeyResponse = await this.apiService.getUserPublicKey(confirmedUserId);
    const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);

    await firstValueFrom(
      this.organizationUserService
        .buildConfirmRequest(org, publicKey)
        .pipe(
          switchMap((request) =>
            this.organizationUserApiService.postOrganizationUserAutoConfirm(
              organizationId,
              confirmedOrganizationUserId,
              request,
            ),
          ),
        ),
    );
  }

  async bulkAutoConfirmPendingUsers(userId: UserId): Promise<void> {
    const featureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.BulkAutoConfirmOnLogin,
    );
    if (!featureEnabled) {
      return;
    }

    const org = await this.resolveAutoConfirmOrg(userId);
    if (!org) {
      return;
    }

    const pendingResponse = await this.organizationUserApiService.getPendingAutoConfirmUsers(
      org.id,
    );
    if (!pendingResponse.data.length) {
      return;
    }

    const pendingUserIds = pendingResponse.data.map((u) => u.id);
    const bulkPublicKeyResponse =
      await this.organizationUserApiService.postOrganizationUsersPublicKey(org.id, pendingUserIds);
    const publicKeyMap = new Map(bulkPublicKeyResponse.data.map((entry) => [entry.id, entry.key]));

    const confirmEntriesOrNull = await Promise.all(
      pendingResponse.data.map(async (pendingUser) => {
        const publicKeyB64 = publicKeyMap.get(pendingUser.id);
        if (publicKeyB64 == null) {
          return null;
        }
        const publicKey = Utils.fromB64ToArray(publicKeyB64);
        const confirmRequest = await firstValueFrom(
          this.organizationUserService.buildConfirmRequest(org, publicKey),
        );
        if (confirmRequest.key == null) {
          return null;
        }
        return {
          id: pendingUser.id,
          key: confirmRequest.key as string,
          defaultUserCollectionName: confirmRequest.defaultUserCollectionName,
        };
      }),
    );

    const confirmEntries = confirmEntriesOrNull.filter((e) => e != null);
    if (!confirmEntries.length) {
      return;
    }

    const defaultUserCollectionName = confirmEntries[0].defaultUserCollectionName;
    const bulkRequest = new OrganizationUserBulkConfirmRequest(
      confirmEntries.map((e) => ({ id: e.id, key: e.key })),
      defaultUserCollectionName,
    );

    await this.organizationUserApiService.postBulkOrganizationUserAutoConfirm(org.id, bulkRequest);
  }
}
