import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  INVITE_LINK_CALLOUT_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { OrganizationInviteLinkService } from "@bitwarden/organization-invite-link";

import {
  InviteLinkCalloutDialogComponent,
  InviteLinkCalloutDialogResult,
} from "../../components/invite-link-callout-dialog/invite-link-callout-dialog.component";
import { MemberDialogManagerService } from "../member-dialog-manager/member-dialog-manager.service";
import { OrganizationMembersService } from "../organization-members-service/organization-members.service";

export const INVITE_LINK_CALLOUT_DISMISSED_KEY = new UserKeyDefinition<OrganizationId[]>(
  INVITE_LINK_CALLOUT_DISK,
  "inviteLinkCalloutDismissed",
  {
    deserializer: (b) => b,
    clearOn: [],
  },
);

@Injectable({ providedIn: "root" })
export class InviteLinkCalloutService {
  private accountService = inject(AccountService);
  private configService = inject(ConfigService);
  private stateProvider = inject(StateProvider);
  private memberDialogManager = inject(MemberDialogManagerService);
  private organizationMembersService = inject(OrganizationMembersService);
  private organizationMetadataService = inject(OrganizationMetadataServiceAbstraction);
  private organizationInviteLinkService = inject(OrganizationInviteLinkService);
  private dialogService = inject(DialogService);
  private router = inject(Router);

  isDismissed$(orgId: OrganizationId): Observable<boolean> {
    return this.accountService.activeAccount$.pipe(
      switchMap((account) => {
        if (!account) {
          return of(false);
        }
        return this.stateProvider
          .getUserState$(INVITE_LINK_CALLOUT_DISMISSED_KEY, account.id)
          .pipe(map((dismissedIds) => dismissedIds?.includes(orgId) ?? false));
      }),
    );
  }

  async dismiss(orgId: OrganizationId): Promise<void> {
    if (!orgId) {
      return;
    }

    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return;
    }

    await this.stateProvider
      .getUser(account.id, INVITE_LINK_CALLOUT_DISMISSED_KEY)
      .update((state) => {
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

    if (!organization.useInviteLinks) {
      return;
    }

    if (!(await this.configService.getFeatureFlag(FeatureFlag.InviteLinkNotification))) {
      return;
    }

    const dismissed = await firstValueFrom(this.isDismissed$(organization.id));
    if (dismissed) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const existingLink = await firstValueFrom(
      this.organizationInviteLinkService.inviteLink$(userId, organization.id),
    );
    if (existingLink != null) {
      await this.dismiss(organization.id);
      return;
    }

    const dialogRef = InviteLinkCalloutDialogComponent.open(this.dialogService);
    const closedWith = await firstValueFrom(dialogRef.closed);

    await this.dismiss(organization.id);

    if (closedWith !== InviteLinkCalloutDialogResult.ShowMeHow) {
      return;
    }

    await this.router.navigate(["organizations", organization.id, "members"]);

    const billingMetadata = await firstValueFrom(
      this.organizationMetadataService.getOrganizationMetadata$(organization.id),
    );
    const allUsers = await this.organizationMembersService.loadUsers(organization);

    await this.memberDialogManager.openInviteDialog(organization, billingMetadata, allUsers, true);
  }
}
