import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// AccessSelectorModule / SelectModule use browser observers not available in jsdom
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

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  CollectionAccessSelectionView,
  CollectionAdminView,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import { GroupApiService, GroupView } from "../../core";
import { AccessItemType, CollectionPermission } from "../../shared/components/access-selector";

import {
  BulkCollectionsDialogComponent,
  BulkCollectionsDialogParams,
  BulkCollectionsDialogResult,
} from "./bulk-collections-dialog.component";

const ORG_ID = "org-id" as any;
const ACCOUNT_ID = "account-id" as any;

function buildOrg(overrides: Partial<Organization> = {}): Organization {
  return { id: ORG_ID, useGroups: false, ...overrides } as unknown as Organization;
}

function collectionView(id: string): CollectionView {
  return { id } as CollectionView;
}

function accessSelection(
  id: string,
  overrides: Partial<CollectionAccessSelectionView> = {},
): CollectionAccessSelectionView {
  return new CollectionAccessSelectionView({
    id,
    readOnly: false,
    hidePasswords: false,
    manage: false,
    ...overrides,
  });
}

function adminView(
  id: string,
  access: {
    users?: CollectionAccessSelectionView[];
    groups?: CollectionAccessSelectionView[];
  } = {},
): CollectionAdminView {
  return {
    id,
    groups: access.groups ?? [],
    users: access.users ?? [],
  } as unknown as CollectionAdminView;
}

function buildGroup(id: string): GroupView {
  return { id, name: `Group ${id}` } as GroupView;
}

function buildMiniUser(id: string): any {
  return { id, email: `${id}@example.com`, type: 2, name: id, status: 2 };
}

interface CreateOptions {
  collections?: CollectionView[];
  adminViews?: CollectionAdminView[];
  orgOverrides?: Partial<Organization>;
  groups?: GroupView[];
  users?: any[];
  batchBarEnabled?: boolean;
}

async function createComponent(options: CreateOptions = {}): Promise<{
  fixture: ComponentFixture<BulkCollectionsDialogComponent>;
  component: BulkCollectionsDialogComponent;
  mocks: {
    accountService: MockProxy<AccountService>;
    organizationService: MockProxy<OrganizationService>;
    groupApiService: MockProxy<GroupApiService>;
    organizationUserApiService: MockProxy<OrganizationUserApiService>;
    collectionAdminService: MockProxy<CollectionAdminService>;
    i18nService: MockProxy<I18nService>;
    toastService: MockProxy<ToastService>;
    configService: MockProxy<ConfigService>;
    dialogRef: MockProxy<DialogRef<BulkCollectionsDialogResult>>;
  };
}> {
  const params: BulkCollectionsDialogParams = {
    organizationId: ORG_ID,
    collections: options.collections ?? [collectionView("c1")],
  };

  const accountService = mock<AccountService>();
  const organizationService = mock<OrganizationService>();
  const groupApiService = mock<GroupApiService>();
  const organizationUserApiService = mock<OrganizationUserApiService>();
  const collectionAdminService = mock<CollectionAdminService>();
  const i18nService = mock<I18nService>();
  const toastService = mock<ToastService>();
  const configService = mock<ConfigService>();
  const dialogRef = mock<DialogRef<BulkCollectionsDialogResult>>();

  accountService.activeAccount$ = of({ id: ACCOUNT_ID } as any);
  organizationService.organizations$.mockReturnValue(of([buildOrg(options.orgOverrides)]));
  groupApiService.getAll.mockResolvedValue(options.groups ?? []);
  organizationUserApiService.getAllMiniUserDetails.mockResolvedValue({
    data: options.users ?? [],
  } as any);
  collectionAdminService.collectionAdminViews$.mockReturnValue(of(options.adminViews ?? []));
  collectionAdminService.bulkAssignAccess.mockResolvedValue(undefined);
  configService.getFeatureFlag.mockResolvedValue(options.batchBarEnabled ?? false);
  i18nService.t.mockImplementation((key) => key);

  await TestBed.configureTestingModule({
    imports: [BulkCollectionsDialogComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: params },
      { provide: DialogRef, useValue: dialogRef },
      { provide: OrganizationService, useValue: organizationService },
      { provide: AccountService, useValue: accountService },
      { provide: GroupApiService, useValue: groupApiService },
      { provide: OrganizationUserApiService, useValue: organizationUserApiService },
      { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      { provide: I18nService, useValue: i18nService },
      { provide: CollectionAdminService, useValue: collectionAdminService },
      { provide: ToastService, useValue: toastService },
      { provide: ConfigService, useValue: configService },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(BulkCollectionsDialogComponent);
  const component = fixture.componentInstance;

  fixture.detectChanges();
  await fixture.whenStable();

  return {
    fixture,
    component,
    mocks: {
      accountService,
      organizationService,
      groupApiService,
      organizationUserApiService,
      collectionAdminService,
      i18nService,
      toastService,
      configService,
      dialogRef,
    },
  };
}

function accessValue(component: BulkCollectionsDialogComponent) {
  return (component as any).formGroup.controls.access.value;
}

describe("BulkCollectionsDialogComponent", () => {
  afterEach(() => TestBed.resetTestingModule());

  describe("loading state", () => {
    it("is false after data loads", async () => {
      const { component } = await createComponent();
      expect((component as any).loading).toBe(false);
    });
  });

  describe("accessItems", () => {
    it("builds items from the organization's groups and members", async () => {
      const { component } = await createComponent({
        orgOverrides: { useGroups: true },
        groups: [buildGroup("g1")],
        users: [buildMiniUser("u1")],
      });

      const items = (component as any).accessItems;
      expect(items).toHaveLength(2);
      expect(items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "g1", type: AccessItemType.Group }),
          expect.objectContaining({ id: "u1", type: AccessItemType.Member }),
        ]),
      );
    });

    it("does not request groups when the organization does not use groups", async () => {
      const { mocks } = await createComponent({ orgOverrides: { useGroups: false } });
      expect(mocks.groupApiService.getAll).not.toHaveBeenCalled();
    });
  });

  describe("access pre-population", () => {
    it("pre-populates from a single selected collection", async () => {
      const { component } = await createComponent({
        collections: [collectionView("c1")],
        adminViews: [
          adminView("c1", {
            users: [accessSelection("u1")],
            groups: [accessSelection("g1", { manage: true })],
          }),
        ],
      });

      const access = accessValue(component);
      expect(access).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "g1", type: AccessItemType.Group }),
          expect.objectContaining({ id: "u1", type: AccessItemType.Member }),
        ]),
      );
      expect(access).toHaveLength(2);
    });

    it("pre-populates when multiple collections share identical access", async () => {
      const { component } = await createComponent({
        collections: [collectionView("c1"), collectionView("c2")],
        adminViews: [
          adminView("c1", { users: [accessSelection("u1")] }),
          adminView("c2", { users: [accessSelection("u1")] }),
        ],
      });

      expect(accessValue(component)).toEqual([
        expect.objectContaining({ id: "u1", type: AccessItemType.Member }),
      ]);
    });

    it("is empty when selected collections have different members", async () => {
      const { component } = await createComponent({
        collections: [collectionView("c1"), collectionView("c2")],
        adminViews: [
          adminView("c1", { users: [accessSelection("u1")] }),
          adminView("c2", { users: [accessSelection("u2")] }),
        ],
      });

      expect(accessValue(component)).toEqual([]);
    });

    it("is empty when collections share members but with different permissions", async () => {
      const { component } = await createComponent({
        collections: [collectionView("c1"), collectionView("c2")],
        adminViews: [
          adminView("c1", { users: [accessSelection("u1", { manage: true })] }),
          adminView("c2", { users: [accessSelection("u1", { readOnly: true })] }),
        ],
      });

      expect(accessValue(component)).toEqual([]);
    });

    it("ignores collections that are not part of the selection", async () => {
      const { component } = await createComponent({
        collections: [collectionView("c1")],
        adminViews: [
          adminView("c1", { users: [accessSelection("u1")] }),
          adminView("other", { users: [accessSelection("u2")] }),
        ],
      });

      expect(accessValue(component)).toEqual([
        expect.objectContaining({ id: "u1", type: AccessItemType.Member }),
      ]);
    });
  });

  describe("submit()", () => {
    it("assigns the selected members and groups to every selected collection", async () => {
      const { component, mocks } = await createComponent({
        collections: [collectionView("c1"), collectionView("c2")],
      });

      (component as any).formGroup.controls.access.setValue([
        { id: "u1", type: AccessItemType.Member, permission: CollectionPermission.Edit },
        { id: "g1", type: AccessItemType.Group, permission: CollectionPermission.View },
      ]);

      await component.submit();

      expect(mocks.collectionAdminService.bulkAssignAccess).toHaveBeenCalledWith(
        ORG_ID,
        ["c1", "c2"],
        [expect.objectContaining({ id: "u1" })],
        [expect.objectContaining({ id: "g1" })],
      );
    });

    it("shows a success toast", async () => {
      const { component, mocks } = await createComponent();

      await component.submit();

      expect(mocks.toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("uses the singular edited message for a single collection when the batch bar is enabled", async () => {
      const { component, mocks } = await createComponent({
        collections: [collectionView("c1")],
        batchBarEnabled: true,
      });

      await component.submit();

      expect(mocks.i18nService.t).toHaveBeenCalledWith("collectionEdited");
    });

    it("uses the plural edited message for multiple collections when the batch bar is enabled", async () => {
      const { component, mocks } = await createComponent({
        collections: [collectionView("c1"), collectionView("c2")],
        batchBarEnabled: true,
      });

      await component.submit();

      expect(mocks.i18nService.t).toHaveBeenCalledWith("collectionsEdited");
    });

    it("uses the plural edited message when the batch bar is disabled", async () => {
      const { component, mocks } = await createComponent({
        collections: [collectionView("c1")],
        batchBarEnabled: false,
      });

      await component.submit();

      expect(mocks.i18nService.t).toHaveBeenCalledWith("collectionsEdited");
    });

    it("closes the dialog with a Saved result", async () => {
      const { component, mocks } = await createComponent();

      await component.submit();

      expect(mocks.dialogRef.close).toHaveBeenCalledWith(BulkCollectionsDialogResult.Saved);
    });
  });
});
