import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// TabsModule and SelectModule use browser observers not available in jsdom
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ProblemDetailsErrorResponse } from "@bitwarden/common/models/response/problem-details-error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { Vfo1TerminologyService } from "@bitwarden/vault";
import { BillingConstraintService } from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";

import { GroupApiService, OrganizationUserAdminView, UserAdminService } from "../../../core";
import { DeleteManagedMemberWarningService } from "../../services/delete-managed-member/delete-managed-member-warning.service";
import { MemberActionsService } from "../../services/member-actions/member-actions.service";
import {
  EditMemberDialogParams,
  MemberDialogResult,
  MemberDialogTab,
} from "../member-dialog/member-dialog.types";

import { EditMemberDialogComponent } from "./edit-member-dialog.component";

const ORG_ID = "org-id" as any;
const USER_ID = "user-id" as any;
const ACCOUNT_ID = "account-id" as any;

function buildOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORG_ID,
    useGroups: false,
    canEditAnyCollection: true,
    allowAdminAccessToAllCollectionItems: true,
    permissions: { manageUsers: true },
    productTierType: 3,
    useCustomPermissions: true,
    ...overrides,
  } as unknown as Organization;
}

function buildUserDetails(
  overrides: Partial<{
    userId: any;
  }> = {},
): OrganizationUserAdminView {
  return new OrganizationUserAdminView({
    id: USER_ID,
    userId: overrides.userId ?? ("other-account-id" as any),
    organizationId: ORG_ID,
    collections: [],
    groups: [],
    type: OrganizationUserType.User,
    status: OrganizationUserStatusType.Confirmed,
    externalId: "",
    ssoExternalId: "",
    permissions: new PermissionsApi(),
    accessSecretsManager: false,
    resetPasswordEnrolled: false,
    hasMasterPassword: true,
    claimedByOrganization: false,
  });
}

function defaultParams(overrides: Partial<EditMemberDialogParams> = {}): EditMemberDialogParams {
  return {
    kind: "Edit",
    organizationId: ORG_ID,
    organizationUserId: USER_ID,
    name: "Test User",
    usesKeyConnector: false,
    claimedByOrganization: false,
    isOnSecretsManagerStandalone: false,
    initialTab: MemberDialogTab.Role,
    ...overrides,
  };
}

async function createComponent(
  params: EditMemberDialogParams,
  overrides: {
    userDetails?: OrganizationUserAdminView;
    orgOverrides?: Partial<Organization>;
    detailsTabEnabled?: boolean;
  } = {},
): Promise<{
  fixture: ComponentFixture<EditMemberDialogComponent>;
  component: EditMemberDialogComponent;
  mocks: {
    accountService: MockProxy<AccountService>;
    organizationService: MockProxy<OrganizationService>;
    collectionAdminService: MockProxy<CollectionAdminService>;
    groupApiService: MockProxy<GroupApiService>;
    userAdminService: MockProxy<UserAdminService>;
    dialogRef: MockProxy<DialogRef<MemberDialogResult>>;
    toastService: MockProxy<ToastService>;
    i18nService: MockProxy<I18nService>;
    memberActionsService: MockProxy<MemberActionsService>;
    deleteManagedMemberWarningService: MockProxy<DeleteManagedMemberWarningService>;
    dialogService: MockProxy<DialogService>;
    billingConstraint: MockProxy<BillingConstraintService>;
    organizationMetadataService: MockProxy<OrganizationMetadataServiceAbstraction>;
    configService: MockProxy<ConfigService>;
    validationService: MockProxy<ValidationService>;
    logService: MockProxy<LogService>;
  };
}> {
  const accountService = mock<AccountService>();
  const organizationService = mock<OrganizationService>();
  const collectionAdminService = mock<CollectionAdminService>();
  const groupApiService = mock<GroupApiService>();
  const userAdminService = mock<UserAdminService>();
  const dialogRef = mock<DialogRef<MemberDialogResult>>();
  const toastService = mock<ToastService>();
  const i18nService = mock<I18nService>();
  const memberActionsService = mock<MemberActionsService>();
  const deleteManagedMemberWarningService = mock<DeleteManagedMemberWarningService>();
  const dialogService = mock<DialogService>();
  const billingConstraint = mock<BillingConstraintService>();
  const organizationMetadataService = mock<OrganizationMetadataServiceAbstraction>();
  const configService = mock<ConfigService>();
  const validationService = mock<ValidationService>();
  const logService = mock<LogService>();

  accountService.activeAccount$ = of({ id: ACCOUNT_ID } as any);
  organizationService.organizations$ = jest
    .fn()
    .mockReturnValue(of([buildOrg(overrides.orgOverrides)]));
  collectionAdminService.collectionAdminViews$ = jest.fn().mockReturnValue(of([]));
  userAdminService.get = jest.fn().mockResolvedValue(overrides.userDetails ?? buildUserDetails());
  userAdminService.saveV2 = jest.fn().mockResolvedValue(undefined);
  i18nService.t = jest.fn().mockReturnValue("translated");
  organizationMetadataService.getOrganizationMetadata$ = jest
    .fn()
    .mockReturnValue(of({ organizationOccupiedSeats: 0 } as OrganizationBillingMetadataResponse));
  billingConstraint.seatLimitReached.mockResolvedValue(false);
  configService.getFeatureFlag.mockImplementation((flag) => {
    if (flag === FeatureFlag.PM28365_ChangeMemberEmail) {
      return Promise.resolve(overrides.detailsTabEnabled ?? false);
    }
    return Promise.resolve(false);
  });

  await TestBed.configureTestingModule({
    imports: [EditMemberDialogComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: params },
      { provide: DialogRef, useValue: dialogRef },
      { provide: AccountService, useValue: accountService },
      { provide: OrganizationService, useValue: organizationService },
      { provide: CollectionAdminService, useValue: collectionAdminService },
      { provide: GroupApiService, useValue: groupApiService },
      { provide: UserAdminService, useValue: userAdminService },
      { provide: ToastService, useValue: toastService },
      { provide: I18nService, useValue: i18nService },
      { provide: MemberActionsService, useValue: memberActionsService },
      { provide: DeleteManagedMemberWarningService, useValue: deleteManagedMemberWarningService },
      { provide: DialogService, useValue: dialogService },
      { provide: BillingConstraintService, useValue: billingConstraint },
      { provide: OrganizationMetadataServiceAbstraction, useValue: organizationMetadataService },
      { provide: ConfigService, useValue: configService },
      { provide: ValidationService, useValue: validationService },
      { provide: LogService, useValue: logService },
      {
        provide: Vfo1TerminologyService,
        useValue: { enabled: () => false, iconClass: (icon: string) => icon },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(EditMemberDialogComponent);
  const component = fixture.componentInstance;

  return {
    fixture,
    component,
    mocks: {
      accountService,
      organizationService,
      collectionAdminService,
      groupApiService,
      userAdminService,
      dialogRef,
      toastService,
      i18nService,
      memberActionsService,
      deleteManagedMemberWarningService,
      dialogService,
      billingConstraint,
      organizationMetadataService,
      configService,
      validationService,
      logService,
    },
  };
}

describe("EditMemberDialogComponent", () => {
  afterEach(() => TestBed.resetTestingModule());

  describe("tabIndex initialization", () => {
    it("defaults to MemberDialogTab.Role when params.initialTab is Role", async () => {
      const { component } = await createComponent(
        defaultParams({ initialTab: MemberDialogTab.Role }),
      );
      expect((component as any).tabIndex()).toBe(MemberDialogTab.Role);
    });

    it("initializes to MemberDialogTab.Collections when params specify it", async () => {
      const { component } = await createComponent(
        defaultParams({ initialTab: MemberDialogTab.Collections }),
      );
      expect((component as any).tabIndex()).toBe(MemberDialogTab.Collections);
    });

    it("initializes to MemberDialogTab.Groups when params specify it", async () => {
      const { component } = await createComponent(
        defaultParams({ initialTab: MemberDialogTab.Groups }),
      );
      expect((component as any).tabIndex()).toBe(MemberDialogTab.Groups);
    });
  });

  describe("loading state", () => {
    it("is false after data loads", async () => {
      const { fixture, component } = await createComponent(defaultParams());

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.loading()).toBe(false);
    });
  });

  describe("self-editing restriction", () => {
    it("disables groups control when user is editing themselves and allowAdminAccessToAllCollectionItems is false", async () => {
      const { fixture, component } = await createComponent(defaultParams(), {
        userDetails: buildUserDetails({ userId: ACCOUNT_ID }),
        orgOverrides: { allowAdminAccessToAllCollectionItems: false } as any,
      });

      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as any).formGroup.controls.groups.disabled).toBe(true);
    });

    it("keeps groups control enabled when user is not self-editing", async () => {
      const { fixture, component } = await createComponent(defaultParams());

      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as any).formGroup.controls.groups.disabled).toBe(false);
    });
  });

  describe("handleEditUser() groups behavior", () => {
    it("passes groups: undefined to saveV2 when restrictEditingSelf is true", async () => {
      const { fixture, mocks } = await createComponent(defaultParams(), {
        userDetails: buildUserDetails({ userId: ACCOUNT_ID }),
        orgOverrides: { allowAdminAccessToAllCollectionItems: false } as any,
      });

      fixture.detectChanges();
      await fixture.whenStable();

      await fixture.componentInstance.submit();

      expect(mocks.userAdminService.saveV2).toHaveBeenCalledWith(
        expect.objectContaining({ groups: undefined }),
        expect.anything(),
        expect.anything(),
      );
    });

    it("passes group ids from form to saveV2 when not self-editing", async () => {
      const { fixture, component, mocks } = await createComponent(defaultParams());

      fixture.detectChanges();
      await fixture.whenStable();

      (component as any).formGroup.controls.groups.setValue([{ id: "group-1", type: 1 }]);

      await component.submit();

      expect(mocks.userAdminService.saveV2).toHaveBeenCalledWith(
        expect.objectContaining({ groups: ["group-1"] }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe("dialog close on success", () => {
    it("calls dialogRef.close with MemberDialogResult.Saved after successful save", async () => {
      const { fixture, component, mocks } = await createComponent(defaultParams());

      fixture.detectChanges();
      await fixture.whenStable();

      await component.submit();

      expect(mocks.dialogRef.close).toHaveBeenCalledWith(MemberDialogResult.Saved);
    });
  });

  describe("restore", () => {
    it("checks the seat limit and restores the user when there is no seat limit issue", async () => {
      const { fixture, component, mocks } = await createComponent(defaultParams());
      mocks.memberActionsService.restoreUser.mockResolvedValue({ success: true });

      fixture.detectChanges();
      await fixture.whenStable();

      await component.restore();

      expect(mocks.organizationMetadataService.getOrganizationMetadata$).toHaveBeenCalledWith(
        ORG_ID,
      );
      expect(mocks.billingConstraint.checkSeatLimit).toHaveBeenCalledWith(
        expect.objectContaining({ id: ORG_ID }),
        expect.objectContaining({ organizationOccupiedSeats: 0 }),
      );
      expect(mocks.billingConstraint.seatLimitReached).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ id: ORG_ID }),
        "restore",
      );
      expect(mocks.memberActionsService.restoreUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: ORG_ID }),
        USER_ID,
      );
      expect(mocks.toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(mocks.dialogRef.close).toHaveBeenCalledWith(MemberDialogResult.Restored);
    });

    it("does not restore the user when the seat limit is reached", async () => {
      const { fixture, component, mocks } = await createComponent(defaultParams());
      mocks.billingConstraint.seatLimitReached.mockResolvedValue(true);

      fixture.detectChanges();
      await fixture.whenStable();

      await component.restore();

      expect(mocks.memberActionsService.restoreUser).not.toHaveBeenCalled();
      expect(mocks.toastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(mocks.dialogRef.close).not.toHaveBeenCalledWith(MemberDialogResult.Restored);
    });
  });

  describe("Details tab feature flag (PM28365_ChangeMemberEmail)", () => {
    describe("flag ON", () => {
      it("detailsTabEnabled() returns true", async () => {
        const { component } = await createComponent(
          defaultParams({ initialTab: MemberDialogTab.Details }),
          { detailsTabEnabled: true },
        );

        // Allow the flag Promise to resolve without triggering full template render
        await Promise.resolve();

        expect((component as any).detailsTabEnabled()).toBe(true);
      });

      it("formGroup has name and email controls", async () => {
        const { component } = await createComponent(
          defaultParams({ initialTab: MemberDialogTab.Details }),
          { detailsTabEnabled: true },
        );

        expect((component as any).formGroup.get("name")).not.toBeNull();
        expect((component as any).formGroup.get("email")).not.toBeNull();
      });

      it("email control is disabled", async () => {
        const { component } = await createComponent(
          defaultParams({ initialTab: MemberDialogTab.Details, email: "test@example.com" }),
          { detailsTabEnabled: true },
        );

        expect((component as any).formGroup.controls.email.disabled).toBe(true);
      });

      it("patches email from params on load", async () => {
        const { component } = await createComponent(
          defaultParams({ initialTab: MemberDialogTab.Details, email: "member@example.com" }),
          { detailsTabEnabled: true },
        );

        // Wait for userService.get to resolve and form to be patched
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect((component as any).formGroup.controls.email.value).toBe("member@example.com");
      });

      it("patches name from profileName param on load", async () => {
        const { component } = await createComponent(
          defaultParams({ initialTab: MemberDialogTab.Details, profileName: "Test User" }),
          { detailsTabEnabled: true },
        );

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect((component as any).formGroup.controls.name.value).toBe("Test User");
      });

      it("submit error toast uses 'details' tab label when form invalid and not on Details tab", async () => {
        const { component, mocks } = await createComponent(
          defaultParams({ initialTab: MemberDialogTab.Groups }),
          { detailsTabEnabled: true },
        );

        await Promise.resolve();

        (component as any).formGroup.controls.type.setErrors({ required: true });
        await component.submit();

        expect(mocks.toastService.showToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: "error" }),
        );
      });
    });

    describe("flag OFF", () => {
      it("detailsTabEnabled() returns false", async () => {
        const { component } = await createComponent(defaultParams(), {
          detailsTabEnabled: false,
        });

        expect((component as any).detailsTabEnabled()).toBe(false);
      });

      it("initialTab defaults to Role (0)", async () => {
        const { component } = await createComponent(
          defaultParams({ initialTab: MemberDialogTab.Role }),
          { detailsTabEnabled: false },
        );
        expect((component as any).tabIndex()).toBe(MemberDialogTab.Role);
      });
    });
  });

  describe("emailEditable", () => {
    it("is true when claimed and no master password", async () => {
      const { component } = await createComponent(
        defaultParams({ claimedByOrganization: true, hasMasterPassword: false }),
        { detailsTabEnabled: true },
      );

      expect((component as any).emailEditable()).toBe(true);
    });

    it("is false when not claimed (regardless of master password)", async () => {
      const { component } = await createComponent(
        defaultParams({ claimedByOrganization: false, hasMasterPassword: false }),
        { detailsTabEnabled: true },
      );

      expect((component as any).emailEditable()).toBe(false);
    });

    it("is false when claimed but has a master password", async () => {
      const { component } = await createComponent(
        defaultParams({ claimedByOrganization: true, hasMasterPassword: true }),
        { detailsTabEnabled: true },
      );

      expect((component as any).emailEditable()).toBe(false);
    });
  });

  describe("nameEditable", () => {
    it("is true when claimed by organization", async () => {
      const { component } = await createComponent(defaultParams({ claimedByOrganization: true }), {
        detailsTabEnabled: true,
      });

      expect((component as any).nameEditable()).toBe(true);
    });

    it("is false when not claimed by organization", async () => {
      const { component } = await createComponent(defaultParams({ claimedByOrganization: false }), {
        detailsTabEnabled: true,
      });

      expect((component as any).nameEditable()).toBe(false);
    });
  });

  describe("name control enabled state after load", () => {
    it("enables name control when claimed by organization", async () => {
      const { component } = await createComponent(defaultParams({ claimedByOrganization: true }), {
        detailsTabEnabled: true,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((component as any).formGroup.controls.name.disabled).toBe(false);
    });

    it("keeps name control disabled when not claimed by organization", async () => {
      const { component } = await createComponent(defaultParams({ claimedByOrganization: false }), {
        detailsTabEnabled: true,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((component as any).formGroup.controls.name.disabled).toBe(true);
    });
  });

  describe("handleEditUser() name field", () => {
    it("includes name in request when claimed by organization", async () => {
      const { component, mocks } = await createComponent(
        defaultParams({ claimedByOrganization: true }),
        { detailsTabEnabled: true },
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      (component as any).formGroup.controls.name.setValue("New Name");
      await component.submit();

      expect(mocks.userAdminService.saveV2).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Name" }),
        expect.anything(),
        expect.anything(),
      );
    });

    it("omits name from request when not claimed by organization", async () => {
      const { component, mocks } = await createComponent(
        defaultParams({ claimedByOrganization: false }),
        { detailsTabEnabled: true },
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      await component.submit();

      expect(mocks.userAdminService.saveV2).toHaveBeenCalledWith(
        expect.objectContaining({ name: undefined }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe("email control enabled state after load", () => {
    it("enables email control when emailEditable is true", async () => {
      const { component } = await createComponent(
        defaultParams({
          claimedByOrganization: true,
          hasMasterPassword: false,
          email: "user@org.com",
        }),
        { detailsTabEnabled: true },
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((component as any).formGroup.controls.email.disabled).toBe(false);
    });

    it("keeps email control disabled when not claimed", async () => {
      const { component } = await createComponent(
        defaultParams({ claimedByOrganization: false, hasMasterPassword: false }),
        { detailsTabEnabled: true },
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((component as any).formGroup.controls.email.disabled).toBe(true);
    });

    it("keeps email control disabled when claimed but has master password", async () => {
      const { component } = await createComponent(
        defaultParams({ claimedByOrganization: true, hasMasterPassword: true }),
        { detailsTabEnabled: true },
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((component as any).formGroup.controls.email.disabled).toBe(true);
    });
  });

  describe("handleEditUser() email field", () => {
    it("includes email in request when editable", async () => {
      const { component, mocks } = await createComponent(
        defaultParams({
          claimedByOrganization: true,
          hasMasterPassword: false,
          email: "original@org.com",
        }),
        { detailsTabEnabled: true },
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      (component as any).formGroup.controls.email.setValue("new@org.com");
      await component.submit();

      expect(mocks.userAdminService.saveV2).toHaveBeenCalledWith(
        expect.objectContaining({ email: "new@org.com" }),
        expect.anything(),
        expect.anything(),
      );
    });

    it("omits email from request when not editable", async () => {
      const { component, mocks } = await createComponent(
        defaultParams({ claimedByOrganization: false, hasMasterPassword: true }),
        { detailsTabEnabled: true },
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      await component.submit();

      expect(mocks.userAdminService.saveV2).toHaveBeenCalledWith(
        expect.objectContaining({ email: undefined }),
        expect.anything(),
        expect.anything(),
      );
    });

    it("sets inline email error and stays open on email validation error from server", async () => {
      const emailError = new ProblemDetailsErrorResponse(
        { errors: { email: [{ type: "new_email_domain_not_claimed", detail: "..." }] } },
        400,
      );
      const { component, mocks } = await createComponent(
        defaultParams({ claimedByOrganization: true, hasMasterPassword: false }),
        { detailsTabEnabled: true },
      );

      mocks.userAdminService.saveV2.mockRejectedValue(emailError);

      await new Promise((resolve) => setTimeout(resolve, 0));

      await component.submit();

      expect(mocks.dialogRef.close).not.toHaveBeenCalled();
      expect(
        (component as any).formGroup.controls.email.errors?.serverError?.message,
      ).toBeDefined();
    });

    it.each([
      ["member_has_master_password", "email"],
      ["email_change_failed", "email"],
    ])(
      "sets inline error and stays open for %s server error on field %s",
      async (errorType, field) => {
        const error = new ProblemDetailsErrorResponse(
          { errors: { [field]: [{ type: errorType, detail: "..." }] } },
          400,
        );
        const { component, mocks } = await createComponent(
          defaultParams({ claimedByOrganization: true, hasMasterPassword: false }),
          { detailsTabEnabled: true },
        );

        mocks.userAdminService.saveV2.mockRejectedValue(error);

        await new Promise((resolve) => setTimeout(resolve, 0));

        await component.submit();

        expect(mocks.dialogRef.close).not.toHaveBeenCalled();
        expect(
          (component as any).formGroup.controls[field].errors?.serverError?.message,
        ).toBeDefined();
      },
    );

    it("sets inline name error and stays open on name validation error from server", async () => {
      const nameError = new ProblemDetailsErrorResponse(
        { errors: { name: [{ type: "name_member_not_claimed", detail: "..." }] } },
        400,
      );
      const { component, mocks } = await createComponent(
        defaultParams({ claimedByOrganization: true, hasMasterPassword: false }),
        { detailsTabEnabled: true },
      );

      mocks.userAdminService.saveV2.mockRejectedValue(nameError);

      await new Promise((resolve) => setTimeout(resolve, 0));

      await component.submit();

      expect(mocks.dialogRef.close).not.toHaveBeenCalled();
      expect((component as any).formGroup.controls.name.errors?.serverError?.message).toBeDefined();
    });

    it("re-throws non-email errors so the generic toast path runs", async () => {
      const genericError = new Error("Unexpected server error");
      const { component, mocks } = await createComponent(
        defaultParams({ claimedByOrganization: true, hasMasterPassword: false }),
        { detailsTabEnabled: true },
      );

      mocks.userAdminService.saveV2.mockRejectedValue(genericError);

      await new Promise((resolve) => setTimeout(resolve, 0));

      await expect(component.submit()).rejects.toThrow("Unexpected server error");
      expect(mocks.dialogRef.close).not.toHaveBeenCalled();
    });
  });
});
