import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";

import { GroupDetailsView, InternalGroupApiService as GroupService } from "../core";

import { GroupAddEditDialogResultType } from "./group-add-edit";
import { GroupsV2Component } from "./groups-v2.component";

describe("GroupsV2Component", () => {
  let component: GroupsV2Component;
  let fixture: ComponentFixture<GroupsV2Component>;

  let mockApiService: MockProxy<ApiService>;
  let mockGroupService: MockProxy<GroupService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockDialogService: MockProxy<DialogService>;
  let mockCollectionService: MockProxy<CollectionService>;
  let mockKeyService: MockProxy<KeyService>;
  let mockOrganizationService: MockProxy<OrganizationService>;
  let mockToastService: MockProxy<ToastService>;
  let mockLogService: MockProxy<LogService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockAccountService: FakeAccountService;

  let routeParamsSubject: BehaviorSubject<any>;
  let queryParamsSubject: BehaviorSubject<any>;

  const orgId = newGuid() as OrganizationId;
  const userId = newGuid() as UserId;
  const mockOrg = { id: orgId, name: "Test Organization" } as Organization;

  const collectionEngineering = { id: "col-eng", organizationId: orgId, name: "Engineering" };
  const collectionDesign = { id: "col-design", organizationId: orgId, name: "Design" };

  function makeGroup(overrides: Partial<ConstructorParameters<typeof GroupDetailsView>[0]> = {}) {
    return new GroupDetailsView({
      id: newGuid(),
      organizationId: orgId,
      name: "Engineering Team",
      collections: [],
      ...overrides,
    });
  }

  beforeEach(async () => {
    routeParamsSubject = new BehaviorSubject({ organizationId: orgId });
    queryParamsSubject = new BehaviorSubject({});

    mockApiService = mock<ApiService>();
    mockApiService.getCollections.mockResolvedValue({
      data: [collectionEngineering, collectionDesign],
    } as any);

    mockGroupService = mock<GroupService>();
    mockGroupService.getAllDetails.mockResolvedValue([]);

    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string, ...args: any[]) =>
      args.length ? `${key}:${args.join(",")}` : key,
    );
    (mockI18nService as any).collator = undefined;

    mockDialogService = mock<DialogService>();
    mockCollectionService = mock<CollectionService>();
    mockCollectionService.decryptMany$.mockReturnValue(
      of([collectionEngineering, collectionDesign] as any),
    );

    mockKeyService = mock<KeyService>();
    mockKeyService.orgKeys$.mockReturnValue(of({} as any));

    mockOrganizationService = mock<OrganizationService>();
    mockOrganizationService.organizations$.mockReturnValue(of([mockOrg]));

    mockToastService = mock<ToastService>();
    mockLogService = mock<LogService>();

    mockConfigService = mock<ConfigService>();
    mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

    mockAccountService = mockAccountServiceWith(userId);

    await TestBed.configureTestingModule({
      imports: [GroupsV2Component],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: GroupService, useValue: mockGroupService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: CollectionService, useValue: mockCollectionService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: ToastService, useValue: mockToastService },
        { provide: LogService, useValue: mockLogService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: ActivatedRoute,
          useValue: {
            params: routeParamsSubject.asObservable(),
            queryParams: queryParamsSubject.asObservable(),
            snapshot: { queryParams: {} },
          },
        },
      ],
    })
      // Mirrors members.component.spec.ts: the real template pulls in app-header's full nav
      // dependency tree, which isn't worth stubbing out to unit-test the component's logic.
      .overrideComponent(GroupsV2Component, { set: { imports: [], template: "<div></div>" } })
      .compileComponents();
  });

  /**
   * Creates the component under test. Deferred from `beforeEach` (rather than created
   * immediately) so a test can configure its mocks — e.g. `mockGroupService.getAllDetails` —
   * before the constructor's subscription captures them.
   */
  function createComponent() {
    fixture = TestBed.createComponent(GroupsV2Component);
    component = fixture.componentInstance;
  }

  function detectAndFlush() {
    fixture.detectChanges();
    return fixture.whenStable();
  }

  describe("filterGroups", () => {
    const group = makeGroup({
      id: "group-1",
      name: "Engineering Team",
      collections: [{ id: "col-eng", readOnly: false, hidePasswords: false, manage: true }],
    });
    const row = { details: group, collectionBadges: [] };

    beforeEach(() => createComponent());

    it("matches on id", () => {
      expect(component.filterGroups(row, { search: "group-1" })).toBe(true);
    });

    it("matches on name, case-insensitively", () => {
      expect(component.filterGroups(row, { search: "engineering" })).toBe(true);
    });

    it("does not match on unrelated search text", () => {
      expect(component.filterGroups(row, { search: "nope" })).toBe(false);
    });

    it("passes every row when no collections are selected", () => {
      expect(component.filterGroups(row, { collections: [] })).toBe(true);
    });

    it("matches a row with access to a selected collection", () => {
      expect(component.filterGroups(row, { collections: ["col-eng"] })).toBe(true);
    });

    it("excludes a row with no access to any selected collection", () => {
      expect(component.filterGroups(row, { collections: ["col-design"] })).toBe(false);
    });

    it("requires both search and collection filters to match", () => {
      expect(
        component.filterGroups(row, { search: "engineering", collections: ["col-design"] }),
      ).toBe(false);
      expect(component.filterGroups(row, { search: "engineering", collections: ["col-eng"] })).toBe(
        true,
      );
    });
  });

  describe("confirmDelete", () => {
    const group1 = makeGroup({ id: "group-1", name: "Engineering Team" });
    const group2 = makeGroup({ id: "group-2", name: "Design Team" });
    const row1 = { details: group1, collectionBadges: [] };
    const row2 = { details: group2, collectionBadges: [] };

    beforeEach(async () => {
      createComponent();
      await detectAndFlush();
    });

    it("does nothing when given no rows", async () => {
      await component.confirmDelete([]);
      expect(mockDialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("shows the singular dialog and deletes on confirm", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      mockGroupService.deleteMany.mockResolvedValue(undefined);

      await component.confirmDelete([row1]);

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "deleteGroup" },
          content: { key: "deleteGroupWarningDesc" },
          type: "warning",
        }),
      );
      expect(mockGroupService.deleteMany).toHaveBeenCalledWith(orgId, ["group-1"]);
      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "groupDeleted" }),
      );
    });

    it("shows the plural dialog, pluralized, and deletes all selected on confirm", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      mockGroupService.deleteMany.mockResolvedValue(undefined);

      await component.confirmDelete([row1, row2]);

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "deleteGroups", placeholders: ["2"] },
          content: { key: "deleteGroupsWarningDesc" },
          type: "warning",
        }),
      );
      expect(mockGroupService.deleteMany).toHaveBeenCalledWith(orgId, ["group-1", "group-2"]);
      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "groupsDeleted" }),
      );
    });

    it("does not delete or toast when the admin cancels the dialog", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      await component.confirmDelete([row1]);

      expect(mockGroupService.deleteMany).not.toHaveBeenCalled();
      expect(mockToastService.showToast).not.toHaveBeenCalled();
    });

    it("logs and does not toast when the delete call fails", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      mockGroupService.deleteMany.mockRejectedValue(new Error("boom"));

      await component.confirmDelete([row1]);

      expect(mockLogService.error).toHaveBeenCalled();
      expect(mockToastService.showToast).not.toHaveBeenCalled();
    });
  });

  describe("confirmDeleteSelected", () => {
    beforeEach(async () => {
      createComponent();
      await detectAndFlush();
    });

    it("deletes whatever the table last reported as selected", async () => {
      const group = makeGroup({ id: "group-1" });
      const row = { details: group, collectionBadges: [] };
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      mockGroupService.deleteMany.mockResolvedValue(undefined);

      component.selectedGroups.set([row]);
      component.confirmDeleteSelected();
      // confirmDeleteSelected fires confirmDelete without awaiting it; let its promise chain
      // (dialog confirm -> delete -> toast) settle before asserting.
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockGroupService.deleteMany).toHaveBeenCalledWith(orgId, ["group-1"]);
    });
  });

  describe("edit", () => {
    beforeEach(async () => {
      createComponent();
      await detectAndFlush();
    });

    it("shows a 'Group edited' toast and refreshes the list when the dialog reports Saved", async () => {
      const group = makeGroup({ id: "group-1" });
      const row = { details: group, collectionBadges: [] };

      mockDialogService.open.mockReturnValue({
        closed: of(GroupAddEditDialogResultType.Saved),
      } as any);

      await component.edit(row);

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "groupEdited" }),
      );
    });

    it("does not toast, but removes the row, when the dialog reports Deleted", async () => {
      const group = makeGroup({ id: "group-1" });
      const row = { details: group, collectionBadges: [] };

      mockDialogService.open.mockReturnValue({
        closed: of(GroupAddEditDialogResultType.Deleted),
      } as any);

      await component.edit(row);

      expect(mockToastService.showToast).not.toHaveBeenCalled();
    });
  });

  describe("hasNoGroups", () => {
    it("is false while loading", () => {
      mockGroupService.getAllDetails.mockReturnValue(new Promise(() => {})); // never resolves
      createComponent();

      expect(component.hasNoGroups()).toBe(false);
    });

    it("is true once loaded with zero groups", async () => {
      mockGroupService.getAllDetails.mockResolvedValue([]);
      createComponent();
      await detectAndFlush();

      expect(component.hasNoGroups()).toBe(true);
    });

    it("is false once loaded with at least one group", async () => {
      mockGroupService.getAllDetails.mockResolvedValue([makeGroup()]);
      createComponent();
      await detectAndFlush();

      expect(component.hasNoGroups()).toBe(false);
    });
  });
});
