import { combineLatest, firstValueFrom, map, Observable, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { getById } from "@bitwarden/common/platform/misc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import {
  DefaultOrganizationUserService,
  OrganizationUserApiService,
} from "../../organization-user";
import { AutomaticUserConfirmationService } from "../abstractions/auto-confirm.service.abstraction";
import { AUTO_CONFIRM_STATE, AutoConfirmState } from "../models/auto-confirm-state.model";

export class DefaultAutomaticUserConfirmationService implements AutomaticUserConfirmationService {
  constructor(
    private configService: ConfigService,
    private apiService: ApiService,
    private organizationUserService: DefaultOrganizationUserService,
    private stateProvider: StateProvider,
    private organizationService: InternalOrganizationServiceAbstraction,
    private organizationUserApiService: OrganizationUserApiService,
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

  canManageAutoConfirm$(userId: UserId, organizationId: OrganizationId): Observable<boolean> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.AutoConfirm),
      this.organizationService.organizations$(userId).pipe(getById(organizationId)),
    ]).pipe(
      map(
        ([enabled, organization]) =>
          (enabled && organization?.canManageUsers && organization?.useAutomaticUserConfirmation) ??
          false,
      ),
    );
  }

  async autoConfirmUser(
    userId: UserId,
    confirmingUserId: UserId,
    organization: Organization,
  ): Promise<void> {
    await firstValueFrom(
      this.canManageAutoConfirm$(userId, organization.id).pipe(
        map((canManage) => {
          if (!canManage) {
            throw new Error("Cannot automatically confirm user (insufficient permissions)");
          }
          return canManage;
        }),
        switchMap(() => this.apiService.getUserPublicKey(userId)),
        map((publicKeyResponse) => Utils.fromB64ToArray(publicKeyResponse.publicKey)),
        switchMap((publicKey) =>
          this.organizationUserService.buildConfirmRequest(organization, publicKey),
        ),
        switchMap((request) =>
          this.organizationUserApiService.postOrganizationUserConfirm(
            organization.id,
            confirmingUserId,
            request,
          ),
        ),
      ),
    );
  }
}
