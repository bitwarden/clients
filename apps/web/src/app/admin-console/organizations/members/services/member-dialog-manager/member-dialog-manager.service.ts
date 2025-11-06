import { Injectable } from "@angular/core";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

import { OrganizationUserView } from "../../../core/views/organization-user.view";
import { openEntityEventsDialog } from "../../../manage/entity-events.component";
import {
  AccountRecoveryDialogComponent,
  AccountRecoveryDialogResultType,
} from "../../components/account-recovery/account-recovery-dialog.component";
import { BulkConfirmDialogComponent } from "../../components/bulk/bulk-confirm-dialog.component";
import { BulkDeleteDialogComponent } from "../../components/bulk/bulk-delete-dialog.component";
import { BulkEnableSecretsManagerDialogComponent } from "../../components/bulk/bulk-enable-sm-dialog.component";
import { BulkRemoveDialogComponent } from "../../components/bulk/bulk-remove-dialog.component";
import { BulkRestoreRevokeComponent } from "../../components/bulk/bulk-restore-revoke.component";
import { BulkStatusComponent } from "../../components/bulk/bulk-status.component";
import {
  MemberDialogResult,
  MemberDialogTab,
  openUserAddEditDialog,
} from "../../components/member-dialog";
import { DeleteManagedMemberWarningService } from "../delete-managed-member/delete-managed-member-warning.service";

@Injectable()
export class MemberDialogManagerService {
  constructor(
    private dialogService: DialogService,
    private i18nService: I18nService,
    private toastService: ToastService,
    private userNamePipe: UserNamePipe,
    private deleteManagedMemberWarningService: DeleteManagedMemberWarningService,
  ) {}

  async openInviteDialog(
    organization: Organization,
    billingMetadata: OrganizationBillingMetadataResponse,
    allUserEmails: string[],
  ): Promise<MemberDialogResult> {
    const dialog = openUserAddEditDialog(this.dialogService, {
      data: {
        kind: "Add",
        organizationId: organization.id,
        allOrganizationUserEmails: allUserEmails,
        occupiedSeatCount: billingMetadata?.organizationOccupiedSeats ?? 0,
        isOnSecretsManagerStandalone: billingMetadata?.isOnSecretsManagerStandalone ?? false,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    return result ?? MemberDialogResult.Canceled;
  }

  async openEditDialog(
    user: OrganizationUserView,
    organization: Organization,
    billingMetadata: OrganizationBillingMetadataResponse,
    initialTab: MemberDialogTab = MemberDialogTab.Role,
  ): Promise<MemberDialogResult> {
    const dialog = openUserAddEditDialog(this.dialogService, {
      data: {
        kind: "Edit",
        name: this.userNamePipe.transform(user),
        organizationId: organization.id,
        organizationUserId: user.id,
        usesKeyConnector: user.usesKeyConnector,
        isOnSecretsManagerStandalone: billingMetadata?.isOnSecretsManagerStandalone ?? false,
        initialTab: initialTab,
        managedByOrganization: user.managedByOrganization,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    return result ?? MemberDialogResult.Canceled;
  }

  async openAccountRecoveryDialog(
    user: OrganizationUserView,
    organization: Organization,
  ): Promise<AccountRecoveryDialogResultType> {
    const dialogRef = AccountRecoveryDialogComponent.open(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(user),
        email: user.email,
        organizationId: organization.id as OrganizationId,
        organizationUserId: user.id,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);
    return result ?? AccountRecoveryDialogResultType.Ok;
  }

  async openBulkConfirmDialog(
    organization: Organization,
    users: OrganizationUserView[],
  ): Promise<void> {
    const dialogRef = BulkConfirmDialogComponent.open(this.dialogService, {
      data: {
        organization: organization,
        users: users,
      },
    });

    await lastValueFrom(dialogRef.closed);
  }

  async openBulkRemoveDialog(
    organization: Organization,
    users: OrganizationUserView[],
  ): Promise<void> {
    const dialogRef = BulkRemoveDialogComponent.open(this.dialogService, {
      data: {
        organizationId: organization.id,
        users: users,
      },
    });

    await lastValueFrom(dialogRef.closed);
  }

  async openBulkDeleteDialog(
    organization: Organization,
    users: OrganizationUserView[],
  ): Promise<void> {
    const warningAcknowledged = await firstValueFrom(
      this.deleteManagedMemberWarningService.warningAcknowledged(organization.id),
    );

    if (
      !warningAcknowledged &&
      organization.canManageUsers &&
      organization.productTierType === ProductTierType.Enterprise
    ) {
      const acknowledged = await this.deleteManagedMemberWarningService.showWarning();
      if (!acknowledged) {
        return;
      }
    }

    const dialogRef = BulkDeleteDialogComponent.open(this.dialogService, {
      data: {
        organizationId: organization.id,
        users: users,
      },
    });

    await lastValueFrom(dialogRef.closed);
  }

  async openBulkRestoreRevokeDialog(
    organization: Organization,
    users: OrganizationUserView[],
    isRevoking: boolean,
  ): Promise<void> {
    const ref = BulkRestoreRevokeComponent.open(this.dialogService, {
      organizationId: organization.id,
      users: users,
      isRevoking: isRevoking,
    });

    await firstValueFrom(ref.closed);
  }

  async openBulkEnableSecretsManagerDialog(
    organization: Organization,
    users: OrganizationUserView[],
  ): Promise<void> {
    const eligibleUsers = users.filter((ou) => !ou.accessSecretsManager);

    if (eligibleUsers.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("noSelectedUsersApplicable"),
      });
      return;
    }

    const dialogRef = BulkEnableSecretsManagerDialogComponent.open(this.dialogService, {
      orgId: organization.id,
      users: eligibleUsers,
    });

    await lastValueFrom(dialogRef.closed);
  }

  async openBulkStatusDialog(
    users: OrganizationUserView[],
    filteredUsers: OrganizationUserView[],
    request: Promise<any>,
    successMessage: string,
  ): Promise<void> {
    const dialogRef = BulkStatusComponent.open(this.dialogService, {
      data: {
        users: users,
        filteredUsers: filteredUsers,
        request: request,
        successfulMessage: successMessage,
      },
    });

    await lastValueFrom(dialogRef.closed);
  }

  openEventsDialog(user: OrganizationUserView, organization: Organization): void {
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(user),
        organizationId: organization.id,
        entityId: user.id,
        showUser: false,
        entity: "user",
      },
    });
  }

  async openRemoveUserConfirmationDialog(user: OrganizationUserView): Promise<boolean> {
    const content = user.usesKeyConnector
      ? "removeUserConfirmationKeyConnector"
      : "removeOrgUserConfirmation";

    const confirmed = await this.dialogService.openSimpleDialog({
      title: {
        key: "removeUserIdAccess",
        placeholders: [this.userNamePipe.transform(user)],
      },
      content: { key: content },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    if (user.status > 0 && user.hasMasterPassword === false) {
      return await this.openNoMasterPasswordConfirmationDialog(user);
    }

    return true;
  }

  async openRevokeUserConfirmationDialog(user: OrganizationUserView): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "revokeAccess", placeholders: [this.userNamePipe.transform(user)] },
      content: this.i18nService.t("revokeUserConfirmation"),
      acceptButtonText: { key: "revokeAccess" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    if (user.status > 0 && user.hasMasterPassword === false) {
      return await this.openNoMasterPasswordConfirmationDialog(user);
    }

    return true;
  }

  async openDeleteUserConfirmationDialog(
    user: OrganizationUserView,
    organization: Organization,
  ): Promise<boolean> {
    const warningAcknowledged = await firstValueFrom(
      this.deleteManagedMemberWarningService.warningAcknowledged(organization.id),
    );

    if (
      !warningAcknowledged &&
      organization.canManageUsers &&
      organization.productTierType === ProductTierType.Enterprise
    ) {
      const acknowledged = await this.deleteManagedMemberWarningService.showWarning();
      if (!acknowledged) {
        return false;
      }
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: {
        key: "deleteOrganizationUser",
        placeholders: [this.userNamePipe.transform(user)],
      },
      content: {
        key: "deleteOrganizationUserWarningDesc",
        placeholders: [this.userNamePipe.transform(user)],
      },
      type: "warning",
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
    });

    if (confirmed) {
      await this.deleteManagedMemberWarningService.acknowledgeWarning(organization.id);
    }

    return confirmed;
  }

  private async openNoMasterPasswordConfirmationDialog(
    user: OrganizationUserView,
  ): Promise<boolean> {
    return this.dialogService.openSimpleDialog({
      title: {
        key: "removeOrgUserNoMasterPasswordTitle",
      },
      content: {
        key: "removeOrgUserNoMasterPasswordDesc",
        placeholders: [this.userNamePipe.transform(user)],
      },
      type: "warning",
    });
  }
}
