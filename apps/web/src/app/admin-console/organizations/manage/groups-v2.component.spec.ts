import { readFileSync } from "fs";
import { join } from "path";

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
import { ChipGroupItem, DialogService, ToastService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";
import { StateProvider } from "@bitwarden/state";
import { FakeStateProvider } from "@bitwarden/state-test-utils";

import { GroupDetailsView, InternalGroupApiService as GroupService } from "../core";

import { GroupAddEditDialogResultType } from "./group-add-edit";
import { GroupsV2Component } from "./groups-v2.component";
import { OrganizationTableStateService, TableViewState } from "./organization-table-state.service";

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

  /** The view a test wants loaded for the component; swap before `createComponent()`. */
  let loadedState: TableViewState;
  let mockTableStateService: MockProxy<OrganizationTableStateService>;

  let routeParamsSubject: BehaviorSubject<any>;
  let queryParamsSubject: BehaviorSubject<any>;
  /** The route snapshot's query params a test wants read by `initialFilters`. */
  let snapshotQueryParams: Record<string, string>;

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

  /**
   * The real template, minus `<app-header>` — it pulls in the full nav dependency tree, which
   * isn't worth stubbing out. Used by the tests that need real filter chips; everything else
   * runs against a bare stub (see `configure`).
   */
  const realTemplate = readFileSync(join(__dirname, "groups-v2.component.html"), "utf8").replace(
    "<app-header></app-header>",
    "",
  );

  beforeEach(async () => {
    routeParamsSubject = new BehaviorSubject({ organizationId: orgId });
    queryParamsSubject = new BehaviorSubject({});
    snapshotQueryParams = {};

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

    loadedState = {};
    mockTableStateService = mock<OrganizationTableStateService>();
    // Read lazily so a test can swap `loadedState` after this setup runs.
    mockTableStateService.state$.mockImplementation(() => of(loadedState));
    mockTableStateService.save.mockResolvedValue(undefined);

    await configure();
  });

  /**
   * Configures the TestBed. By default the template is stubbed out — most tests only exercise
   * the component class. Pass `realTemplate: true` to render the actual `bit-table-v2` (needed
   * to exercise the filter chips), and `stateProvider` to swap the mocked table-state service
   * for the real one over fake storage.
   */
  async function configure(
    options: { realTemplate?: boolean; stateProvider?: FakeStateProvider } = {},
  ) {
    TestBed.resetTestingModule();
    const tableStateProviders = options.stateProvider
      ? [{ provide: StateProvider, useValue: options.stateProvider }]
      : [{ provide: OrganizationTableStateService, useValue: mockTableStateService }];

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
        ...tableStateProviders,
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ titleId: "groups" }),
            params: routeParamsSubject.asObservable(),
            queryParams: queryParamsSubject.asObservable(),
            get snapshot() {
              return { queryParams: snapshotQueryParams };
            },
          },
        },
      ],
    })
      .overrideComponent(GroupsV2Component, {
        set: options.realTemplate
          ? { template: realTemplate }
          : { imports: [], template: "<div></div>" },
      })
      .compileComponents();
  }

  /**
   * Creates the component under test. Deferred from `beforeEach` (rather than created
   * immediately) so a test can configure its mocks — e.g. `mockGroupService.getAllDetails` —
   * before the constructor's subscription captures them.
   */
  function createComponent() {
    fixture = TestBed.createComponent(GroupsV2Component);
    component = fixture.componentInstance;
  }

  /**
   * Rows reach the table via `toSignal(rowsData$)` plus an `effect`, and effects only flush
   * during change detection. A single pass resolves the promise but lands after that pass's
   * effect phase, so a second detectChanges/whenStable cycle is needed for the rows to settle.
   */
  async function detectAndFlush() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  describe("loading the table view", () => {
    it("seeds the collections filter from the loaded state", async () => {
      loadedState = { sharedFolders: ["col-eng"] };
      createComponent();
      await detectAndFlush();

      expect((component as any).initialFilters().collections).toEqual(["col-eng"]);
    });

    it("leaves the collections key off when nothing is stored", async () => {
      loadedState = {};
      createComponent();
      await detectAndFlush();

      expect("collections" in (component as any).initialFilters()).toBe(false);
    });

    it("applies the loaded sort", async () => {
      loadedState = { sortColumn: "details", sortDirection: "desc" as const };
      createComponent();
      await detectAndFlush();

      expect((component as any).sort()).toEqual({ column: "details", direction: "desc" });
    });

    it("ignores a loaded sort column that no longer exists", async () => {
      loadedState = { sortColumn: "removedColumn", sortDirection: "desc" as const };
      createComponent();
      await detectAndFlush();

      expect((component as any).sort().column).toBeUndefined();
    });

    it("seeds the search term from the loaded state", async () => {
      loadedState = { search: "engineering" };
      createComponent();
      await detectAndFlush();

      expect((component as any).initialFilters().search).toEqual("engineering");
    });

    it("prefers a search query param over the loaded search term", async () => {
      snapshotQueryParams = { search: "from-url" };
      loadedState = { search: "engineering" };
      createComponent();
      await detectAndFlush();

      expect((component as any).initialFilters().search).toEqual("from-url");
    });

    it("does not clear searchControl when there is no search query param", async () => {
      snapshotQueryParams = {};
      queryParamsSubject.next({});
      createComponent();
      await detectAndFlush();

      expect((component as any).searchControl.value).not.toBeUndefined();
    });
  });

  describe("saving the table view on destroy", () => {
    it("does not save while the component is still alive", async () => {
      loadedState = {};
      createComponent();
      await detectAndFlush();

      expect(mockTableStateService.save).not.toHaveBeenCalled();
    });

    it("saves the current sort when destroyed", async () => {
      loadedState = {};
      createComponent();
      await detectAndFlush();

      (component as any).sort.set({ column: "details", direction: "desc" });
      await detectAndFlush();
      fixture.destroy();

      expect(mockTableStateService.save).toHaveBeenCalledWith(
        userId,
        orgId,
        "groups",
        expect.objectContaining({ sortColumn: "details", sortDirection: "desc" }),
      );
    });

    /**
     * `save` replaces the whole stored record rather than merging into it, so a teardown that
     * happens before the sort is restored must fall back to the loaded values — otherwise an
     * unsorted visit writes `undefined` over a sort the user had set on an earlier one.
     */
    it("keeps the stored sort when the component is destroyed without one applied", async () => {
      loadedState = { sortColumn: "removedColumn", sortDirection: "desc" as const };
      createComponent();
      await detectAndFlush();

      expect((component as any).sort().column).toBeUndefined();
      fixture.destroy();

      expect(mockTableStateService.save).toHaveBeenCalledWith(
        userId,
        orgId,
        "groups",
        expect.objectContaining({ sortColumn: "removedColumn", sortDirection: "desc" }),
      );
    });

    /**
     * A `?search=` deep link seeds the search box, but the term is the URL's, not the user's.
     * Persisting it would silently replace whatever they had saved, and the next visit without
     * the param would restore it as though they had typed it.
     */
    it("does not persist a search term that came from the query param", async () => {
      snapshotQueryParams = { search: "from-url" };
      loadedState = { search: "engineering" };
      createComponent();
      await detectAndFlush();

      // The real table seeds its search chip from `initialFilters()`, so the URL-supplied
      // term is what the destroy handler would observe.
      (component as any).lastFilterValues.set({ search: "from-url" });
      await detectAndFlush();
      fixture.destroy();

      expect(mockTableStateService.save).toHaveBeenCalledWith(
        userId,
        orgId,
        "groups",
        expect.objectContaining({ search: "engineering" }),
      );
    });

    it("persists a search term the user changed away from the query param", async () => {
      snapshotQueryParams = { search: "from-url" };
      loadedState = { search: "engineering" };
      createComponent();
      await detectAndFlush();

      (component as any).lastFilterValues.set({ search: "typed-by-user" });
      await detectAndFlush();
      fixture.destroy();

      expect(mockTableStateService.save).toHaveBeenCalledWith(
        userId,
        orgId,
        "groups",
        expect.objectContaining({ search: "typed-by-user" }),
      );
    });
  });

  /**
   * These render the real `bit-table-v2` rather than the stubbed template, because the filter
   * chips are the thing under test: they self-register with the table and unregister as the
   * view tears down, which is what made an earlier `onDestroy`-reads-`filterValues()`
   * implementation silently save nothing.
   */
  describe("table view round trip (real template)", () => {
    let stateProvider: FakeStateProvider;

    type FilterControlHandle = { key: () => string; setValue: (value: unknown) => void };
    type TableHandle = {
      filterControls: () => readonly FilterControlHandle[];
      filterValues: () => Record<string, unknown>;
    };

    const tableOf = (): TableHandle => (component as any).tableRef() as TableHandle;

    async function createWithRealTable() {
      await configure({ realTemplate: true, stateProvider });
      createComponent();
      await detectAndFlush();
    }

    beforeEach(async () => {
      stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
      await createWithRealTable();
    });

    it("restores the shared folder filter, search term, and sort on a later visit", async () => {
      for (const control of tableOf().filterControls()) {
        if (control.key() === "collections") {
          control.setValue(["col-eng"]);
        }
        if (control.key() === "search") {
          control.setValue("engineering");
        }
      }
      (component as any).sort.set({ column: "details", direction: "desc" });
      await detectAndFlush();

      fixture.destroy();
      await new Promise((resolve) => setTimeout(resolve, 0));

      await createWithRealTable();

      expect(tableOf().filterValues()).toEqual({
        collections: ["col-eng"],
        search: "engineering",
      });
      expect((component as any).sort()).toEqual({ column: "details", direction: "desc" });
    });

    it("starts with no filters and the table's default sort when nothing was saved", () => {
      expect(tableOf().filterValues()).toEqual({ search: "" });
      // `defaultSort` on the name column, not a restored value.
      expect((component as any).sort()).toEqual({ column: "details", direction: "asc" });
    });
  });

  describe("filterGroups", () => {
    const group = makeGroup({
      id: "group-1",
      name: "Engineering Team",
      collections: [{ id: "col-eng", readOnly: false, hidePasswords: false, manage: true }],
    });
    const row = { details: group, collectionChips: [] as ChipGroupItem[] };

    beforeEach(() => createComponent());

    it("matches on id", () => {
      expect((component as any).filterGroups(row, { search: "group-1" })).toBe(true);
    });

    it("matches on name, case-insensitively", () => {
      expect((component as any).filterGroups(row, { search: "engineering" })).toBe(true);
    });

    it("does not match on unrelated search text", () => {
      expect((component as any).filterGroups(row, { search: "nope" })).toBe(false);
    });

    it("passes every row when no collections are selected", () => {
      expect((component as any).filterGroups(row, { collections: [] })).toBe(true);
    });

    it("matches a row with access to a selected collection", () => {
      expect((component as any).filterGroups(row, { collections: ["col-eng"] })).toBe(true);
    });

    it("excludes a row with no access to any selected collection", () => {
      expect((component as any).filterGroups(row, { collections: ["col-design"] })).toBe(false);
    });

    it("requires both search and collection filters to match", () => {
      expect(
        (component as any).filterGroups(row, {
          search: "engineering",
          collections: ["col-design"],
        }),
      ).toBe(false);
      expect(
        (component as any).filterGroups(row, { search: "engineering", collections: ["col-eng"] }),
      ).toBe(true);
    });

    it("matches a row when a parent collection's selection expands to include a child the row has access to", () => {
      // The filter-menu widget expands a selected parent collection into its full subtree of
      // descendant IDs before the row filter ever runs, so a parent/child selection arrives here
      // as multiple collection IDs. The row should match as long as it has access to any of them.
      expect(
        (component as any).filterGroups(row, {
          collections: ["col-parent", "col-eng", "col-other-child"],
        }),
      ).toBe(true);
    });
  });

  describe("confirmDelete", () => {
    const group1 = makeGroup({ id: "group-1", name: "Engineering Team" });
    const group2 = makeGroup({ id: "group-2", name: "Design Team" });
    const row1 = { details: group1, collectionChips: [] as ChipGroupItem[] };
    const row2 = { details: group2, collectionChips: [] as ChipGroupItem[] };

    beforeEach(async () => {
      createComponent();
      await detectAndFlush();
    });

    it("does nothing when given no rows", async () => {
      await (component as any).confirmDelete([]);
      expect(mockDialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("shows the singular dialog and deletes on confirm", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      mockGroupService.deleteMany.mockResolvedValue(undefined);

      await (component as any).confirmDelete([row1]);

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "deleteGroup" },
          content: { key: "deleteGroupWarningDesc" },
          type: "danger",
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

      await (component as any).confirmDelete([row1, row2]);

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "deleteGroups", placeholders: ["2"] },
          content: { key: "deleteGroupsWarningDesc" },
          type: "danger",
        }),
      );
      expect(mockGroupService.deleteMany).toHaveBeenCalledWith(orgId, ["group-1", "group-2"]);
      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "groupsDeleted:2" }),
      );
    });

    it("does not delete or toast when the admin cancels the dialog", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      await (component as any).confirmDelete([row1]);

      expect(mockGroupService.deleteMany).not.toHaveBeenCalled();
      expect(mockToastService.showToast).not.toHaveBeenCalled();
    });

    it("logs and does not toast when the delete call fails", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      mockGroupService.deleteMany.mockRejectedValue(new Error("boom"));

      await (component as any).confirmDelete([row1]);

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
      const row = { details: group, collectionChips: [] as ChipGroupItem[] };
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      mockGroupService.deleteMany.mockResolvedValue(undefined);

      (component as any).selectedGroups.set([row]);
      (component as any).confirmDeleteSelected();
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

    it("opens the edit dialog for the clicked row's group, scoped to the current organization", async () => {
      const group = makeGroup({ id: "group-1" });
      const row = { details: group, collectionChips: [] as ChipGroupItem[] };

      mockDialogService.open.mockReturnValue({
        closed: of(GroupAddEditDialogResultType.Saved),
      } as any);

      await component.edit(row);

      expect(mockDialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: orgId, groupId: "group-1" }),
        }),
      );
    });

    it("refreshes the list when the dialog reports Saved", async () => {
      const group = makeGroup({ id: "group-1" });
      const row = { details: group, collectionChips: [] as ChipGroupItem[] };

      mockDialogService.open.mockReturnValue({
        closed: of(GroupAddEditDialogResultType.Saved),
      } as any);
      mockGroupService.getAllDetails.mockClear();

      await component.edit(row);

      expect(mockGroupService.getAllDetails).toHaveBeenCalledTimes(1);
      expect(mockToastService.showToast).not.toHaveBeenCalled();
    });

    it("removes the row and does not toast, when the dialog reports Deleted", async () => {
      const group = makeGroup({ id: "group-1" });
      const row = { details: group, collectionChips: [] as ChipGroupItem[] };

      component["rows"].set([row]);
      expect(component["rows"]()).toContain(row);

      mockDialogService.open.mockReturnValue({
        closed: of(GroupAddEditDialogResultType.Deleted),
      } as any);

      await component.edit(row);

      expect(component["rows"]()).not.toContain(row);
      expect(mockToastService.showToast).not.toHaveBeenCalled();
    });
  });

  describe("hasNoGroups", () => {
    it("is false while loading", () => {
      mockGroupService.getAllDetails.mockReturnValue(new Promise(() => {})); // never resolves
      createComponent();

      expect((component as any).hasNoGroups()).toBe(false);
    });

    it("is true once loaded with zero groups", async () => {
      mockGroupService.getAllDetails.mockResolvedValue([]);
      createComponent();
      await detectAndFlush();

      expect((component as any).hasNoGroups()).toBe(true);
    });

    it("is false once loaded with at least one group", async () => {
      mockGroupService.getAllDetails.mockResolvedValue([makeGroup()]);
      createComponent();
      await detectAndFlush();

      expect((component as any).hasNoGroups()).toBe(false);
    });
  });
});
