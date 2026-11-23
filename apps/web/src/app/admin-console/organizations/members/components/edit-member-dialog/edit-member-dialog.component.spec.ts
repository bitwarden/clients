import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
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
import {
  CollectionAccessSelectionView,
  CollectionAdminView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ProblemDetailsErrorResponse } from "@bitwarden/common/models/response/problem-details-error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { Vfo1TerminologyService } from "@bitwarden/vault";
import { BillingConstraintService } from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";

import {
  GroupApiService,
  GroupView,
  OrganizationUserAdminView,
  UserAdminService,
} from "../../../core";
import { OrganizationUserView } from "../../../core/views/organization-user.view";
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

function buildVfo1TerminologyService(enabled = false): Partial<Vfo1TerminologyService> {
  return {
    iconClass: (icon: string) => icon as any,
    enabled: () => enabled,
  };
}

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
    externalId: string;
    ssoExternalId: string;
    type: OrganizationUserType;
    permissions: PermissionsApi;
  }> = {},
): OrganizationUserAdminView {
  return new OrganizationUserAdminView({
    id: USER_ID,
    userId: overrides.userId ?? ("other-account-id" as any),
    organizationId: ORG_ID,
    collections: [],
    groups: [],
    type: overrides.type ?? OrganizationUserType.User,
    status: OrganizationUserStatusType.Confirmed,
    externalId: overrides.externalId,
    ssoExternalId: overrides.ssoExternalId,
    permissions: overrides.permissions ?? new PermissionsApi(),
    accessSecretsManager: false,
    accessPam: false,
    resetPasswordEnrolled: false,
    hasMasterPassword: true,
    claimedByOrganization: false,
  });
}

type MemberOverrides = Partial<
  Pick<
    OrganizationUserView,
    "name" | "email" | "claimedByOrganization" | "hasMasterPassword" | "usesKeyConnector"
  >
>;

function buildListMember(overrides: MemberOverrides = {}): OrganizationUserView {
  const member = new OrganizationUserView({
    id: USER_ID,
    userId: "member-account-id" as any,
    email: overrides.email ?? "",
    type: OrganizationUserType.User,
    revocationReason: undefined as any,
    status: OrganizationUserStatusType.Confirmed,
    permissions: new PermissionsApi(),
    avatarColor: "",
    name: overrides.name ?? "Test User",
    claimedByOrganization: overrides.claimedByOrganization ?? false,
  });
  member.hasMasterPassword = overrides.hasMasterPassword ?? true;
  member.usesKeyConnector = overrides.usesKeyConnector ?? false;
  return member;
}

function defaultParams(
  overrides: Partial<EditMemberDialogParams> = {},
  memberOverrides: MemberOverrides = {},
): EditMemberDialogParams {
  return {
    organizationId: ORG_ID,
    member: buildListMember(memberOverrides),
    isOnSecretsManagerStandalone: false,
    initialTab: MemberDialogTab.Details,
    ...overrides,
  };
}

async function createComponent(
  params: EditMemberDialogParams,
  overrides: {
    userDetails?: OrganizationUserAdminView;
    orgOverrides?: Partial<Organization>;
    vfo1FoundationEnabled?: boolean;
    pamEnabled?: boolean;
    rotationEnabled?: boolean;
    collections?: CollectionAdminView[];
    groups?: GroupView[];
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
    platformUtilsService: MockProxy<PlatformUtilsService>;
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
  const platformUtilsService = mock<PlatformUtilsService>();

  accountService.activeAccount$ = of({ id: ACCOUNT_ID } as any);
  organizationService.organizations$ = jest
    .fn()
    .mockReturnValue(of([buildOrg(overrides.orgOverrides)]));
  collectionAdminService.collectionAdminViews$ = jest
    .fn()
    .mockReturnValue(of(overrides.collections ?? []));
  groupApiService.getAll.mockResolvedValue(overrides.groups ?? []);
  userAdminService.get = jest.fn().mockResolvedValue(overrides.userDetails ?? buildUserDetails());
  userAdminService.saveV2 = jest.fn().mockResolvedValue(undefined);
  i18nService.t = jest.fn().mockReturnValue("translated");
  (i18nService as any).collator = new Intl.Collator("en");
  organizationMetadataService.getOrganizationMetadata$ = jest
    .fn()
    .mockReturnValue(of({ organizationOccupiedSeats: 0 } as OrganizationBillingMetadataResponse));
  billingConstraint.seatLimitReached.mockResolvedValue(false);
  // Read once at construction, so the values have to be in place before createComponent returns.
  configService.getFeatureFlag.mockImplementation(async (flag) =>
    flag === FeatureFlag.PamAccessConnector
      ? (overrides.rotationEnabled ?? false)
      : (overrides.pamEnabled ?? false),
  );

  await TestBed.configureTestingModule({
    imports: [EditMemberDialogComponent],
    providers: [
      provideNoopAnimations(),
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
      { provide: BillingConstraintService, useValue: billingConstraint },
      { provide: OrganizationMetadataServiceAbstraction, useValue: organizationMetadataService },
      { provide: ConfigService, useValue: configService },
      { provide: ValidationService, useValue: validationService },
      { provide: LogService, useValue: logService },
      { provide: PlatformUtilsService, useValue: platformUtilsService },
      {
        provide: Vfo1TerminologyService,
        useValue: buildVfo1TerminologyService(overrides.vfo1FoundationEnabled),
      },
    ],
  }).compileComponents();

  // EditMemberDialogComponent imports DialogModule directly, which itself provides a real
  // DialogService (see libs/components/src/dialog/dialog.module.ts). That component-level
  // provider is "closer" in the injector hierarchy than a TestBed-level `providers` entry, so a
  // plain provider override above would be shadowed. `overrideProvider` patches the injectable
  // definition itself so the mock is used everywhere, including inside DialogModule's scope.
  TestBed.overrideProvider(DialogService, { useValue: dialogService });

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
      platformUtilsService,
    },
  };
}

describe("EditMemberDialogComponent", () => {
  afterEach(() => TestBed.resetTestingModule());

  describe("tabIndex initialization", () => {
    it("defaults to MemberDialogTab.Details when params.initialTab is Details", async () => {
      const { component } = await createComponent(
        defaultParams({ initialTab: MemberDialogTab.Details }),
      );
      expect((component as any).tabIndex()).toBe(MemberDialogTab.Details);
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

  describe("manage access rules permission", () => {
    const customMember = (manageAccessRules: boolean) =>
      buildUserDetails({
        type: OrganizationUserType.Custom,
        permissions: Object.assign(new PermissionsApi(), { manageAccessRules }),
      });

    const checkbox = (fixture: ComponentFixture<EditMemberDialogComponent>) =>
      fixture.nativeElement.querySelector("#edit-member_checkbox_manage-access-rules");

    it("offers the checkbox when the organization is subscribed to PAM", async () => {
      const { fixture } = await createComponent(defaultParams(), {
        userDetails: customMember(false),
        orgOverrides: { usePam: true } as any,
        pamEnabled: true,
      });

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(checkbox(fixture)).not.toBeNull();
    });

    it("hides the checkbox when the organization is not subscribed to PAM", async () => {
      const { fixture } = await createComponent(defaultParams(), {
        userDetails: customMember(false),
        orgOverrides: { usePam: false } as any,
        pamEnabled: true,
      });

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(checkbox(fixture)).toBeNull();
    });

    // The public API can also grant the permission, so a hidden checkbox must submit the member's
    // existing grant rather than clear it.
    it("round-trips an existing grant the checkbox never rendered", async () => {
      const { fixture, component, mocks } = await createComponent(defaultParams(), {
        userDetails: customMember(true),
        orgOverrides: { usePam: false } as any,
      });

      fixture.detectChanges();
      await fixture.whenStable();

      await component.submit();

      expect(mocks.userAdminService.saveV2).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: expect.objectContaining({ manageAccessRules: true }),
        }),
        expect.anything(),
        expect.anything(),
      );
    });

    it("drops the permission when the member is no longer custom", async () => {
      const { fixture, component, mocks } = await createComponent(defaultParams(), {
        userDetails: customMember(true),
        orgOverrides: { usePam: true } as any,
      });

      fixture.detectChanges();
      await fixture.whenStable();

      (component as any).formGroup.controls.type.setValue(OrganizationUserType.Admin);
      await component.submit();

      const [request] = mocks.userAdminService.saveV2.mock.calls[0];
      expect(request.permissions.manageAccessRules).toBeFalsy();
    });
  });

  describe("manage rotation permission", () => {
    const customMember = (manageRotation: boolean) =>
      buildUserDetails({
        type: OrganizationUserType.Custom,
        permissions: Object.assign(new PermissionsApi(), { manageRotation }),
      });

    const checkbox = (fixture: ComponentFixture<EditMemberDialogComponent>) =>
      fixture.nativeElement.querySelector("#edit-member_checkbox_manage-rotation");

    it("offers the checkbox when rotation is turned on", async () => {
      const { fixture } = await createComponent(defaultParams(), {
        userDetails: customMember(false),
        orgOverrides: { usePam: true } as any,
        pamEnabled: true,
        rotationEnabled: true,
      });

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(checkbox(fixture)).not.toBeNull();
    });

    // The rotation pages sit behind their own flag, so there is nothing to administer without it.
    it("hides the checkbox while rotation is turned off", async () => {
      const { fixture } = await createComponent(defaultParams(), {
        userDetails: customMember(false),
        orgOverrides: { usePam: true } as any,
        pamEnabled: true,
      });

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(checkbox(fixture)).toBeNull();
    });

    it("round-trips an existing grant the checkbox never rendered", async () => {
      const { fixture, component, mocks } = await createComponent(defaultParams(), {
        userDetails: customMember(true),
        orgOverrides: { usePam: true } as any,
      });

      fixture.detectChanges();
      await fixture.whenStable();

      await component.submit();

      expect(mocks.userAdminService.saveV2).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: expect.objectContaining({ manageRotation: true }),
        }),
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

  describe("delete() VFO1 terminology flag", () => {
    it("uses the legacy warning key when the flag is off", async () => {
      const { fixture, component, mocks } = await createComponent(defaultParams(), {
        vfo1FoundationEnabled: false,
      });
      mocks.deleteManagedMemberWarningService.warningAcknowledged.mockReturnValue(of(true));
      mocks.dialogService.openSimpleDialog.mockResolvedValue(false);

      fixture.detectChanges();
      await fixture.whenStable();

      await component.delete();

      expect(mocks.dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({ key: "deleteOrganizationUserWarningDesc" }),
        }),
      );
    });

    it("uses the shared folder warning key when the flag is on", async () => {
      const { fixture, component, mocks } = await createComponent(defaultParams(), {
        vfo1FoundationEnabled: true,
      });
      mocks.deleteManagedMemberWarningService.warningAcknowledged.mockReturnValue(of(true));
      mocks.dialogService.openSimpleDialog.mockResolvedValue(false);

      fixture.detectChanges();
      await fixture.whenStable();

      await component.delete();

      expect(mocks.dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            key: "deleteOrganizationUserWarningDescSharedFolders",
          }),
        }),
      );
    });
  });

  describe("Details tab", () => {
    it("formGroup has name and email controls", async () => {
      const { component } = await createComponent(
        defaultParams({ initialTab: MemberDialogTab.Details }),
      );

      expect((component as any).formGroup.get("name")).not.toBeNull();
      expect((component as any).formGroup.get("email")).not.toBeNull();
    });

    it("email control is disabled", async () => {
      const { component } = await createComponent(
        defaultParams({ initialTab: MemberDialogTab.Details }, { email: "test@example.com" }),
      );

      expect((component as any).formGroup.controls.email.disabled).toBe(true);
    });

    it("patches email from params on load", async () => {
      const { component } = await createComponent(
        defaultParams({ initialTab: MemberDialogTab.Details }, { email: "member@example.com" }),
      );

      // Wait for userService.get to resolve and form to be patched
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((component as any).formGroup.controls.email.value).toBe("member@example.com");
    });

    it("patches name from the member's name on load", async () => {
      const { component } = await createComponent(
        defaultParams({ initialTab: MemberDialogTab.Details }, { name: "Profile Name" }),
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((component as any).formGroup.controls.name.value).toBe("Profile Name");
    });

    it("loads the member's details by their ID when not readonly", async () => {
      const { mocks } = await createComponent(defaultParams());

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mocks.userAdminService.get).toHaveBeenCalledWith(ORG_ID, USER_ID);
    });

    it("submit error toast uses 'details' tab label when form invalid and not on Details tab", async () => {
      const { component, mocks } = await createComponent(
        defaultParams({ initialTab: MemberDialogTab.Groups }),
      );

      await Promise.resolve();

      (component as any).formGroup.controls.type.setErrors({ required: true });
      await component.submit();

      expect(mocks.toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });
  });

  describe("emailEditable", () => {
    it("is true when claimed and no master password", async () => {
      const { component } = await createComponent(
        defaultParams({}, { claimedByOrganization: true, hasMasterPassword: false }),
      );

      expect((component as any).emailEditable()).toBe(true);
    });

    it("is false when not claimed (regardless of master password)", async () => {
      const { component } = await createComponent(
        defaultParams({}, { claimedByOrganization: false, hasMasterPassword: false }),
      );

      expect((component as any).emailEditable()).toBe(false);
    });

    it("is false when claimed but has a master password", async () => {
      const { component } = await createComponent(
        defaultParams({}, { claimedByOrganization: true, hasMasterPassword: true }),
      );

      expect((component as any).emailEditable()).toBe(false);
    });
  });

  describe("nameEditable", () => {
    it("is true when claimed by organization", async () => {
      const { component } = await createComponent(
        defaultParams({}, { claimedByOrganization: true }),
      );

      expect((component as any).nameEditable()).toBe(true);
    });

    it("is false when not claimed by organization", async () => {
      const { component } = await createComponent(
        defaultParams({}, { claimedByOrganization: false }),
      );

      expect((component as any).nameEditable()).toBe(false);
    });
  });

  describe("name control enabled state after load", () => {
    it("enables name control when claimed by organization", async () => {
      const { component } = await createComponent(
        defaultParams({}, { claimedByOrganization: true }),
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((component as any).formGroup.controls.name.disabled).toBe(false);
    });

    it("keeps name control disabled when not claimed by organization", async () => {
      const { component } = await createComponent(
        defaultParams({}, { claimedByOrganization: false }),
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((component as any).formGroup.controls.name.disabled).toBe(true);
    });
  });

  describe("handleEditUser() name field", () => {
    it("includes name in request when claimed by organization", async () => {
      const { component, mocks } = await createComponent(
        defaultParams({}, { claimedByOrganization: true }),
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
        defaultParams({}, { claimedByOrganization: false }),
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
        defaultParams(
          {},
          { claimedByOrganization: true, hasMasterPassword: false, email: "user@org.com" },
        ),
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((component as any).formGroup.controls.email.disabled).toBe(false);
    });

    it("keeps email control disabled when not claimed", async () => {
      const { component } = await createComponent(
        defaultParams({}, { claimedByOrganization: false, hasMasterPassword: false }),
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((component as any).formGroup.controls.email.disabled).toBe(true);
    });

    it("keeps email control disabled when claimed but has master password", async () => {
      const { component } = await createComponent(
        defaultParams({}, { claimedByOrganization: true, hasMasterPassword: true }),
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((component as any).formGroup.controls.email.disabled).toBe(true);
    });
  });

  describe("handleEditUser() email field", () => {
    it("includes email in request when editable", async () => {
      const { component, mocks } = await createComponent(
        defaultParams(
          {},
          { claimedByOrganization: true, hasMasterPassword: false, email: "original@org.com" },
        ),
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
        defaultParams({}, { claimedByOrganization: false, hasMasterPassword: true }),
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
        defaultParams({}, { claimedByOrganization: true, hasMasterPassword: false }),
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
          defaultParams({}, { claimedByOrganization: true, hasMasterPassword: false }),
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
        defaultParams({}, { claimedByOrganization: true, hasMasterPassword: false }),
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
        defaultParams({}, { claimedByOrganization: true, hasMasterPassword: false }),
      );

      mocks.userAdminService.saveV2.mockRejectedValue(genericError);

      await new Promise((resolve) => setTimeout(resolve, 0));

      await expect(component.submit()).rejects.toThrow("Unexpected server error");
      expect(mocks.dialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe("external ID fields", () => {
    it("renders the external ID and SSO external ID values when the member has them", async () => {
      const { fixture } = await createComponent(defaultParams(), {
        userDetails: buildUserDetails({
          externalId: "1308a41a-5c5b-46d3-9573-abad9b0608dc",
          ssoExternalId: "member@example.com",
        }),
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();

      const externalIdInput: HTMLInputElement = fixture.nativeElement.querySelector(
        "#edit-member_input_external-id",
      );
      const ssoExternalIdInput: HTMLInputElement = fixture.nativeElement.querySelector(
        "#edit-member_input_sso-external-id",
      );

      expect(externalIdInput.value).toBe("1308a41a-5c5b-46d3-9573-abad9b0608dc");
      expect(externalIdInput.readOnly).toBe(true);
      expect(ssoExternalIdInput.value).toBe("member@example.com");
      expect(ssoExternalIdInput.readOnly).toBe(true);
    });

    it("hides both fields when the member has neither ID", async () => {
      const { fixture } = await createComponent(defaultParams(), {
        userDetails: buildUserDetails(),
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector("#edit-member_button_copy-external-id"),
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector("#edit-member_button_copy-sso-external-id"),
      ).toBeNull();
    });

    it("copies the external ID to the clipboard when the copy button is clicked", async () => {
      const { fixture, mocks } = await createComponent(defaultParams(), {
        userDetails: buildUserDetails({ externalId: "external-id-value" }),
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();

      fixture.nativeElement.querySelector("#edit-member_button_copy-external-id").click();

      expect(mocks.platformUtilsService.copyToClipboard).toHaveBeenCalledWith("external-id-value");
    });

    it("copies the SSO external ID to the clipboard when the copy button is clicked", async () => {
      const { fixture, mocks } = await createComponent(defaultParams(), {
        userDetails: buildUserDetails({ ssoExternalId: "sso-external-id-value" }),
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();

      fixture.nativeElement.querySelector("#edit-member_button_copy-sso-external-id").click();

      expect(mocks.platformUtilsService.copyToClipboard).toHaveBeenCalledWith(
        "sso-external-id-value",
      );
    });
  });

  describe("readonly", () => {
    const GROUP_ID = "group-1";

    function buildMember(
      overrides: Partial<{
        groups: string[];
        type: OrganizationUserType;
        permissions: PermissionsApi;
      }> = {},
    ): OrganizationUserView {
      const member = new OrganizationUserView({
        id: USER_ID,
        userId: "other-account-id" as any,
        email: "member@example.com",
        type: overrides.type ?? OrganizationUserType.Admin,
        revocationReason: undefined as any,
        status: OrganizationUserStatusType.Confirmed,
        permissions: overrides.permissions ?? new PermissionsApi(),
        avatarColor: "",
        name: "Member",
        claimedByOrganization: true,
      });
      member.groups = overrides.groups ?? [];
      member.hasMasterPassword = false;
      return member;
    }

    function buildCollection(
      id: string,
      access: { users?: string[]; groups?: string[] } = {},
      editable = false,
    ): CollectionAdminView {
      const selection = (accessId: string) =>
        new CollectionAccessSelectionView({
          id: accessId,
          readOnly: true,
          hidePasswords: false,
          manage: false,
        });
      return {
        id,
        name: id,
        canEditUserAccess: () => editable,
        users: (access.users ?? []).map(selection),
        groups: (access.groups ?? []).map(selection),
      } as unknown as CollectionAdminView;
    }

    async function createReadonly(
      member: OrganizationUserView = buildMember(),
      collections: CollectionAdminView[] = [],
      orgOverrides: Partial<Organization> = {},
      extraGroups: GroupView[] = [],
    ) {
      const result = await createComponent(defaultParams({ readonly: true, member }), {
        orgOverrides: {
          permissions: { manageUsers: false, manageResetPassword: true } as PermissionsApi,
          ...orgOverrides,
        },
        collections,
        groups: [
          new GroupView({ id: GROUP_ID, organizationId: ORG_ID, name: "Engineering" }),
          ...extraGroups,
        ],
      });
      // Echo keys so the footer's buttons can be told apart.
      result.mocks.i18nService.t.mockImplementation((key: string) => key);
      result.fixture.detectChanges();
      await result.fixture.whenStable();
      result.fixture.detectChanges();
      return result;
    }

    it("reads the member from the members list instead of requesting them", async () => {
      const { component, mocks } = await createReadonly();

      expect(mocks.userAdminService.get).not.toHaveBeenCalled();
      expect(component.loading()).toBe(false);
      expect((component as any).formGroup.controls.type.value).toBe(OrganizationUserType.Admin);
    });

    it("hides the external ID fields, since the members list doesn't carry them", async () => {
      const { fixture } = await createReadonly();

      expect(fixture.nativeElement.querySelector("#edit-member_input_external-id")).toBeNull();
      expect(fixture.nativeElement.querySelector("#edit-member_input_sso-external-id")).toBeNull();
    });

    it("reads group names instead of group details", async () => {
      const { mocks } = await createReadonly(buildMember({ groups: [GROUP_ID] }), [], {
        useGroups: true,
      });

      expect(mocks.groupApiService.getAll).toHaveBeenCalledWith(ORG_ID);
      expect(mocks.groupApiService.getAllDetails).not.toHaveBeenCalled();
    });

    it("shows only the member's groups, as read only", async () => {
      const { component } = await createReadonly(
        buildMember({ groups: [GROUP_ID] }),
        [],
        { useGroups: true },
        [new GroupView({ id: "other-group", organizationId: ORG_ID, name: "Finance" })],
      );

      expect((component as any).groupAccessItems()).toEqual([
        expect.objectContaining({ id: GROUP_ID, labelName: "Engineering", readonly: true }),
      ]);
    });

    it("shows the member's direct collection access and access through their groups", async () => {
      const { component } = await createReadonly(
        buildMember({ groups: [GROUP_ID] }),
        [
          buildCollection("direct", { users: [USER_ID] }),
          buildCollection("via-group", { groups: [GROUP_ID] }),
          buildCollection("no-access"),
        ],
        { useGroups: true },
      );

      const items = (component as any).collectionAccessItems();
      expect(items.map((item: { id: string }) => item.id)).toEqual([
        "direct",
        `via-group-${GROUP_ID}`,
      ]);
      expect(items[1]).toEqual(expect.objectContaining({ viaGroupName: "Engineering" }));
    });

    it("shows collections the admin can edit as read only, and only the member's", async () => {
      const { component } = await createReadonly(buildMember(), [
        buildCollection("assigned", { users: [USER_ID] }, true),
        buildCollection("unassigned", {}, true),
      ]);

      expect((component as any).collectionAccessItems()).toEqual([
        expect.objectContaining({ id: "assigned", readonly: true }),
      ]);
    });

    it("disables every field", async () => {
      const { component } = await createReadonly(
        buildMember({
          type: OrganizationUserType.Custom,
          permissions: { manageResetPassword: true } as PermissionsApi,
        }),
      );

      expect((component as any).formGroup.disabled).toBe(true);
      expect((component as any).permissionsGroup.disabled).toBe(true);
    });

    it("keeps the name and email from being editable", async () => {
      const { component } = await createReadonly();

      expect((component as any).nameEditable()).toBe(false);
      expect((component as any).emailEditable()).toBe(false);
    });

    it("shows Close instead of Save and the Remove and Revoke actions", async () => {
      const { fixture } = await createReadonly();
      const element: HTMLElement = fixture.nativeElement;

      expect(element.querySelector("#edit-member_button_close")).not.toBeNull();
      expect(element.querySelector("button[type='submit']")).toBeNull();
      expect(element.textContent).not.toContain("save");
      expect(element.textContent).not.toContain("moreActions");
    });

    it("closes as canceled from Close", async () => {
      const { fixture, mocks } = await createReadonly();

      fixture.nativeElement.querySelector("#edit-member_button_close").click();

      expect(mocks.dialogRef.close).toHaveBeenCalledWith(MemberDialogResult.Canceled);
    });

    it("never saves", async () => {
      const { component, mocks } = await createReadonly();

      await component.submit();

      expect(mocks.userAdminService.saveV2).not.toHaveBeenCalled();
    });
  });
});
