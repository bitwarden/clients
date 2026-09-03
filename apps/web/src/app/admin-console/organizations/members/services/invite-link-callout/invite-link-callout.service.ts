import { inject, Injectable } from "@angular/core";
import { firstValueFrom, map, Observable } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import {
  INVITE_LINK_CALLOUT_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { MemberDialogManagerService } from "../member-dialog-manager/member-dialog-manager.service";
import { OrganizationMembersService } from "../organization-members-service/organization-members.service";

export const INVITE_LINK_CALLOUT_DISMISSED_KEY = new UserKeyDefinition<string[]>(
  INVITE_LINK_CALLOUT_DISK,
  "inviteLinkCalloutDismissed",
  {
    deserializer: (b) => b,
    clearOn: [],
  },
);

@Injectable({ providedIn: "root" })
export class InviteLinkCalloutService {
  private stateProvider = inject(StateProvider);
  private memberDialogManager = inject(MemberDialogManagerService);
  private organizationMembersService = inject(OrganizationMembersService);
  private organizationMetadataService = inject(OrganizationMetadataServiceAbstraction);

  private dismissedState = this.stateProvider.getActive(INVITE_LINK_CALLOUT_DISMISSED_KEY);

  isDismissed$(orgId: string): Observable<boolean> {
    return this.dismissedState.state$.pipe(
      map((dismissedIds) => dismissedIds?.includes(orgId) ?? false),
    );
  }

  async dismiss(orgId: string): Promise<void> {
    await this.dismissedState.update((state) => {
      if (!orgId) {
        return state;
      }
      if (!state) {
        return [orgId];
      }
      if (state.includes(orgId)) {
        return state;
      }
      return [...state, orgId];
    });
  }

  async showIfEligible(organization: Organization): Promise<void> {
    if (!organization.canManageUsers) {
      return;
    }

    const dismissed = await firstValueFrom(this.isDismissed$(organization.id));
    if (dismissed) {
      return;
    }

    const billingMetadata = await firstValueFrom(
      this.organizationMetadataService.getOrganizationMetadata$(organization.id as OrganizationId),
    );
    const allUsers = await this.organizationMembersService.loadUsers(organization);

    await this.memberDialogManager.openInviteDialog(organization, billingMetadata, allUsers, true);
  }
}
