import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";
import { BillingConstraintService } from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

import { OrganizationUserView } from "../core/views/organization-user.view";

import { AccountRecoveryDialogResultType } from "./components/account-recovery/account-recovery-dialog.component";
import { MemberDialogResult } from "./components/member-dialog";
import { vNextMembersComponent } from "./members.component";
import {
  MemberDialogManagerService,
  MemberExportService,
  OrganizationMembersService,
} from "./services";
import { DeleteManagedMemberWarningService } from "./services/delete-managed-member/delete-managed-member-warning.service";
import {
  MemberActionsService,
  MemberActionResult,
} from "./services/member-actions/member-actions.service";

describe("vNextMembersComponent", () => {
  let component: vNextMembersComponent;
  let fixture: ComponentFixture<vNextMembersComponent>;

  let mockApiService: MockProxy<ApiService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockOrganizationManagementPreferencesService: MockProxy<OrganizationManagementPreferencesService>;
  let mockKeyService: MockProxy<KeyService>;
  let mockValidationService: MockProxy<ValidationService>;
  let mockLogService: MockProxy<LogService>;
  let mockUserNamePipe: MockProxy<UserNamePipe>;
  let mockDialogService: MockProxy<DialogService>;
  let mockToastService: MockProxy<ToastService>;
  let mockActivatedRoute: ActivatedRoute;
  let mockDeleteManagedMemberWarningService: MockProxy<DeleteManagedMemberWarningService>;
  let mockOrganizationWarningsService: MockProxy<OrganizationWarningsService>;
  let mockMemberActionsService: MockProxy<MemberActionsService>;
  let mockMemberDialogManager: MockProxy<MemberDialogManagerService>;
  let mockBillingConstraint: MockProxy<BillingConstraintService>;
  let mockMemberService: MockProxy<OrganizationMembersService>;
  let mockOrganizationService: MockProxy<OrganizationService>;
  let mockAccountService: FakeAccountService;
  let mockPolicyService: MockProxy<PolicyService>;
  let mockPolicyApiService: MockProxy<PolicyApiServiceAbstraction>;
  let mockOrganizationMetadataService: MockProxy<OrganizationMetadataServiceAbstraction>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockEnvironmentService: MockProxy<EnvironmentService>;
  let mockMemberExportService: MockProxy<MemberExportService>;
  let mockFileDownloadService: MockProxy<FileDownloadService>;

  let routeParamsSubject: BehaviorSubject<any>;
  let queryParamsSubject: BehaviorSubject<any>;

  const mockUserId = newGuid() as UserId;
  const mockOrgId = newGuid() as OrganizationId;
  const mockOrg = {
    id: mockOrgId,
    name: "Test Organization",
    enabled: true,
    canManageUsers: true,
    useSecretsManager: true,
    useResetPassword: true,
    isProviderUser: false,
  } as Organization;

  const mockUser = {
    id: newGuid(),
    userId: newGuid(),
    type: OrganizationUserType.User,
    status: OrganizationUserStatusType.Confirmed,
    email: "test@example.com",
    name: "Test User",
    resetPasswordEnrolled: false,
    accessSecretsManager: false,
    managedByOrganization: false,
    twoFactorEnabled: false,
    usesKeyConnector: false,
    hasMasterPassword: true,
  } as OrganizationUserView;

  const mockBillingMetadata = {
    isSubscriptionUnpaid: false,
  } as Partial<OrganizationBillingMetadataResponse>;

  beforeEach(async () => {
    routeParamsSubject = new BehaviorSubject({ organizationId: mockOrgId });
    queryParamsSubject = new BehaviorSubject({});

    mockActivatedRoute = {
      params: routeParamsSubject.asObservable(),
      queryParams: queryParamsSubject.asObservable(),
    } as any;

    mockApiService = mock<ApiService>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);

    mockOrganizationManagementPreferencesService = mock<OrganizationManagementPreferencesService>();
    mockOrganizationManagementPreferencesService.autoConfirmFingerPrints = {
      state$: of(false),
    } as any;

    mockKeyService = mock<KeyService>();
    mockValidationService = mock<ValidationService>();
    mockLogService = mock<LogService>();
    mockUserNamePipe = mock<UserNamePipe>();
    mockUserNamePipe.transform.mockReturnValue("Test User");

    mockDialogService = mock<DialogService>();
    mockToastService = mock<ToastService>();
    mockDeleteManagedMemberWarningService = mock<DeleteManagedMemberWarningService>();
    mockOrganizationWarningsService = mock<OrganizationWarningsService>();
    mockMemberActionsService = mock<MemberActionsService>();
    mockMemberDialogManager = mock<MemberDialogManagerService>();
    mockBillingConstraint = mock<BillingConstraintService>();

    mockMemberService = mock<OrganizationMembersService>();
    mockMemberService.loadUsers.mockResolvedValue([mockUser]);

    mockOrganizationService = mock<OrganizationService>();
    mockOrganizationService.organizations$.mockReturnValue(of([mockOrg]));

    mockAccountService = mockAccountServiceWith(mockUserId);

    mockPolicyService = mock<PolicyService>();

    mockPolicyApiService = mock<PolicyApiServiceAbstraction>();
    mockOrganizationMetadataService = mock<OrganizationMetadataServiceAbstraction>();
    mockOrganizationMetadataService.getOrganizationMetadata$.mockReturnValue(
      of(mockBillingMetadata),
    );

    mockConfigService = mock<ConfigService>();
    mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

    mockEnvironmentService = mock<EnvironmentService>();
    mockEnvironmentService.environment$ = of({
      isCloud: () => false,
    } as any);

    mockMemberExportService = mock<MemberExportService>();
    mockFileDownloadService = mock<FileDownloadService>();

    await TestBed.configureTestingModule({
      declarations: [vNextMembersComponent],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: OrganizationManagementPreferencesService,
          useValue: mockOrganizationManagementPreferencesService,
        },
        { provide: KeyService, useValue: mockKeyService },
        { provide: ValidationService, useValue: mockValidationService },
        { provide: LogService, useValue: mockLogService },
        { provide: UserNamePipe, useValue: mockUserNamePipe },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        {
          provide: DeleteManagedMemberWarningService,
          useValue: mockDeleteManagedMemberWarningService,
        },
        { provide: OrganizationWarningsService, useValue: mockOrganizationWarningsService },
        { provide: MemberActionsService, useValue: mockMemberActionsService },
        { provide: MemberDialogManagerService, useValue: mockMemberDialogManager },
        { provide: BillingConstraintService, useValue: mockBillingConstraint },
        { provide: OrganizationMembersService, useValue: mockMemberService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: PolicyApiServiceAbstraction, useValue: mockPolicyApiService },
        {
          provide: OrganizationMetadataServiceAbstraction,
          useValue: mockOrganizationMetadataService,
        },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EnvironmentService, useValue: mockEnvironmentService },
        { provide: MemberExportService, useValue: mockMemberExportService },
        { provide: FileDownloadService, useValue: mockFileDownloadService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(vNextMembersComponent, {
        remove: { imports: [] },
        add: { template: "<div></div>" },
      })
      .compileComponents();

    fixture = TestBed.createComponent(vNextMembersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (fixture) {
      fixture.destroy();
    }
    jest.restoreAllMocks();
  });

  describe("load", () => {
    it("should load users and set data source", async () => {
      const users = [mockUser];
      mockMemberService.loadUsers.mockResolvedValue(users);

      await component.load(mockOrg);

      expect(mockMemberService.loadUsers).toHaveBeenCalledWith(mockOrg);
      expect(component["dataSource"]().data).toEqual(users);
      expect(component["firstLoaded"]()).toBe(true);
    });

    it("should handle empty response", async () => {
      mockMemberService.loadUsers.mockResolvedValue([]);

      await component.load(mockOrg);

      expect(component["dataSource"]().data).toEqual([]);
    });
  });

  describe("remove", () => {
    it("should remove user when confirmed", async () => {
      mockMemberDialogManager.openRemoveUserConfirmationDialog.mockResolvedValue(true);
      mockMemberActionsService.removeUser.mockResolvedValue({ success: true });

      const removeSpy = jest.spyOn(component["dataSource"](), "removeUser");

      await component.remove(mockUser, mockOrg);

      expect(mockMemberDialogManager.openRemoveUserConfirmationDialog).toHaveBeenCalledWith(
        mockUser,
      );
      expect(mockMemberActionsService.removeUser).toHaveBeenCalledWith(mockOrg, mockUser.id);
      expect(removeSpy).toHaveBeenCalledWith(mockUser);
      expect(mockToastService.showToast).toHaveBeenCalled();
    });

    it("should not remove user when not confirmed", async () => {
      mockMemberDialogManager.openRemoveUserConfirmationDialog.mockResolvedValue(false);

      const result = await component.remove(mockUser, mockOrg);

      expect(result).toBe(false);
      expect(mockMemberActionsService.removeUser).not.toHaveBeenCalled();
    });

    it("should handle errors via handleMemberActionResult", async () => {
      mockMemberDialogManager.openRemoveUserConfirmationDialog.mockResolvedValue(true);
      mockMemberActionsService.removeUser.mockResolvedValue({
        success: false,
        error: "Remove failed",
      });

      await component.remove(mockUser, mockOrg);

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "Remove failed",
      });
      expect(mockLogService.error).toHaveBeenCalledWith("Remove failed");
    });
  });

  describe("reinvite", () => {
    it("should reinvite user successfully", async () => {
      mockMemberActionsService.reinviteUser.mockResolvedValue({ success: true });

      await component.reinvite(mockUser, mockOrg);

      expect(mockMemberActionsService.reinviteUser).toHaveBeenCalledWith(mockOrg, mockUser.id);
      expect(mockToastService.showToast).toHaveBeenCalled();
    });

    it("should handle errors via handleMemberActionResult", async () => {
      mockMemberActionsService.reinviteUser.mockResolvedValue({
        success: false,
        error: "Reinvite failed",
      });

      await component.reinvite(mockUser, mockOrg);

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "Reinvite failed",
      });
      expect(mockLogService.error).toHaveBeenCalledWith("Reinvite failed");
    });
  });

  describe("confirm", () => {
    it("should confirm user with auto-confirm enabled", async () => {
      mockOrganizationManagementPreferencesService.autoConfirmFingerPrints.state$ = of(true);
      mockMemberActionsService.confirmUser.mockResolvedValue({ success: true });

      // Mock getPublicKeyForConfirm to return a public key
      const mockPublicKey = new Uint8Array([1, 2, 3, 4]);
      mockMemberActionsService.getPublicKeyForConfirm.mockResolvedValue(mockPublicKey);

      const replaceSpy = jest.spyOn(component["dataSource"](), "replaceUser");

      await component.confirm(mockUser, mockOrg);

      expect(mockMemberActionsService.getPublicKeyForConfirm).toHaveBeenCalledWith(mockUser);
      expect(mockMemberActionsService.confirmUser).toHaveBeenCalledWith(
        mockUser,
        mockPublicKey,
        mockOrg,
      );
      expect(replaceSpy).toHaveBeenCalled();
      expect(mockToastService.showToast).toHaveBeenCalled();
    });

    it("should handle null user", async () => {
      mockOrganizationManagementPreferencesService.autoConfirmFingerPrints.state$ = of(true);

      // Mock getPublicKeyForConfirm to return null
      mockMemberActionsService.getPublicKeyForConfirm.mockResolvedValue(null);

      await component.confirm(mockUser, mockOrg);

      expect(mockMemberActionsService.getPublicKeyForConfirm).toHaveBeenCalled();
      expect(mockMemberActionsService.confirmUser).not.toHaveBeenCalled();
      expect(mockLogService.warning).toHaveBeenCalledWith("Public key not found");
    });

    it("should handle API errors gracefully", async () => {
      // Mock getPublicKeyForConfirm to return null
      mockMemberActionsService.getPublicKeyForConfirm.mockResolvedValue(null);

      await component.confirm(mockUser, mockOrg);

      expect(mockMemberActionsService.getPublicKeyForConfirm).toHaveBeenCalled();
      expect(mockLogService.warning).toHaveBeenCalledWith("Public key not found");
    });
  });

  describe("revoke", () => {
    it("should revoke user when confirmed", async () => {
      mockMemberDialogManager.openRevokeUserConfirmationDialog.mockResolvedValue(true);
      mockMemberActionsService.revokeUser.mockResolvedValue({ success: true });
      mockMemberService.loadUsers.mockResolvedValue([mockUser]);

      await component.revoke(mockUser, mockOrg);

      expect(mockMemberDialogManager.openRevokeUserConfirmationDialog).toHaveBeenCalledWith(
        mockUser,
      );
      expect(mockMemberActionsService.revokeUser).toHaveBeenCalledWith(mockOrg, mockUser.id);
      expect(mockToastService.showToast).toHaveBeenCalled();
    });

    it("should not revoke user when not confirmed", async () => {
      mockMemberDialogManager.openRevokeUserConfirmationDialog.mockResolvedValue(false);

      const result = await component.revoke(mockUser, mockOrg);

      expect(result).toBe(false);
      expect(mockMemberActionsService.revokeUser).not.toHaveBeenCalled();
    });
  });

  describe("restore", () => {
    it("should restore user successfully", async () => {
      mockMemberActionsService.restoreUser.mockResolvedValue({ success: true });
      mockMemberService.loadUsers.mockResolvedValue([mockUser]);

      await component.restore(mockUser, mockOrg);

      expect(mockMemberActionsService.restoreUser).toHaveBeenCalledWith(mockOrg, mockUser.id);
      expect(mockToastService.showToast).toHaveBeenCalled();
      expect(mockMemberService.loadUsers).toHaveBeenCalledWith(mockOrg);
    });

    it("should handle errors via handleMemberActionResult", async () => {
      mockMemberActionsService.restoreUser.mockResolvedValue({
        success: false,
        error: "Restore failed",
      });

      await component.restore(mockUser, mockOrg);

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "Restore failed",
      });
      expect(mockLogService.error).toHaveBeenCalledWith("Restore failed");
    });
  });

  describe("invite", () => {
    it("should open invite dialog when seat limit not reached", async () => {
      mockBillingConstraint.seatLimitReached.mockResolvedValue(false);
      mockMemberDialogManager.openInviteDialog.mockResolvedValue(MemberDialogResult.Saved);

      await component.invite(mockOrg);

      expect(mockBillingConstraint.checkSeatLimit).toHaveBeenCalledWith(
        mockOrg,
        mockBillingMetadata,
      );
      expect(mockMemberDialogManager.openInviteDialog).toHaveBeenCalledWith(
        mockOrg,
        mockBillingMetadata,
        expect.any(Array),
      );
    });

    it("should reload organization and refresh metadata cache after successful invite", async () => {
      mockBillingConstraint.seatLimitReached.mockResolvedValue(false);
      mockMemberDialogManager.openInviteDialog.mockResolvedValue(MemberDialogResult.Saved);
      mockMemberService.loadUsers.mockResolvedValue([mockUser]);

      await component.invite(mockOrg);

      expect(mockMemberService.loadUsers).toHaveBeenCalledWith(mockOrg);
      expect(mockOrganizationMetadataService.refreshMetadataCache).toHaveBeenCalled();
    });

    it("should not open dialog when seat limit reached", async () => {
      mockBillingConstraint.seatLimitReached.mockResolvedValue(true);

      await component.invite(mockOrg);

      expect(mockMemberDialogManager.openInviteDialog).not.toHaveBeenCalled();
    });
  });

  describe("bulkRemove", () => {
    it("should open bulk remove dialog and reload", async () => {
      const users = [mockUser];
      jest.spyOn(component["dataSource"](), "getCheckedUsersWithLimit").mockReturnValue(users);
      mockMemberService.loadUsers.mockResolvedValue([mockUser]);

      await component.bulkRemove(mockOrg);

      expect(mockMemberDialogManager.openBulkRemoveDialog).toHaveBeenCalledWith(mockOrg, users);
      expect(mockOrganizationMetadataService.refreshMetadataCache).toHaveBeenCalled();
      expect(mockMemberService.loadUsers).toHaveBeenCalledWith(mockOrg);
    });
  });

  describe("bulkDelete", () => {
    it("should open bulk delete dialog and reload", async () => {
      const users = [mockUser];
      jest.spyOn(component["dataSource"](), "getCheckedUsersWithLimit").mockReturnValue(users);
      mockMemberService.loadUsers.mockResolvedValue([mockUser]);

      await component.bulkDelete(mockOrg);

      expect(mockMemberDialogManager.openBulkDeleteDialog).toHaveBeenCalledWith(mockOrg, users);
      expect(mockMemberService.loadUsers).toHaveBeenCalledWith(mockOrg);
    });
  });

  describe("bulkRevokeOrRestore", () => {
    it.each([
      { isRevoking: true, action: "revoke" },
      { isRevoking: false, action: "restore" },
    ])(
      "should open bulk $action dialog and reload when isRevoking is $isRevoking",
      async ({ isRevoking }) => {
        const users = [mockUser];
        jest.spyOn(component["dataSource"](), "getCheckedUsersWithLimit").mockReturnValue(users);
        mockMemberService.loadUsers.mockResolvedValue([mockUser]);

        await component.bulkRevokeOrRestore(isRevoking, mockOrg);

        expect(mockMemberDialogManager.openBulkRestoreRevokeDialog).toHaveBeenCalledWith(
          mockOrg,
          users,
          isRevoking,
        );
        expect(mockMemberService.loadUsers).toHaveBeenCalledWith(mockOrg);
      },
    );
  });

  describe("bulkReinvite", () => {
    it("should reinvite invited users", async () => {
      const invitedUser = {
        ...mockUser,
        status: OrganizationUserStatusType.Invited,
      };
      jest.spyOn(component["dataSource"](), "isIncreasedBulkLimitEnabled").mockReturnValue(false);
      jest.spyOn(component["dataSource"](), "getCheckedUsers").mockReturnValue([invitedUser]);
      mockMemberActionsService.bulkReinvite.mockResolvedValue({ successful: [{}], failed: [] });

      await component.bulkReinvite(mockOrg);

      expect(mockMemberActionsService.bulkReinvite).toHaveBeenCalledWith(mockOrg, [invitedUser]);
      expect(mockMemberDialogManager.openBulkStatusDialog).toHaveBeenCalled();
    });

    it("should show error when no invited users selected", async () => {
      const confirmedUser = {
        ...mockUser,
        status: OrganizationUserStatusType.Confirmed,
      };
      jest.spyOn(component["dataSource"](), "isIncreasedBulkLimitEnabled").mockReturnValue(false);
      jest.spyOn(component["dataSource"](), "getCheckedUsers").mockReturnValue([confirmedUser]);

      await component.bulkReinvite(mockOrg);

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "errorOccurred",
        message: "noSelectedUsersApplicable",
      });
      expect(mockMemberActionsService.bulkReinvite).not.toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      const invitedUser = {
        ...mockUser,
        status: OrganizationUserStatusType.Invited,
      };
      jest.spyOn(component["dataSource"](), "isIncreasedBulkLimitEnabled").mockReturnValue(false);
      jest.spyOn(component["dataSource"](), "getCheckedUsers").mockReturnValue([invitedUser]);
      const error = new Error("Bulk reinvite failed");
      mockMemberActionsService.bulkReinvite.mockResolvedValue({ successful: [], failed: error });

      await component.bulkReinvite(mockOrg);

      expect(mockValidationService.showError).toHaveBeenCalledWith(error);
    });
  });

  describe("bulkConfirm", () => {
    it("should open bulk confirm dialog and reload", async () => {
      const users = [mockUser];
      jest.spyOn(component["dataSource"](), "getCheckedUsersWithLimit").mockReturnValue(users);
      mockMemberService.loadUsers.mockResolvedValue([mockUser]);

      await component.bulkConfirm(mockOrg);

      expect(mockMemberDialogManager.openBulkConfirmDialog).toHaveBeenCalledWith(mockOrg, users);
      expect(mockMemberService.loadUsers).toHaveBeenCalledWith(mockOrg);
    });
  });

  describe("bulkEnableSM", () => {
    it("should open bulk enable SM dialog and reload", async () => {
      const users = [mockUser];
      jest.spyOn(component["dataSource"](), "getCheckedUsersWithLimit").mockReturnValue(users);
      jest.spyOn(component["dataSource"](), "uncheckAllUsers");
      mockMemberService.loadUsers.mockResolvedValue([mockUser]);

      await component.bulkEnableSM(mockOrg);

      expect(mockMemberDialogManager.openBulkEnableSecretsManagerDialog).toHaveBeenCalledWith(
        mockOrg,
        users,
      );
      expect(component["dataSource"]().uncheckAllUsers).toHaveBeenCalled();
      expect(mockMemberService.loadUsers).toHaveBeenCalledWith(mockOrg);
    });
  });

  describe("resetPassword", () => {
    it("should open account recovery dialog", async () => {
      mockMemberDialogManager.openAccountRecoveryDialog.mockResolvedValue(
        AccountRecoveryDialogResultType.Ok,
      );
      mockMemberService.loadUsers.mockResolvedValue([mockUser]);

      await component.resetPassword(mockUser, mockOrg);

      expect(mockMemberDialogManager.openAccountRecoveryDialog).toHaveBeenCalledWith(
        mockUser,
        mockOrg,
      );
      expect(mockMemberService.loadUsers).toHaveBeenCalledWith(mockOrg);
    });
  });

  describe("deleteUser", () => {
    it("should delete user when confirmed", async () => {
      mockMemberDialogManager.openDeleteUserConfirmationDialog.mockResolvedValue(true);
      mockMemberActionsService.deleteUser.mockResolvedValue({ success: true });
      const removeSpy = jest.spyOn(component["dataSource"](), "removeUser");

      await component.deleteUser(mockUser, mockOrg);

      expect(mockMemberDialogManager.openDeleteUserConfirmationDialog).toHaveBeenCalledWith(
        mockUser,
        mockOrg,
      );
      expect(mockMemberActionsService.deleteUser).toHaveBeenCalledWith(mockOrg, mockUser.id);
      expect(removeSpy).toHaveBeenCalledWith(mockUser);
      expect(mockToastService.showToast).toHaveBeenCalled();
    });

    it("should not delete user when not confirmed", async () => {
      mockMemberDialogManager.openDeleteUserConfirmationDialog.mockResolvedValue(false);

      const result = await component.deleteUser(mockUser, mockOrg);

      expect(result).toBe(false);
      expect(mockMemberActionsService.deleteUser).not.toHaveBeenCalled();
    });

    it("should handle errors via handleMemberActionResult", async () => {
      mockMemberDialogManager.openDeleteUserConfirmationDialog.mockResolvedValue(true);
      mockMemberActionsService.deleteUser.mockResolvedValue({
        success: false,
        error: "Delete failed",
      });

      await component.deleteUser(mockUser, mockOrg);

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "Delete failed",
      });
      expect(mockLogService.error).toHaveBeenCalledWith("Delete failed");
    });
  });

  describe("handleMemberActionResult", () => {
    it("should show success toast when result is successful", async () => {
      const result: MemberActionResult = { success: true };

      await component.handleMemberActionResult(result, "testSuccessKey", mockUser);

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "testSuccessKey",
      });
    });

    it("should execute side effect when provided and successful", async () => {
      const result: MemberActionResult = { success: true };
      const sideEffect = jest.fn();

      await component.handleMemberActionResult(result, "testSuccessKey", mockUser, sideEffect);

      expect(sideEffect).toHaveBeenCalled();
    });

    it("should show error toast when result is not successful", async () => {
      const result: MemberActionResult = { success: false, error: "Error message" };
      const sideEffect = jest.fn();

      await component.handleMemberActionResult(result, "testSuccessKey", mockUser, sideEffect);

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "Error message",
      });
      expect(mockLogService.error).toHaveBeenCalledWith("Error message");
      expect(sideEffect).not.toHaveBeenCalled();
    });

    it("should propagate error when side effect throws", async () => {
      const result: MemberActionResult = { success: true };
      const error = new Error("Side effect failed");
      const sideEffect = jest.fn().mockRejectedValue(error);

      await expect(
        component.handleMemberActionResult(result, "testSuccessKey", mockUser, sideEffect),
      ).rejects.toThrow("Side effect failed");
    });
  });
});
