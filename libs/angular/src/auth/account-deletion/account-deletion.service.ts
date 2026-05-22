import { Injectable } from "@angular/core";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { DialogService } from "@bitwarden/components";

import { DeleteAccountDialogComponent } from "./delete-account-dialog/delete-account-dialog.component";

@Injectable()
export class AccountDeletionService {
  constructor(
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private dialogService: DialogService,
  ) {}

  async openDeleteAccountFlow(): Promise<void> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const organizations = await firstValueFrom(this.organizationService.organizations$(userId));

    const userIsManaged = organizations.some((o) => o.userIsManagedByOrganization === true);

    if (userIsManaged) {
      await this.dialogService.openSimpleDialog({
        title: { key: "cannotDeleteAccount" },
        content: { key: "cannotDeleteAccountDesc" },
        acceptButtonText: { key: "close" },
        cancelButtonText: null,
        type: "danger",
      });
      return;
    }

    const confirmedOwnerOrgs = organizations.filter(
      (org) => org.isOwner && org.isMember && org.status === OrganizationUserStatusType.Confirmed,
    );

    const ownsPaidOrg = confirmedOwnerOrgs.some(
      (org) => org.productTierType !== ProductTierType.Free,
    );

    if (ownsPaidOrg) {
      await this.dialogService.openSimpleDialog({
        title: { key: "cannotDeleteAccount" },
        content: { key: "cannotDeleteAccountOrganizationOwnerDesc" },
        acceptButtonText: { key: "close" },
        cancelButtonText: null,
        type: "danger",
      });
      return;
    }

    const ownsFreeOrg = confirmedOwnerOrgs.some(
      (org) => org.productTierType === ProductTierType.Free,
    );

    if (ownsFreeOrg) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "deleteAccount" },
        content: { key: "deleteAccountOrganizationOwnerWarning" },
        acceptButtonText: { key: "deleteAccount" },
        cancelButtonText: { key: "cancel" },
        type: "warning",
      });
      if (!confirmed) {
        return;
      }
    }

    const dialogRef = DeleteAccountDialogComponent.open(this.dialogService);
    await lastValueFrom(dialogRef.closed);
  }
}
