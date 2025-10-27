import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { OrganizationUserView } from "../../../core/views/organization-user.view";
import { EntityEventsComponent } from "../../../manage/entity-events.component";
import { AccountRecoveryDialogComponent } from "../../components/account-recovery/account-recovery-dialog.component";
import { BulkConfirmDialogComponent } from "../../components/bulk/bulk-confirm-dialog.component";
import { BulkDeleteDialogComponent } from "../../components/bulk/bulk-delete-dialog.component";
import { BulkEnableSecretsManagerDialogComponent } from "../../components/bulk/bulk-enable-sm-dialog.component";
import { BulkRemoveDialogComponent } from "../../components/bulk/bulk-remove-dialog.component";
import { BulkRestoreRevokeComponent } from "../../components/bulk/bulk-restore-revoke.component";
import { BulkStatusComponent } from "../../components/bulk/bulk-status.component";
import {
  MemberDialogComponent,
  MemberDialogResult,
  MemberDialogTab,
} from "../../components/member-dialog";
import { DeleteManagedMemberWarningService } from "../delete-managed-member/delete-managed-member-warning.service";

import { MemberDialogManagerService } from "./member-dialog-manager.service";

describe("MemberDialogManagerService", () => {
  let service: MemberDialogManagerService;
  let dialogService: MockProxy<DialogService>;
  let i18nService: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;
  let userNamePipe: MockProxy<UserNamePipe>;
  let deleteManagedMemberWarningService: MockProxy<DeleteManagedMemberWarningService>;

  let mockOrganization: Organization;
  let mockUser: OrganizationUserView;
  let mockBillingMetadata: OrganizationBillingMetadataResponse;

  beforeEach(() => {
    dialogService = mock<DialogService>();
    i18nService = mock<I18nService>();
    toastService = mock<ToastService>();
    userNamePipe = mock<UserNamePipe>();
    deleteManagedMemberWarningService = mock<DeleteManagedMemberWarningService>();

    service = new MemberDialogManagerService(
      dialogService,
      i18nService,
      toastService,
      userNamePipe,
      deleteManagedMemberWarningService,
    );

    // Setup mock data
    mockOrganization = {
      id: "org-id",
      canManageUsers: true,
      productTierType: ProductTierType.Enterprise,
    } as Organization;

    mockUser = {
      id: "user-id",
      email: "test@example.com",
      name: "Test User",
      usesKeyConnector: false,
      status: OrganizationUserStatusType.Confirmed,
      hasMasterPassword: true,
      accessSecretsManager: false,
      managedByOrganization: false,
    } as OrganizationUserView;

    mockBillingMetadata = {
      organizationOccupiedSeats: 10,
      isOnSecretsManagerStandalone: false,
    } as OrganizationBillingMetadataResponse;

    userNamePipe.transform.mockReturnValue("Test User");
  });

  describe("openInviteDialog", () => {
    it("should open the invite dialog with correct parameters", async () => {
      const mockDialogRef = { closed: of(MemberDialogResult.Saved) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const allUserEmails = ["user1@example.com", "user2@example.com"];

      const result = await service.openInviteDialog(
        mockOrganization,
        mockBillingMetadata,
        allUserEmails,
      );

      expect(dialogService.open).toHaveBeenCalledWith(
        MemberDialogComponent,
        expect.objectContaining({
          data: {
            kind: "Add",
            organizationId: mockOrganization.id,
            allOrganizationUserEmails: allUserEmails,
            occupiedSeatCount: 10,
            isOnSecretsManagerStandalone: false,
          },
        }),
      );
      expect(result).toBe(MemberDialogResult.Saved);
    });

    it("should return Canceled when dialog is closed without result", async () => {
      const mockDialogRef = { closed: of(null) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const result = await service.openInviteDialog(mockOrganization, mockBillingMetadata, []);

      expect(result).toBe(MemberDialogResult.Canceled);
    });

    it("should handle null billing metadata", async () => {
      const mockDialogRef = { closed: of(MemberDialogResult.Saved) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      await service.openInviteDialog(mockOrganization, null, []);

      expect(dialogService.open).toHaveBeenCalledWith(
        MemberDialogComponent,
        expect.objectContaining({
          data: expect.objectContaining({
            occupiedSeatCount: 0,
            isOnSecretsManagerStandalone: false,
          }),
        }),
      );
    });
  });

  describe("openEditDialog", () => {
    it("should open the edit dialog with correct parameters", async () => {
      const mockDialogRef = { closed: of(MemberDialogResult.Saved) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const result = await service.openEditDialog(mockUser, mockOrganization, mockBillingMetadata);

      expect(dialogService.open).toHaveBeenCalledWith(
        MemberDialogComponent,
        expect.objectContaining({
          data: {
            kind: "Edit",
            name: "Test User",
            organizationId: mockOrganization.id,
            organizationUserId: mockUser.id,
            usesKeyConnector: false,
            isOnSecretsManagerStandalone: false,
            initialTab: MemberDialogTab.Role,
            managedByOrganization: false,
          },
        }),
      );
      expect(result).toBe(MemberDialogResult.Saved);
    });

    it("should use custom initial tab when provided", async () => {
      const mockDialogRef = { closed: of(MemberDialogResult.Saved) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      await service.openEditDialog(
        mockUser,
        mockOrganization,
        mockBillingMetadata,
        MemberDialogTab.AccountRecovery,
      );

      expect(dialogService.open).toHaveBeenCalledWith(
        MemberDialogComponent,
        expect.objectContaining({
          data: expect.objectContaining({
            initialTab: 0, // MemberDialogTab.AccountRecovery is 0
          }),
        }),
      );
    });

    it("should return Canceled when dialog is closed without result", async () => {
      const mockDialogRef = { closed: of(null) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const result = await service.openEditDialog(mockUser, mockOrganization, mockBillingMetadata);

      expect(result).toBe(MemberDialogResult.Canceled);
    });
  });

  describe("openAccountRecoveryDialog", () => {
    it("should open account recovery dialog with correct parameters", async () => {
      const mockDialogRef = { closed: of("recovered") };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const result = await service.openAccountRecoveryDialog(mockUser, mockOrganization);

      expect(dialogService.open).toHaveBeenCalledWith(
        AccountRecoveryDialogComponent,
        expect.objectContaining({
          data: {
            name: "Test User",
            email: mockUser.email,
            organizationId: mockOrganization.id,
            organizationUserId: mockUser.id,
          },
        }),
      );
      expect(result).toBe("recovered");
    });

    it("should return Ok when dialog is closed without result", async () => {
      const mockDialogRef = { closed: of(null) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const result = await service.openAccountRecoveryDialog(mockUser, mockOrganization);

      expect(result).toBe("ok");
    });
  });

  describe("openBulkConfirmDialog", () => {
    it("should open bulk confirm dialog with correct parameters", async () => {
      const mockDialogRef = { closed: of(undefined) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const users = [mockUser];
      await service.openBulkConfirmDialog(mockOrganization, users);

      expect(dialogService.open).toHaveBeenCalledWith(
        BulkConfirmDialogComponent,
        expect.objectContaining({
          data: {
            organization: mockOrganization,
            users: users,
          },
        }),
      );
    });
  });

  describe("openBulkRemoveDialog", () => {
    it("should open bulk remove dialog with correct parameters", async () => {
      const mockDialogRef = { closed: of(undefined) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const users = [mockUser];
      await service.openBulkRemoveDialog(mockOrganization, users);

      expect(dialogService.open).toHaveBeenCalledWith(
        BulkRemoveDialogComponent,
        expect.objectContaining({
          data: {
            organizationId: mockOrganization.id,
            users: users,
          },
        }),
      );
    });
  });

  describe("openBulkDeleteDialog", () => {
    it("should open bulk delete dialog when warning already acknowledged", async () => {
      deleteManagedMemberWarningService.warningAcknowledged.mockReturnValue(of(true));

      const mockDialogRef = { closed: of(undefined) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const users = [mockUser];
      await service.openBulkDeleteDialog(mockOrganization, users);

      expect(dialogService.open).toHaveBeenCalledWith(
        BulkDeleteDialogComponent,
        expect.objectContaining({
          data: {
            organizationId: mockOrganization.id,
            users: users,
          },
        }),
      );
      expect(deleteManagedMemberWarningService.showWarning).not.toHaveBeenCalled();
    });

    it("should show warning before opening dialog for enterprise organizations", async () => {
      deleteManagedMemberWarningService.warningAcknowledged.mockReturnValue(of(false));
      deleteManagedMemberWarningService.showWarning.mockResolvedValue(true);

      const mockDialogRef = { closed: of(undefined) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const users = [mockUser];
      await service.openBulkDeleteDialog(mockOrganization, users);

      expect(deleteManagedMemberWarningService.showWarning).toHaveBeenCalled();
      expect(dialogService.open).toHaveBeenCalled();
    });

    it("should not open dialog if warning is not acknowledged", async () => {
      deleteManagedMemberWarningService.warningAcknowledged.mockReturnValue(of(false));
      deleteManagedMemberWarningService.showWarning.mockResolvedValue(false);

      const users = [mockUser];
      await service.openBulkDeleteDialog(mockOrganization, users);

      expect(deleteManagedMemberWarningService.showWarning).toHaveBeenCalled();
      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("should skip warning for non-enterprise organizations", async () => {
      const nonEnterpriseOrg = {
        ...mockOrganization,
        productTierType: ProductTierType.Free,
      } as Organization;

      deleteManagedMemberWarningService.warningAcknowledged.mockReturnValue(of(false));

      const mockDialogRef = { closed: of(undefined) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const users = [mockUser];
      await service.openBulkDeleteDialog(nonEnterpriseOrg, users);

      expect(deleteManagedMemberWarningService.showWarning).not.toHaveBeenCalled();
      expect(dialogService.open).toHaveBeenCalled();
    });
  });

  describe("openBulkRestoreRevokeDialog", () => {
    it("should open bulk restore revoke dialog with correct parameters for revoking", async () => {
      const mockDialogRef = { closed: of(undefined) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const users = [mockUser];
      await service.openBulkRestoreRevokeDialog(mockOrganization, users, true);

      expect(dialogService.open).toHaveBeenCalledWith(
        BulkRestoreRevokeComponent,
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: mockOrganization.id,
            users: users,
            isRevoking: true,
          }),
        }),
      );
    });

    it("should open bulk restore revoke dialog with correct parameters for restoring", async () => {
      const mockDialogRef = { closed: of(undefined) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const users = [mockUser];
      await service.openBulkRestoreRevokeDialog(mockOrganization, users, false);

      expect(dialogService.open).toHaveBeenCalledWith(
        BulkRestoreRevokeComponent,
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: mockOrganization.id,
            users: users,
            isRevoking: false,
          }),
        }),
      );
    });
  });

  describe("openBulkEnableSecretsManagerDialog", () => {
    it("should open dialog with eligible users only", async () => {
      const mockDialogRef = { closed: of(undefined) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const user1 = { ...mockUser, accessSecretsManager: false } as OrganizationUserView;
      const user2 = {
        ...mockUser,
        id: "user-2",
        accessSecretsManager: true,
      } as OrganizationUserView;
      const users = [user1, user2];

      await service.openBulkEnableSecretsManagerDialog(mockOrganization, users);

      expect(dialogService.open).toHaveBeenCalledWith(
        BulkEnableSecretsManagerDialogComponent,
        expect.objectContaining({
          data: expect.objectContaining({
            orgId: mockOrganization.id,
            users: [user1],
          }),
        }),
      );
    });

    it("should show error toast when no eligible users", async () => {
      i18nService.t.mockImplementation((key) => key);

      const user1 = { ...mockUser, accessSecretsManager: true } as OrganizationUserView;
      const users = [user1];

      await service.openBulkEnableSecretsManagerDialog(mockOrganization, users);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "errorOccurred",
        message: "noSelectedUsersApplicable",
      });
      expect(dialogService.open).not.toHaveBeenCalled();
    });
  });

  describe("openBulkStatusDialog", () => {
    it("should open bulk status dialog with correct parameters", async () => {
      const mockDialogRef = { closed: of(undefined) };
      dialogService.open.mockReturnValue(mockDialogRef as any);

      const users = [mockUser];
      const filteredUsers = [mockUser];
      const request = Promise.resolve();
      const successMessage = "Success!";

      await service.openBulkStatusDialog(users, filteredUsers, request, successMessage);

      expect(dialogService.open).toHaveBeenCalledWith(
        BulkStatusComponent,
        expect.objectContaining({
          data: {
            users: users,
            filteredUsers: filteredUsers,
            request: request,
            successfulMessage: successMessage,
          },
        }),
      );
    });
  });

  describe("openEventsDialog", () => {
    it("should open events dialog with correct parameters", () => {
      service.openEventsDialog(mockUser, mockOrganization);

      expect(dialogService.open).toHaveBeenCalledWith(
        EntityEventsComponent,
        expect.objectContaining({
          data: {
            name: "Test User",
            organizationId: mockOrganization.id,
            entityId: mockUser.id,
            showUser: false,
            entity: "user",
          },
        }),
      );
    });
  });

  describe("openRemoveUserConfirmationDialog", () => {
    it("should return true when user confirms removal", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      const result = await service.openRemoveUserConfirmationDialog(mockUser);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: {
          key: "removeUserIdAccess",
          placeholders: ["Test User"],
        },
        content: { key: "removeOrgUserConfirmation" },
        type: "warning",
      });
      expect(result).toBe(true);
    });

    it("should show key connector warning when user uses key connector", async () => {
      const keyConnectorUser = { ...mockUser, usesKeyConnector: true } as OrganizationUserView;
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.openRemoveUserConfirmationDialog(keyConnectorUser);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { key: "removeUserConfirmationKeyConnector" },
        }),
      );
    });

    it("should return false when user cancels confirmation", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      const result = await service.openRemoveUserConfirmationDialog(mockUser);

      expect(result).toBe(false);
    });

    it("should show no master password warning for confirmed users without master password", async () => {
      const noMpUser = {
        ...mockUser,
        status: OrganizationUserStatusType.Confirmed,
        hasMasterPassword: false,
      } as OrganizationUserView;

      dialogService.openSimpleDialog.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

      const result = await service.openRemoveUserConfirmationDialog(noMpUser);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(2);
      expect(dialogService.openSimpleDialog).toHaveBeenLastCalledWith({
        title: {
          key: "removeOrgUserNoMasterPasswordTitle",
        },
        content: {
          key: "removeOrgUserNoMasterPasswordDesc",
          placeholders: ["Test User"],
        },
        type: "warning",
      });
      expect(result).toBe(true);
    });
  });

  describe("openRevokeUserConfirmationDialog", () => {
    it("should return true when user confirms revocation", async () => {
      i18nService.t.mockReturnValue("Revoke user confirmation");
      dialogService.openSimpleDialog.mockResolvedValue(true);

      const result = await service.openRevokeUserConfirmationDialog(mockUser);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "revokeAccess", placeholders: ["Test User"] },
        content: "Revoke user confirmation",
        acceptButtonText: { key: "revokeAccess" },
        type: "warning",
      });
      expect(result).toBe(true);
    });

    it("should return false when user cancels confirmation", async () => {
      i18nService.t.mockReturnValue("Revoke user confirmation");
      dialogService.openSimpleDialog.mockResolvedValue(false);

      const result = await service.openRevokeUserConfirmationDialog(mockUser);

      expect(result).toBe(false);
    });

    it("should show no master password warning for confirmed users without master password", async () => {
      const noMpUser = {
        ...mockUser,
        status: OrganizationUserStatusType.Confirmed,
        hasMasterPassword: false,
      } as OrganizationUserView;

      i18nService.t.mockReturnValue("Revoke user confirmation");
      dialogService.openSimpleDialog.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

      const result = await service.openRevokeUserConfirmationDialog(noMpUser);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });
  });

  describe("openDeleteUserConfirmationDialog", () => {
    it("should return true when user confirms deletion", async () => {
      deleteManagedMemberWarningService.warningAcknowledged.mockReturnValue(of(true));
      dialogService.openSimpleDialog.mockResolvedValue(true);

      const result = await service.openDeleteUserConfirmationDialog(mockUser, mockOrganization);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: {
          key: "deleteOrganizationUser",
          placeholders: ["Test User"],
        },
        content: {
          key: "deleteOrganizationUserWarningDesc",
          placeholders: ["Test User"],
        },
        type: "warning",
        acceptButtonText: { key: "delete" },
        cancelButtonText: { key: "cancel" },
      });
      expect(deleteManagedMemberWarningService.acknowledgeWarning).toHaveBeenCalledWith(
        mockOrganization.id,
      );
      expect(result).toBe(true);
    });

    it("should show warning before deletion for enterprise organizations", async () => {
      deleteManagedMemberWarningService.warningAcknowledged.mockReturnValue(of(false));
      deleteManagedMemberWarningService.showWarning.mockResolvedValue(true);
      dialogService.openSimpleDialog.mockResolvedValue(true);

      const result = await service.openDeleteUserConfirmationDialog(mockUser, mockOrganization);

      expect(deleteManagedMemberWarningService.showWarning).toHaveBeenCalled();
      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return false if warning is not acknowledged", async () => {
      deleteManagedMemberWarningService.warningAcknowledged.mockReturnValue(of(false));
      deleteManagedMemberWarningService.showWarning.mockResolvedValue(false);

      const result = await service.openDeleteUserConfirmationDialog(mockUser, mockOrganization);

      expect(deleteManagedMemberWarningService.showWarning).toHaveBeenCalled();
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should skip warning for non-enterprise organizations", async () => {
      const nonEnterpriseOrg = {
        ...mockOrganization,
        productTierType: ProductTierType.Free,
      } as Organization;

      deleteManagedMemberWarningService.warningAcknowledged.mockReturnValue(of(false));
      dialogService.openSimpleDialog.mockResolvedValue(true);

      const result = await service.openDeleteUserConfirmationDialog(mockUser, nonEnterpriseOrg);

      expect(deleteManagedMemberWarningService.showWarning).not.toHaveBeenCalled();
      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return false when user cancels confirmation", async () => {
      deleteManagedMemberWarningService.warningAcknowledged.mockReturnValue(of(true));
      dialogService.openSimpleDialog.mockResolvedValue(false);

      const result = await service.openDeleteUserConfirmationDialog(mockUser, mockOrganization);

      expect(result).toBe(false);
      expect(deleteManagedMemberWarningService.acknowledgeWarning).not.toHaveBeenCalled();
    });
  });
});
