import { combineLatest, firstValueFrom, map, Observable, switchMap } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
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
    private configService: ConfigService,
    private apiService: ApiService,
    private organizationUserService: OrganizationUserService,
    private stateProvider: StateProvider,
    private organizationService: InternalOrganizationServiceAbstraction,
    private organizationUserApiService: OrganizationUserApiService,
    private policyService: PolicyService,
  ) {}
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
      this.configService.getFeatureFlag$(FeatureFlag.AutoConfirm),
      this.organizationService
        .organizations$(userId)
        // auto-confirm does not allow the user to be part of any other organization (even if admin or owner)
        // so we can assume that the first organization is the relevant one.
        .pipe(map((organizations) => organizations[0])),
      this.policyService.policyAppliesToUser$(PolicyType.AutoConfirm, userId),
    ]).pipe(
      map(
        ([enabled, organization, policyEnabled]) =>
          enabled && policyEnabled && (organization?.canManageAutoConfirm ?? false),
      ),
    );
  }

  async autoConfirmUser(
    userId: UserId,
    confirmedUserId: UserId,
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

    const publicKeyResponse = await this.apiService.getUserPublicKey(userId);
    const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);

    await firstValueFrom(
      organization$.pipe(
        switchMap((org) => this.organizationUserService.buildConfirmRequest(org, publicKey)),
        switchMap((request) =>
          this.organizationUserApiService.postOrganizationUserAutoConfirm(
            organizationId,
            confirmedUserId,
            request,
          ),
        ),
      ),
    );
  }
}
