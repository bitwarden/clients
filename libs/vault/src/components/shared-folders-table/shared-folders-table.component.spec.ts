import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { BitTableV2Component, DialogService, FilterControl } from "@bitwarden/components";

import { SharedFolderPermission } from "./shared-folder-permission";
import { SharedFoldersTableBulkAction } from "./shared-folders-table-bulk-action";
import { SharedFolderRow, SharedFoldersTableRowAction } from "./shared-folders-table-row";
import {
  SharedFoldersTableColumn,
  SharedFoldersTableComponent,
  SharedFoldersTableFilters,
} from "./shared-folders-table.component";

function row(overrides: Partial<SharedFolderRow> = {}): SharedFolderRow {
  return {
    id: "col-1",
    organizationId: "org-1",
    name: "Engineering",
    permissions: SharedFolderPermission.Manage,
    items: 4,
    ...overrides,
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

    expect(links).toEqual(["/org-a/col-a", "/org-b/col-b"]);
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
      SharedFolderPermission.View,
      SharedFolderPermission.ViewExceptPass,
      SharedFolderPermission.Edit,
      SharedFolderPermission.EditExceptPass,
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

  it("emits add when the toolbar button is pressed", () => {
    const add = jest.fn();
    component.add.subscribe(add);
    fixture.detectChanges();

    fixture.nativeElement.querySelector("#shared-folders-table_button_add").click();

    expect(add).toHaveBeenCalled();
  });
});
