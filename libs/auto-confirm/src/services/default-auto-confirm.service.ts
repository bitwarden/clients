import {
  combineLatest,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  merge,
  Observable,
  pairwise,
  startWith,
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
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { getById } from "@bitwarden/common/platform/misc";
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
    this.initBulkAutoConfirmOnLoginSweep();
  }

  private initBulkAutoConfirmOnLoginSweep(): void {
    this.accountService.accounts$
      .pipe(
        switchMap((accounts) =>
          merge(
            ...Object.keys(accounts).map((userId) =>
              this.authService.authStatusFor$(userId as UserId).pipe(
                startWith(AuthenticationStatus.LoggedOut),
                distinctUntilChanged(),
                pairwise(),
                filter(
                  ([prev, curr]) =>
                    curr === AuthenticationStatus.Unlocked &&
                    prev !== AuthenticationStatus.Unlocked,
                ),
                map(() => userId as UserId),
              ),
            ),
          ),
        ),
      )
      .subscribe((userId) => void this.bulkAutoConfirmPendingUsers(userId));
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
    const canManage = await firstValueFrom(this.canManageAutoConfirm$(userId));

    if (!canManage) {
      return;
    }

    // Only initiate auto confirmation if the local client setting has been turned on
    const autoConfirmEnabled = await firstValueFrom(
      this.configuration$(userId).pipe(map((state) => state.enabled)),
    );

    if (!autoConfirmEnabled) {
      return;
    }

    const organization$ = this.organizationService.organizations$(userId).pipe(
      getById(organizationId),
      map((organization) => {
        if (organization == null) {
          throw new Error("Organization not found");
        }
        return organization;
      }),
    );

    const publicKeyResponse = await this.apiService.getUserPublicKey(confirmedUserId);
    const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);

    await firstValueFrom(
      organization$.pipe(
        switchMap((org) => this.organizationUserService.buildConfirmRequest(org, publicKey)),
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

    const canManage = await firstValueFrom(this.canManageAutoConfirm$(userId));
    if (!canManage) {
      return;
    }

    const autoConfirmEnabled = await firstValueFrom(
      this.configuration$(userId).pipe(map((state) => state.enabled)),
    );
    if (!autoConfirmEnabled) {
      return;
    }

    const org = await firstValueFrom(
      this.organizationService.organizations$(userId).pipe(map((orgs) => orgs[0])),
    );
    if (!org) {
      return;
    }

    const pendingResponse = await this.organizationUserApiService.getPendingAutoConfirmUsers(
      org.id,
    );
    if (!pendingResponse.data.length) {
      return;
    }

    const confirmEntries = await Promise.all(
      pendingResponse.data.map(async (pendingUser) => {
        const publicKeyResponse = await this.apiService.getUserPublicKey(pendingUser.userId);
        const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);
        const confirmRequest = await firstValueFrom(
          this.organizationUserService.buildConfirmRequest(org, publicKey),
        );
        return {
          id: pendingUser.id,
          key: confirmRequest.key as string,
          defaultUserCollectionName: confirmRequest.defaultUserCollectionName,
        };
      }),
    );

    const defaultUserCollectionName = confirmEntries[0]?.defaultUserCollectionName;
    const bulkRequest = new OrganizationUserBulkConfirmRequest(
      confirmEntries.map((e) => ({ id: e.id, key: e.key })),
      defaultUserCollectionName,
    );

    await this.organizationUserApiService.postBulkOrganizationUserAutoConfirm(org.id, bulkRequest);
  }
}
