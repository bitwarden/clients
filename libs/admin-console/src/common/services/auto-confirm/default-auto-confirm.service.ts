import { combineLatest, filter, firstValueFrom, map, Observable, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AutomaticUserConfirmationService } from "@bitwarden/common/admin-console/abstractions/auto-confirm/auto-confirm.service.abstraction";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import {
  AUTO_CONFIRM_STATE,
  AutoConfirmState,
} from "@bitwarden/common/admin-console/services/auto-confirm/auto-confirm.state";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { getById } from "@bitwarden/common/platform/misc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { OrganizationUserApiService } from "../../organization-user";
import { OrganizationUserService } from "../../organization-user/abstractions/organization-user.service";

export class DefaultAutomaticUserConfirmationService implements AutomaticUserConfirmationService {
  constructor(
    private configService: ConfigService,
    private apiService: ApiService,
    private organizationUserService: OrganizationUserService,
    private stateProvider: StateProvider,
    private organizationService: InternalOrganizationServiceAbstraction,
    private organizationUserApiService: OrganizationUserApiService,
  ) {}
  private autoConfirmState(userId: UserId) {
    return this.stateProvider.getUser(userId, AUTO_CONFIRM_STATE);
  }

  configuration$(userId: UserId): Observable<AutoConfirmState> {
    return this.autoConfirmState(userId).state$.pipe(
      map((records) => records![userId] ?? new AutoConfirmState()),
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

  async autoConfirmUser(userId: UserId, organization: Organization): Promise<void> {
    await firstValueFrom(
      this.canManageAutoConfirm$(userId, organization.id).pipe(
        filter((canManage) => canManage),
        switchMap(() => this.apiService.getUserPublicKey(userId)),
        map((publicKeyResponse) => Utils.fromB64ToArray(publicKeyResponse.publicKey)),
        switchMap((publicKey) =>
          this.organizationUserService.buildConfirmRequest(organization, publicKey),
        ),
        switchMap((request) =>
          this.organizationUserApiService.postOrganizationUserConfirm(
            organization.id,
            userId,
            request,
          ),
        ),
      ),
    );
  }
}
