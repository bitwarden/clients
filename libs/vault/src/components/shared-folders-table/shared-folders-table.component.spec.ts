import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import {
  BitTablePaginatorComponent,
  BitTableV2Component,
  DialogService,
  FilterControl,
} from "@bitwarden/components";

import { SharedFolderPermission } from "./shared-folder-permission";
import { SharedFoldersTableBulkAction } from "./shared-folders-table-bulk-action";
import { SharedFolderRow, SharedFoldersTableRowAction } from "./shared-folders-table-row";
import {
  SharedFoldersTableColumn,
  SharedFoldersTableComponent,
  SharedFoldersTableFilters,
} from "./shared-folders-table.component";

/**
 * A row, with the ids a row brands relaxed to plain strings so a test can name a folder by a
 * readable id rather than casting at every call.
 */
function row(
  overrides: Partial<Omit<SharedFolderRow, "id" | "organizationId">> & {
    id?: string;
    organizationId?: string;
  } = {},
): SharedFolderRow {
  const { id = "col-1", organizationId = "org-1", ...rest } = overrides;
  return {
    id: id as CollectionId,
    organizationId: organizationId as OrganizationId,
    name: "Engineering",
    permissions: SharedFolderPermission.Manage,
    items: 4,
    ...rest,
  };
}

describe("SharedFoldersTableComponent", () => {
  let fixture: ComponentFixture<SharedFoldersTableComponent>;
  let component: SharedFoldersTableComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedFoldersTableComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: LogService, useValue: mock<LogService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SharedFoldersTableComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("sharedFolders", []);
  });

  /** The component's filter predicate, which the table derives its rendered rows from. */
  function applyFilter(sharedFolder: SharedFolderRow, values: SharedFoldersTableFilters): boolean {
    return component["filter"](sharedFolder, values);
  }

  /** The projected `bit-table-v2` instance. */
  function bitTable(): BitTableV2Component<
    SharedFolderRow,
    SharedFoldersTableColumn,
    SharedFoldersTableFilters
  > {
    return fixture.debugElement.query(By.directive(BitTableV2Component)).componentInstance;
  }

  /** The registered `FilterControl` for a given key. */
  function filterControl(key: string): FilterControl {
    const control = bitTable()
      .filterControls()
      .find((c) => c.key() === key);
    if (!control) {
      throw new Error(`No FilterControl registered under "${key}"`);
    }
    return control;
  }

  /** The registered `FilterControl` for the adopted `bit-search`. */
  function searchControl(): FilterControl {
    return filterControl("search");
  }

  it("renders a row per shared folder", () => {
    fixture.componentRef.setInput("sharedFolders", [
      row({ id: "a", name: "Engineering", permissions: SharedFolderPermission.Manage, items: 42 }),
      row({ id: "b", name: "Finance", permissions: SharedFolderPermission.Edit, items: 8 }),
    ]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("Engineering");
    expect(text).toContain("42");
    expect(text).toContain("Finance");
    expect(text).toContain("8");
  });

  it("links each folder's name to its organization and collection", () => {
    fixture.componentRef.setInput("sharedFolders", [
      row({ id: "col-a", organizationId: "org-a", name: "Engineering" }),
      row({ id: "col-b", organizationId: "org-b", name: "Finance" }),
    ]);
    fixture.detectChanges();

    const links = fixture.debugElement
      .queryAll(By.css("a[bitLink]"))
      .map((link) => (link.nativeElement as HTMLAnchorElement).getAttribute("href"));

    expect(links).toEqual(["/vault/org-a/col-a", "/vault/org-b/col-b"]);
  });

  // The stubbed `I18nService` echoes the key, so a cell renders the message key rather than the
  // label — which is the assertion worth making: that the table translates the permission at all.
  it("renders each permission's translated label", () => {
    fixture.componentRef.setInput("sharedFolders", [
      row({ id: "a", permissions: SharedFolderPermission.Manage }),
      row({ id: "b", permissions: SharedFolderPermission.View }),
      row({ id: "c", permissions: SharedFolderPermission.ViewExceptPass }),
      row({ id: "d", permissions: SharedFolderPermission.Edit }),
      row({ id: "e", permissions: SharedFolderPermission.EditExceptPass }),
    ]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("manage");
    expect(text).toContain("viewItems");
    expect(text).toContain("viewItemsHidePass");
    expect(text).toContain("editItems");
    expect(text).toContain("editItemsHidePass");
  });

  it("sorts the permissions column by permission rather than by label", () => {
    const sortByPermission = component["sortByPermission"];
    const shuffled = [
      row({ id: "a", permissions: SharedFolderPermission.Manage }),
      row({ id: "b", permissions: SharedFolderPermission.Edit }),
      row({ id: "c", permissions: SharedFolderPermission.View }),
      row({ id: "d", permissions: SharedFolderPermission.EditExceptPass }),
      row({ id: "e", permissions: SharedFolderPermission.ViewExceptPass }),
    ];

    expect([...shuffled].sort(sortByPermission).map((r) => r.permissions)).toEqual([
      SharedFolderPermission.ViewExceptPass,
      SharedFolderPermission.View,
      SharedFolderPermission.EditExceptPass,
      SharedFolderPermission.Edit,
      SharedFolderPermission.Manage,
    ]);
  });

  it("declares the name, permissions, items, and options columns in order", () => {
    fixture.detectChanges();

    expect(
      bitTable()
        .effectiveColumns()
        .map((column) => column.name()),
    ).toEqual(["name", "permissions", "items", "options"]);
  });

  describe("the empty state", () => {
    /** The empty state's Clear all button, hidden rather than removed while no chip is active. */
    function clearFiltersButton(): HTMLButtonElement {
      const button = fixture.nativeElement.querySelector(
        "#shared-folders-table_button_clear-filters",
      ) as HTMLButtonElement | null;
      if (!button) {
        throw new Error("The empty state's Clear all button is not rendered");
      }
      return button;
    }

    it("invites the client's Add button when there are no shared folders at all", () => {
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("noSharedFoldersAdded");
      expect(text).toContain("noSharedFoldersAddedDescription");
    });

    it("switches to the no-matches copy once rows are filtered down to none", () => {
      fixture.componentRef.setInput("sharedFolders", [row({ id: "a", name: "Engineering" })]);
      fixture.detectChanges();

      searchControl().setValue("finance");
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(bitTable().filtered()).toEqual([]);
      expect(text).toContain("noMatchingItems");
      expect(text).toContain("clearFiltersOrTryAnother");
    });

    it("offers Clear all only while a chip filter is active", () => {
      fixture.componentRef.setInput("sharedFolders", [
        row({ id: "a", name: "Engineering", permissions: SharedFolderPermission.Manage }),
        row({ id: "b", name: "Finance", permissions: SharedFolderPermission.View }),
      ]);
      fixture.detectChanges();

      // A search term alone leaves nothing for Clear all to clear.
      searchControl().setValue("nothing matches this");
      fixture.detectChanges();
      expect(clearFiltersButton().classList).toContain("tw-hidden");

      filterControl("permissions").setValue([SharedFolderPermission.View]);
      fixture.detectChanges();
      expect(clearFiltersButton().classList).not.toContain("tw-hidden");
    });

    it("clears the chip filters without disturbing the search term", () => {
      fixture.componentRef.setInput("sharedFolders", [
        row({ id: "a", name: "Engineering", permissions: SharedFolderPermission.Manage }),
        row({ id: "b", name: "Finance", permissions: SharedFolderPermission.View }),
      ]);
      fixture.detectChanges();

      searchControl().setValue("engineering");
      filterControl("permissions").setValue([SharedFolderPermission.View]);
      fixture.detectChanges();

      clearFiltersButton().click();
      fixture.detectChanges();

      expect(filterControl("permissions").active()).toBe(false);
      expect(bitTable().filtered()).toEqual([expect.objectContaining({ name: "Engineering" })]);
    });
  });

  describe("filtering", () => {
    it("matches everything when the search is empty", () => {
      expect(applyFilter(row(), {})).toBe(true);
      expect(applyFilter(row(), { search: "" })).toBe(true);
      expect(applyFilter(row(), { search: "   " })).toBe(true);
    });

    it("matches on a case-insensitive substring of the name", () => {
      expect(applyFilter(row({ name: "Engineering" }), { search: "gine" })).toBe(true);
      expect(applyFilter(row({ name: "Engineering" }), { search: "ENGIN" })).toBe(true);
      expect(applyFilter(row({ name: "Engineering" }), { search: "finance" })).toBe(false);
    });

    it("does not match on the permission or the item count", () => {
      expect(
        applyFilter(row({ permissions: SharedFolderPermission.Manage }), { search: "manage" }),
      ).toBe(false);
      expect(applyFilter(row({ items: 42 }), { search: "42" })).toBe(false);
    });

    it("narrows the rendered rows as the search term changes", () => {
      fixture.componentRef.setInput("sharedFolders", [
        row({ id: "a", name: "Engineering" }),
        row({ id: "b", name: "Finance" }),
      ]);
      fixture.detectChanges();

      searchControl().setValue("fin");
      fixture.detectChanges();

      expect(bitTable().filtered()).toEqual([expect.objectContaining({ name: "Finance" })]);
    });
  });

  describe("the permissions chip", () => {
    it("offers each permission the rows carry, in display order", () => {
      fixture.componentRef.setInput("sharedFolders", [
        row({ id: "a", permissions: SharedFolderPermission.Manage }),
        row({ id: "b", permissions: SharedFolderPermission.View }),
        row({ id: "c", permissions: SharedFolderPermission.Edit }),
        row({ id: "d", permissions: SharedFolderPermission.Manage }),
      ]);

      expect(component["permissionOptions"]()).toEqual([
        SharedFolderPermission.View,
        SharedFolderPermission.Edit,
        SharedFolderPermission.Manage,
      ]);
    });

    it("is omitted when the rows offer fewer than two distinct permissions", () => {
      fixture.componentRef.setInput("sharedFolders", [
        row({ id: "a", permissions: SharedFolderPermission.Manage }),
        row({ id: "b", permissions: SharedFolderPermission.Manage }),
      ]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("bit-filter-menu")).toBeNull();
    });

    it("is rendered when the rows offer more than one distinct permission", () => {
      fixture.componentRef.setInput("sharedFolders", [
        row({ id: "a", permissions: SharedFolderPermission.Manage }),
        row({ id: "b", permissions: SharedFolderPermission.View }),
      ]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("bit-filter-menu")).not.toBeNull();
    });

    it("matches everything when nothing is selected", () => {
      expect(applyFilter(row({ permissions: SharedFolderPermission.Manage }), {})).toBe(true);
      expect(
        applyFilter(row({ permissions: SharedFolderPermission.Manage }), { permissions: [] }),
      ).toBe(true);
    });

    it("matches a row carrying any selected permission", () => {
      const values: SharedFoldersTableFilters = {
        permissions: [SharedFolderPermission.Manage, SharedFolderPermission.View],
      };

      expect(applyFilter(row({ permissions: SharedFolderPermission.Manage }), values)).toBe(true);
      expect(applyFilter(row({ permissions: SharedFolderPermission.View }), values)).toBe(true);
      expect(applyFilter(row({ permissions: SharedFolderPermission.Edit }), values)).toBe(false);
    });

    it("narrows the rendered rows as the selection changes", () => {
      fixture.componentRef.setInput("sharedFolders", [
        row({ id: "a", name: "Engineering", permissions: SharedFolderPermission.Manage }),
        row({ id: "b", name: "Finance", permissions: SharedFolderPermission.View }),
      ]);
      fixture.detectChanges();

      filterControl("permissions").setValue([SharedFolderPermission.View]);
      fixture.detectChanges();

      expect(bitTable().filtered()).toEqual([expect.objectContaining({ name: "Finance" })]);
    });

    it("intersects with the search term", () => {
      fixture.componentRef.setInput("sharedFolders", [
        row({ id: "a", name: "Engineering", permissions: SharedFolderPermission.Manage }),
        row({ id: "b", name: "Finance", permissions: SharedFolderPermission.View }),
        row({ id: "c", name: "Finance archive", permissions: SharedFolderPermission.Manage }),
      ]);
      fixture.detectChanges();

      searchControl().setValue("fin");
      filterControl("permissions").setValue([SharedFolderPermission.Manage]);
      fixture.detectChanges();

      expect(bitTable().filtered()).toEqual([expect.objectContaining({ name: "Finance archive" })]);
    });
  });

  describe("row actions", () => {
    it("omits the options menu trigger when no actions are supplied", () => {
      fixture.componentRef.setInput("sharedFolders", [row()]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("[bitMenuTriggerFor]")).toBeNull();
    });

    it("hides an action whose show predicate rejects the row", () => {
      const actions: SharedFoldersTableRowAction[] = [
        { id: "edit", label: "Edit", icon: "bwi-pencil-square", run: jest.fn() },
        {
          id: "delete",
          label: "Delete",
          icon: "bwi-trash",
          show: (sharedFolder) => sharedFolder.items === 0,
          run: jest.fn(),
        },
      ];
      fixture.componentRef.setInput("rowActions", actions);

      expect(component["visibleActions"](row({ items: 4 })).map((a) => a.id)).toEqual(["edit"]);
      expect(component["visibleActions"](row({ items: 0 })).map((a) => a.id)).toEqual([
        "edit",
        "delete",
      ]);
    });

    it("runs the chosen action with its row", () => {
      const run = jest.fn();
      const sharedFolder = row();

      component["handleAction"](
        { id: "edit", label: "Edit", icon: "bwi-pencil-square", run },
        sharedFolder,
      );

      expect(run).toHaveBeenCalledWith(sharedFolder);
    });
  });

  describe("bulk actions", () => {
    const bulkActions: SharedFoldersTableBulkAction[] = [
      { id: "delete", label: "Delete", icon: "bwi-trash", run: jest.fn() },
    ];

    /** The table's selection model, present only while selection is configured. */
    function selectionModel() {
      const model = bitTable().selectionModel();
      if (!model) {
        throw new Error("The table has no selection model");
      }
      return model;
    }

    it("leaves selection off when no bulk actions are supplied", () => {
      fixture.componentRef.setInput("sharedFolders", [row()]);
      fixture.detectChanges();

      expect(bitTable().selectionModel()).toBeUndefined();
      expect(fixture.nativeElement.querySelector("bit-bulk-actions-bar")).toBeNull();
    });

    it("turns on multi-select and renders the bar once bulk actions are supplied", () => {
      fixture.componentRef.setInput("sharedFolders", [row({ id: "a" }), row({ id: "b" })]);
      fixture.componentRef.setInput("bulkActions", bulkActions);
      fixture.detectChanges();

      selectionModel().select(...bitTable().filtered());

      expect(selectionModel().count()).toBe(2);
      expect(fixture.nativeElement.querySelector("bit-bulk-actions-bar")).not.toBeNull();
    });

    it("hands each bulk action to the bar to render", () => {
      fixture.componentRef.setInput("sharedFolders", [row()]);
      fixture.componentRef.setInput("bulkActions", [
        ...bulkActions,
        { id: "access", label: "Manage access", icon: "bwi-users", run: jest.fn() },
      ]);
      fixture.detectChanges();

      const bar: HTMLElement = fixture.nativeElement.querySelector("bit-bulk-actions-bar");
      expect(bar.textContent).toContain("Delete");
      expect(bar.textContent).toContain("Manage access");
    });

    it("keeps the selection while change detection runs", () => {
      fixture.componentRef.setInput("sharedFolders", [row({ id: "a" })]);
      fixture.componentRef.setInput("bulkActions", bulkActions);
      fixture.detectChanges();

      const [first] = bitTable().filtered();
      selectionModel().select(first);
      fixture.detectChanges();

      expect(selectionModel().selected()).toEqual([first]);
    });

    it("re-points the selection at rebuilt rows carrying the same folders", () => {
      fixture.componentRef.setInput("sharedFolders", [row({ id: "a" }), row({ id: "b" })]);
      fixture.componentRef.setInput("bulkActions", bulkActions);
      fixture.detectChanges();

      const [first] = bitTable().filtered();
      selectionModel().select(first);
      fixture.detectChanges();

      // A client's rows come from a stream, so any sync re-emits fresh objects for the same folders.
      const rebuilt = [row({ id: "a" }), row({ id: "b" })];
      fixture.componentRef.setInput("sharedFolders", rebuilt);
      fixture.detectChanges();

      // The row is still selected — as the object the table now renders, not the one it replaced.
      expect(selectionModel().count()).toBe(1);
      expect(selectionModel().isSelected(bitTable().filtered()[0])).toBe(true);
      expect(selectionModel().selected()).not.toContain(first);
    });

    it("hands a bulk action the rebuilt rows rather than the ones it was selected on", () => {
      const run = jest.fn();
      fixture.componentRef.setInput("sharedFolders", [row({ id: "a" })]);
      fixture.componentRef.setInput("bulkActions", [
        { id: "delete", label: "Delete", icon: "bwi-trash", run },
      ]);
      fixture.detectChanges();

      selectionModel().select(bitTable().filtered()[0]);
      fixture.detectChanges();

      fixture.componentRef.setInput("sharedFolders", [row({ id: "a", name: "Renamed" })]);
      fixture.detectChanges();

      component["resolvedBulkActions"]()[0].invoke();

      expect(run).toHaveBeenCalledWith([expect.objectContaining({ id: "a", name: "Renamed" })]);
    });

    it("drops selected folders the rows no longer hold", () => {
      fixture.componentRef.setInput("sharedFolders", [row({ id: "a" }), row({ id: "b" })]);
      fixture.componentRef.setInput("bulkActions", bulkActions);
      fixture.detectChanges();

      selectionModel().select(...bitTable().filtered());
      fixture.detectChanges();
      expect(selectionModel().count()).toBe(2);

      // What a completed bulk delete leaves behind: the deleted folders are gone from the stream.
      fixture.componentRef.setInput("sharedFolders", [row({ id: "b" })]);
      fixture.detectChanges();

      expect(selectionModel().count()).toBe(1);
      expect(selectionModel().isSelected(bitTable().filtered()[0])).toBe(true);
    });

    it("empties the selection, and hides the bar, once every selected folder is gone", () => {
      fixture.componentRef.setInput("sharedFolders", [row({ id: "a" }), row({ id: "b" })]);
      fixture.componentRef.setInput("bulkActions", bulkActions);
      fixture.detectChanges();

      selectionModel().select(...bitTable().filtered());
      fixture.detectChanges();

      fixture.componentRef.setInput("sharedFolders", []);
      fixture.detectChanges();

      expect(selectionModel().count()).toBe(0);
      expect(component["selectedRows"]()).toEqual([]);

      // The bar takes itself out of the page at a count of zero, so a stale count would leave it
      // announcing a selection that no longer exists.
      const bar: HTMLElement = fixture.nativeElement.querySelector("bit-bulk-actions-bar");
      expect(bar.querySelector("[inert]")).not.toBeNull();
    });

    it("runs an action with the selected rows", () => {
      const run = jest.fn();
      fixture.componentRef.setInput("sharedFolders", [row({ id: "a" }), row({ id: "b" })]);
      fixture.componentRef.setInput("bulkActions", [
        { id: "delete", label: "Delete", icon: "bwi-trash", run },
      ]);
      fixture.detectChanges();

      const [first] = bitTable().filtered();
      selectionModel().select(first);
      fixture.detectChanges();

      component["resolvedBulkActions"]()[0].invoke();

      expect(run).toHaveBeenCalledWith([first]);
    });

    it("resolves each action's disabled state against the selected rows", () => {
      fixture.componentRef.setInput("sharedFolders", [
        row({ id: "a", items: 0 }),
        row({ id: "b", items: 4 }),
      ]);
      fixture.componentRef.setInput("bulkActions", [
        {
          id: "delete",
          label: "Delete",
          icon: "bwi-trash",
          // Deleting a folder that still holds items is a separate, confirmed flow.
          disabled: (rows: readonly SharedFolderRow[]) => rows.some((r) => r.items > 0),
          run: jest.fn(),
        },
      ]);
      fixture.detectChanges();

      const [empty, populated] = bitTable().filtered();

      // The selection reaches the component through the table's `selectedChange` output, so each
      // change needs a pass to land.
      selectionModel().select(empty);
      fixture.detectChanges();
      expect(component["resolvedBulkActions"]()[0].disabled).toBe(false);

      selectionModel().select(populated);
      fixture.detectChanges();
      expect(component["resolvedBulkActions"]()[0].disabled).toBe(true);
    });
  });

  describe("the Add button", () => {
    /** The toolbar's Add button, hidden rather than removed while the client withholds `canAdd`. */
    function addButton(): HTMLButtonElement {
      const button = fixture.nativeElement.querySelector(
        "#shared-folders-table_button_add",
      ) as HTMLButtonElement | null;
      if (!button) {
        throw new Error("The toolbar's Add button is not rendered");
      }
      return button;
    }

    it("emits add when pressed", () => {
      const add = jest.fn();
      component.add.subscribe(add);
      fixture.componentRef.setInput("canAdd", true);
      fixture.detectChanges();

      addButton().click();

      expect(add).toHaveBeenCalled();
    });

    it("is offered once the client sets canAdd", () => {
      fixture.componentRef.setInput("canAdd", true);
      fixture.detectChanges();

      expect(addButton().classList).not.toContain("tw-hidden");
    });

    it("is withheld by default", () => {
      fixture.detectChanges();

      expect(addButton().classList).toContain("tw-hidden");
    });
  });

  describe("pagination", () => {
    /** The window height the fit divides — `jsdom`'s, restored after a test that changes it. */
    const windowHeight = window.innerHeight;

    /**
     * `jsdom` lays nothing out, so every rect is zero and the component would fit its page to a
     * window it can't see. Rows are given a geometry — how far down the viewport they start and how
     * tall each one is — leaving `window.innerHeight` (768 in `jsdom`) as the height to fill.
     */
    function layOutRows({ top, height }: { top: number; height: number }): void {
      jest
        .spyOn(Element.prototype, "getBoundingClientRect")
        .mockReturnValue({ top, height } as DOMRect);
    }

    /**
     * Renders `count` folders and settles the fit. The measurement runs in a render effect — which
     * this zone-based fixture flushes on a tick rather than inside `detectChanges` — and feeds back
     * into the page size, so the rows it settles on need a further pass to reach the DOM.
     */
    function render(count: number): void {
      fixture.componentRef.setInput(
        "sharedFolders",
        Array.from({ length: count }, (_, i) => row({ id: `col-${i}`, name: `Folder ${i}` })),
      );
      settle();
    }

    /** @see {@link render} */
    function settle(): void {
      fixture.detectChanges();
      tick();
      fixture.detectChanges();
    }

    /** The rendered data rows. */
    function renderedRows(): HTMLElement[] {
      return fixture.debugElement.queryAll(By.css("bit-row")).map((row) => row.nativeElement);
    }

    /** The paginator, hidden rather than removed when the window fits every folder. */
    function paginator(): HTMLElement {
      const element = fixture.nativeElement.querySelector(
        "bit-table-paginator",
      ) as HTMLElement | null;
      if (!element) {
        throw new Error("The paginator is not rendered");
      }
      return element;
    }

    /** The paginator's own instance, to stand in for a reader working its rows-per-page select. */
    function paginatorComponent(): BitTablePaginatorComponent {
      return fixture.debugElement.query(By.directive(BitTablePaginatorComponent))
        .componentInstance as BitTablePaginatorComponent;
    }

    afterEach(() => {
      jest.restoreAllMocks();
      Object.defineProperty(window, "innerHeight", {
        value: windowHeight,
        configurable: true,
      });
    });

    // 768 (the window) less 300 (the rows' top) less 84 (the paginator and its gutter) is 384px of
    // room, which holds six 56px rows with 48px to spare.
    it("holds as many rows as the window fits", fakeAsync(() => {
      layOutRows({ top: 300, height: 56 });

      render(20);

      expect(renderedRows()).toHaveLength(6);
    }));

    // The same 584px of room holds ten 56px rows but only seven 76px ones, so the fit divides by
    // the height a row actually rendered at rather than by the nominal one.
    it("fits fewer of a taller row", fakeAsync(() => {
      layOutRows({ top: 100, height: 76 });

      render(20);

      expect(renderedRows()).toHaveLength(7);
    }));

    it("pages rather than shrinking a page below five rows", fakeAsync(() => {
      // Only 68px of room — a page of one row, without the floor.
      layOutRows({ top: 616, height: 56 });

      render(20);

      expect(renderedRows()).toHaveLength(5);
    }));

    it("shows the paginator once the window can't fit every folder", fakeAsync(() => {
      layOutRows({ top: 300, height: 56 });

      render(20);

      expect(paginator().classList).not.toContain("tw-hidden");
    }));

    it("hides the paginator while every folder fits", fakeAsync(() => {
      layOutRows({ top: 300, height: 56 });

      render(6);

      expect(renderedRows()).toHaveLength(6);
      expect(paginator().classList).toContain("tw-hidden");
    }));

    it("re-fits the page as the window is resized", fakeAsync(() => {
      layOutRows({ top: 300, height: 56 });
      render(20);

      Object.defineProperty(window, "innerHeight", { value: 1216, configurable: true });
      window.dispatchEvent(new Event("resize"));
      // Past the audit window that collapses a burst of resize events.
      tick(200);
      settle();

      // 1216 less the same 384px of chrome leaves 832px of room — fourteen 56px rows.
      expect(renderedRows()).toHaveLength(14);
    }));

    it("pages the folders the filters leave, not all of them", fakeAsync(() => {
      layOutRows({ top: 300, height: 56 });
      render(20);

      // "Folder 1" and "Folder 10" through "Folder 19" — eleven of the twenty, six to a page.
      searchControl().setValue("Folder 1");
      settle();

      expect(renderedRows()).toHaveLength(6);
      expect(paginator().classList).not.toContain("tw-hidden");
    }));

    // The rows-per-page select lives in the paginator, so hiding a one-page paginator would take
    // away the control that asked for the longer page — with nothing to restore it until a resize.
    it("keeps the paginator while a hand-picked size fits every folder on one page", fakeAsync(() => {
      layOutRows({ top: 300, height: 56 });
      render(20);

      paginatorComponent().pageSize.set(25);
      settle();

      expect(renderedRows()).toHaveLength(20);
      expect(paginator().classList).not.toContain("tw-hidden");
    }));

    it("offers the fitted size alongside the standard ones", fakeAsync(() => {
      layOutRows({ top: 300, height: 56 });

      render(20);

      expect(component["pageSizeOptions"]()).toEqual([6, 10, 25, 50, 100]);
    }));
  });
});
