import { ChangeDetectionStrategy, Component, signal, Type, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DialogService } from "../../dialog";

import { BitCellDefDirective } from "./bit-cell-def.directive";
import { BitCellComponent } from "./bit-cell.component";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderCellComponent } from "./bit-header-cell.component";
import { defineTable } from "./table-def";
import { BitTableV2Component } from "./table-v2.component";

type Row = { name: string; vault: string; folder: string; actions: string };

const mockI18nService = { t: (key: string) => key };

/** No `StateProvider` here, so preferences fall back to the in-memory session store. */
async function renderHost<H>(host: Type<H>): Promise<ComponentFixture<H>> {
  await TestBed.configureTestingModule({
    imports: [host],
    providers: [
      { provide: I18nService, useValue: mockI18nService },
      { provide: DialogService, useValue: {} },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  return fixture;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
  ],
  template: `
    <bit-table-v2
      [tableDef]="table"
      [customizeKey]="key()"
      [displayedColumns]="displayed()"
      [presentation]="presentation()"
    >
      <bit-column width="100px">
        <bit-header-cell>Name</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
      </bit-column>
      <bit-column customizable width="100px" [sortFn]="sortByVault">
        <bit-header-cell>Vault</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.vault; let row">{{ row.vault }}</bit-cell>
      </bit-column>
      <bit-column customizable width="100px">
        <bit-header-cell>Folder</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.folder; let row">{{ row.folder }}</bit-cell>
      </bit-column>
      <bit-column width="100px">
        <bit-header-cell><span aria-hidden="true"></span></bit-header-cell>
        <bit-cell *bitCellDef="table.columns.actions; let row">{{ row.actions }}</bit-cell>
      </bit-column>
    </bit-table-v2>
  `,
})
class TestHostComponent {
  readonly key = signal<string | undefined>("test-table");
  readonly displayed = signal<string[] | undefined>(undefined);
  readonly presentation = signal<"table" | "list">("table");
  readonly rows = signal<Row[]>([{ name: "one", vault: "v", folder: "f", actions: "a" }]);
  /** Orders vaults by their trailing digit, which plain string compare would not produce. */
  readonly sortByVault = (a: Row, b: Row) => a.vault.slice(-1).localeCompare(b.vault.slice(-1));
  readonly table = defineTable<Row>(this.rows);
  readonly tableCmp = viewChild.required(BitTableV2Component);
}

describe("BitTableV2Component column customization", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    fixture = await renderHost(TestHostComponent);
    host = fixture.componentInstance;
  });

  const table = () => host.tableCmp();
  const names = () =>
    table()
      .effectiveColumns()
      .map((c) => c.name());
  const headerCell = (name: string) =>
    fixture.nativeElement.querySelector(`[data-bit-column="${name}"]`) as HTMLElement | null;

  it("offers only the columns marked customizable, never the first", () => {
    expect(
      table()
        .customizableColumns()
        .map((c) => c.name()),
    ).toEqual(["vault", "folder"]);
  });

  it("reads each customizable column's label from its rendered header", () => {
    expect(table().customizableColumnLabels()).toEqual([
      { name: "vault", label: "Vault" },
      { name: "folder", label: "Folder" },
    ]);
  });

  it("hides a toggled column from the rendered columns", () => {
    table().setColumnHidden("vault", true);
    fixture.detectChanges();

    expect(names()).toEqual(["name", "folder", "actions"]);
  });

  it("keeps a hidden column's header stamped, but out of the grid and the a11y tree", () => {
    table().setColumnHidden("vault", true);
    fixture.detectChanges();

    const cell = headerCell("vault");
    expect(cell).not.toBeNull();
    // Still readable, which is the whole point — its label has to survive being hidden.
    expect(cell!.textContent!.trim()).toBe("Vault");
    expect(cell!.closest("[aria-hidden='true']")).not.toBeNull();
    expect(cell!.closest(".tw-hidden")).not.toBeNull();
  });

  it("still reports a hidden column's label to the dialog", () => {
    table().setColumnHidden("vault", true);
    fixture.detectChanges();

    expect(
      table()
        .customizableColumnLabels()
        .map((c) => c.label),
    ).toEqual(["Vault", "Folder"]);
  });

  it("drops the hidden column's track from the grid", () => {
    // Every column here is fixed, so the first is freed to fill the row — see "row fill fallback".
    expect(table().gridTemplateColumns()).toBe("minmax(100px, 1fr) 100px 100px 100px");

    table().setColumnHidden("vault", true);
    fixture.detectChanges();

    expect(table().gridTemplateColumns()).toBe("minmax(100px, 1fr) 100px 100px");
  });

  it("toggles a column back on", () => {
    table().setColumnHidden("vault", true);
    fixture.detectChanges();
    table().setColumnHidden("vault", false);
    fixture.detectChanges();

    expect(names()).toEqual(["name", "vault", "folder", "actions"]);
  });

  it("leaves only the primary and non-customizable columns when everything is hidden", () => {
    table().setColumnHidden("vault", true);
    table().setColumnHidden("folder", true);
    fixture.detectChanges();

    expect(names()).toEqual(["name", "actions"]);
  });

  it("restores the declared set on reset", () => {
    table().setColumnHidden("vault", true);
    table().setColumnHidden("folder", true);
    fixture.detectChanges();

    table().resetColumns();
    fixture.detectChanges();

    expect(names()).toEqual(["name", "vault", "folder", "actions"]);
  });

  it("omits a customizable column whose header has no text", () => {
    // The actions column is icon-only; mark it customizable to prove the label check,
    // not the `customizable` flag, is what keeps it out of the dialog.
    const actions = table()
      .availableColumns()
      .find((c) => c.name() === "actions")!;
    jest.spyOn(actions, "customizable").mockReturnValue(true);
    fixture.detectChanges();

    expect(
      table()
        .customizableColumnLabels()
        .map((c) => c.name),
    ).toEqual(["vault", "folder"]);
  });

  describe("canCustomizeColumns", () => {
    it("is true for a table presentation with a key and a customizable column", () => {
      expect(table().canCustomizeColumns()).toBe(true);
    });

    it("is false without a customizeKey", () => {
      host.key.set(undefined);
      fixture.detectChanges();

      expect(table().canCustomizeColumns()).toBe(false);
    });

    it("is false in list presentation", () => {
      host.presentation.set("list");
      fixture.detectChanges();

      expect(table().canCustomizeColumns()).toBe(false);
    });

    it("is false when no column is customizable", () => {
      host.displayed.set(["name", "actions"]);
      fixture.detectChanges();

      expect(table().canCustomizeColumns()).toBe(false);
    });
  });

  describe("composition with displayedColumns", () => {
    it("never offers a column the host has already dropped", () => {
      host.displayed.set(["name", "folder", "actions"]);
      fixture.detectChanges();

      expect(
        table()
          .customizableColumns()
          .map((c) => c.name()),
      ).toEqual(["folder"]);
    });

    it("keeps a stored choice while the host drops the column, and reapplies it later", () => {
      table().setColumnHidden("vault", true);
      host.displayed.set(["name", "folder", "actions"]);
      fixture.detectChanges();
      expect(names()).toEqual(["name", "folder", "actions"]);

      host.displayed.set(undefined);
      fixture.detectChanges();

      expect(names()).toEqual(["name", "folder", "actions"]);
    });
  });

  describe("composition with sorting", () => {
    beforeEach(() => {
      host.rows.set([
        { name: "one", vault: "c1", folder: "f", actions: "a" },
        { name: "two", vault: "b3", folder: "f", actions: "a" },
        { name: "three", vault: "a2", folder: "f", actions: "a" },
      ]);
      table().sort.set({ column: "vault", direction: "asc" });
      fixture.detectChanges();
    });

    it("keeps a hidden column's sortFn so the row order does not shift", () => {
      const before = table()
        .sorted()
        .map((r) => r.name);
      expect(before).toEqual(["one", "three", "two"]);

      table().setColumnHidden("vault", true);
      fixture.detectChanges();

      expect(
        table()
          .sorted()
          .map((r) => r.name),
      ).toEqual(before);
    });
  });
});

/** Bounded everywhere except Folder, which the user can hide — stripping the row of its only `fr`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
  ],
  template: `
    <bit-table-v2 [tableDef]="table" customizeKey="fill-table">
      <bit-column width="minmax(240px, 480px)">
        <bit-header-cell>Name</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
      </bit-column>
      <bit-column customizable width="100px">
        <bit-header-cell>Vault</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.vault; let row">{{ row.vault }}</bit-cell>
      </bit-column>
      <bit-column customizable width="minmax(140px, 1fr)">
        <bit-header-cell>Folder</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.folder; let row">{{ row.folder }}</bit-cell>
      </bit-column>
      <bit-column width="160px">
        <bit-header-cell>Actions</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.actions; let row">{{ row.actions }}</bit-cell>
      </bit-column>
    </bit-table-v2>
  `,
})
class RowFillHostComponent {
  readonly rows = signal<Row[]>([{ name: "one", vault: "v", folder: "f", actions: "a" }]);
  readonly table = defineTable<Row>(this.rows);
  readonly tableCmp = viewChild.required(BitTableV2Component);
}

describe("BitTableV2Component row fill fallback", () => {
  let fixture: ComponentFixture<RowFillHostComponent>;

  beforeEach(async () => {
    fixture = await renderHost(RowFillHostComponent);
  });

  const table = () => fixture.componentInstance.tableCmp();

  it("leaves the first column bounded while another visible column is flexible", () => {
    expect(table().gridTemplateColumns()).toBe(
      "minmax(240px, 480px) 100px minmax(140px, 1fr) 160px",
    );
  });

  it("frees the first column's max once the last flexible track is hidden", () => {
    table().setColumnHidden("folder", true);
    fixture.detectChanges();

    expect(table().gridTemplateColumns()).toBe("minmax(240px, 1fr) 100px 160px");
  });

  it("restores the declared width when the flexible column comes back", () => {
    table().setColumnHidden("folder", true);
    fixture.detectChanges();
    table().setColumnHidden("folder", false);
    fixture.detectChanges();

    expect(table().gridTemplateColumns()).toBe(
      "minmax(240px, 480px) 100px minmax(140px, 1fr) 160px",
    );
  });

  it("keeps a fixed first column's length as the minimum", () => {
    const name = table()
      .availableColumns()
      .find((c) => c.name() === "name")!;
    jest.spyOn(name, "width").mockReturnValue("100px");
    table().setColumnHidden("folder", true);
    fixture.detectChanges();

    expect(table().gridTemplateColumns()).toBe("minmax(100px, 1fr) 100px 160px");
  });
});
