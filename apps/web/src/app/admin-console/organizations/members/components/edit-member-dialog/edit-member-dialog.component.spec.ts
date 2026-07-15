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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
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
});
