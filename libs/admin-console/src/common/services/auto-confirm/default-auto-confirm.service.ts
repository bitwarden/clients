import { firstValueFrom, map, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AutomaticUserConfirmationService } from "@bitwarden/common/admin-console/abstractions/auto-confirm/auto-confirm.service.abstraction";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import {
  AUTO_CONFIRM_STATE,
  AutoConfirmState,
} from "@bitwarden/common/admin-console/services/auto-confirm/auto-confirm.state";
import { getById } from "@bitwarden/common/platform/misc";
//import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { OrganizationUserService } from "../../organization-user/abstractions/organization-user.service";

export class DefaultAutomaticUserConfirmationService implements AutomaticUserConfirmationService {
  constructor(
    private apiService: ApiService,
    private organizationUserService: OrganizationUserService,
    private stateProvider: StateProvider,
    private organizationService: InternalOrganizationServiceAbstraction,
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
    return this.organizationService.organizations$(userId).pipe(
      getById(organizationId),
      map(
        (organization) => organization?.canManageUsers ?? false, // && organization.useAutomaticUserConfirmation && feature flag check
      ),
    );
  }

  async autoConfirmUser(userId: UserId, organization: Organization): Promise<void> {
    const canManageAutoConfirm = await firstValueFrom(
      this.canManageAutoConfirm$(userId, organization.id),
    );
    if (!canManageAutoConfirm) {
      throw new Error("Cannot manage auto confirm");
    }

    //const publicKeyResponse = await this.apiService.getUserPublicKey(userId);
    //const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);
    //const _confirmRequest = this.organizationUserService.buildConfirmRequest(
    //  organization,
    //  publicKey,
    //);

    //@TODO: Call the new server endpoint to confirm users with the request here using _confirmRequest.
    return;
  }
}
