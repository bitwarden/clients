import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { BitTableV2Component, DialogService, FilterControl } from "@bitwarden/components";

import { SharedFolderRow, SharedFoldersTableRowAction } from "./shared-folders-table-row";
import {
  SharedFoldersTableColumn,
  SharedFoldersTableComponent,
  SharedFoldersTableFilters,
} from "./shared-folders-table.component";

function row(overrides: Partial<SharedFolderRow> = {}): SharedFolderRow {
  return { id: "col-1", name: "Engineering", permissions: "Can manage", items: 4, ...overrides };
}

describe("SharedFoldersTableComponent", () => {
  let fixture: ComponentFixture<SharedFoldersTableComponent>;
  let component: SharedFoldersTableComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedFoldersTableComponent],
      providers: [
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

  /** The registered `FilterControl` for the adopted `bit-search`. */
  function searchControl(): FilterControl {
    const control = bitTable()
      .filterControls()
      .find((c) => c.key() === "search");
    if (!control) {
      throw new Error("No FilterControl registered for the projected search");
    }
    return control;
  }

  it("renders a row per shared folder", () => {
    fixture.componentRef.setInput("sharedFolders", [
      row({ id: "a", name: "Engineering", permissions: "Can manage", items: 42 }),
      row({ id: "b", name: "Finance", permissions: "Can edit", items: 8 }),
    ]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("Engineering");
    expect(text).toContain("Can manage");
    expect(text).toContain("42");
    expect(text).toContain("Finance");
    expect(text).toContain("Can edit");
    expect(text).toContain("8");
  });

  it("declares the name, permissions, items, and options columns in order", () => {
    fixture.detectChanges();

    expect(
      bitTable()
        .effectiveColumns()
        .map((column) => column.name()),
    ).toEqual(["name", "permissions", "items", "options"]);
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

    it("does not match on the permission label or the item count", () => {
      expect(applyFilter(row({ permissions: "Can manage" }), { search: "manage" })).toBe(false);
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

  it("emits add when the toolbar button is pressed", () => {
    const add = jest.fn();
    component.add.subscribe(add);
    fixture.detectChanges();

    fixture.nativeElement.querySelector("#shared-folders-table_button_add").click();

    expect(add).toHaveBeenCalled();
  });
});
