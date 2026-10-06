import { ChangeDetectionStrategy, Component, signal, Type, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { delay, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ActiveUserState, StateProvider } from "@bitwarden/state";

import { DialogService } from "../../dialog";
import { StorybookStateProvider } from "../../utils";

import { BitCellDefDirective } from "./bit-cell-def.directive";
import { BitCellComponent } from "./bit-cell.component";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderCellComponent } from "./bit-header-cell.component";
import { CustomizeColumnsDialogParams } from "./customize-columns-dialog.component";
import { defineTable } from "./table-def";
import { TableStateKey } from "./table-state-keys";
import { BitTableV2Component } from "./table-v2.component";

type Row = { name: string; vault: string; folder: string; actions: string };

const mockI18nService = { t: (key: string) => key };

let dialogService: MockProxy<DialogService>;

async function renderHost<H>(
  host: Type<H>,
  stateProvider: StateProvider = new StorybookStateProvider(),
): Promise<ComponentFixture<H>> {
  dialogService = mock<DialogService>();
  await TestBed.configureTestingModule({
    imports: [host],
    providers: [
      { provide: I18nService, useValue: mockI18nService },
      { provide: DialogService, useValue: dialogService },
      { provide: StateProvider, useValue: stateProvider },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  return fixture;
}

/** Opens the Customize dialog and returns what the table handed it. */
function openDialog(table: Pick<BitTableV2Component, "openCustomizeColumns">) {
  table.openCustomizeColumns();
  return dialogService.open.mock.lastCall![1]!.data as CustomizeColumnsDialogParams;
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
      [stateKey]="key()"
      [displayedColumns]="displayed()"
      [presentation]="presentation()"
    >
      <bit-column width="100px" label="Name" [removable]="nameRemovable()">
        <bit-header-cell>Name</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
      </bit-column>
      <bit-column removable label="Vault" width="100px" [sortFn]="sortByVault">
        <bit-header-cell>Vault</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.vault; let row">{{ row.vault }}</bit-cell>
      </bit-column>
      <bit-column removable label="Folder" width="100px">
        <bit-header-cell>Folder</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.folder; let row">{{ row.folder }}</bit-cell>
      </bit-column>
      <bit-column width="100px" [removable]="actionsRemovable()">
        <bit-header-cell><span aria-hidden="true"></span></bit-header-cell>
        <bit-cell *bitCellDef="table.columns.actions; let row">{{ row.actions }}</bit-cell>
      </bit-column>
    </bit-table-v2>
  `,
})
class TestHostComponent {
  readonly key = signal<TableStateKey | undefined>("vaultItems");
  readonly displayed = signal<string[] | undefined>(undefined);
  readonly presentation = signal<"table" | "list">("table");
  readonly nameRemovable = signal(false);
  readonly actionsRemovable = signal(false);
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
  const offered = () => openDialog(table()).columns.map((c) => c.name());
  const setHidden = (name: string, hidden = true) => openDialog(table()).setHidden(name, hidden);

  it("offers only the columns marked removable", () => {
    expect(offered()).toEqual(["vault", "folder"]);
  });

  it("offers the first column when it is marked removable", () => {
    host.nameRemovable.set(true);
    fixture.detectChanges();

    expect(offered()).toEqual(["name", "vault", "folder"]);
  });

  it("labels each offered column with its `label`", () => {
    expect(openDialog(table()).columns.map((c) => c.label())).toEqual(["Vault", "Folder"]);
  });

  it("hides a toggled column from the rendered columns", () => {
    setHidden("vault");
    fixture.detectChanges();

    expect(names()).toEqual(["name", "folder", "actions"]);
  });

  it("still reports a hidden column's label to the dialog", () => {
    setHidden("vault");
    fixture.detectChanges();

    expect(openDialog(table()).columns.map((c) => c.label())).toEqual(["Vault", "Folder"]);
  });

  it("drops the hidden column's track from the grid", () => {
    // Every column here is fixed, so the first is freed to fill the row — see "row fill fallback".
    expect(table().gridTemplateColumns()).toBe("minmax(100px, 1fr) 100px 100px 100px");

    setHidden("vault");
    fixture.detectChanges();

    expect(table().gridTemplateColumns()).toBe("minmax(100px, 1fr) 100px 100px");
  });

  it("toggles a column back on", () => {
    setHidden("vault");
    fixture.detectChanges();
    setHidden("vault", false);
    fixture.detectChanges();

    expect(names()).toEqual(["name", "vault", "folder", "actions"]);
  });

  it("leaves only the non-removable columns when everything is hidden", () => {
    setHidden("vault");
    setHidden("folder");
    fixture.detectChanges();

    expect(names()).toEqual(["name", "actions"]);
  });

  it("restores the declared set on reset", () => {
    setHidden("vault");
    setHidden("folder");
    fixture.detectChanges();

    openDialog(table()).reset();
    fixture.detectChanges();

    expect(names()).toEqual(["name", "vault", "folder", "actions"]);
  });

  it("omits a removable column with no label", () => {
    host.actionsRemovable.set(true);
    fixture.detectChanges();

    expect(offered()).toEqual(["vault", "folder"]);
  });

  describe("canCustomizeColumns", () => {
    it("is true for a table presentation with a key and a removable column", () => {
      expect(table().canCustomizeColumns()).toBe(true);
    });

    it("is false without a stateKey", () => {
      host.key.set(undefined);
      fixture.detectChanges();

      expect(table().canCustomizeColumns()).toBe(false);
    });

    it("is false in list presentation", () => {
      host.presentation.set("list");
      fixture.detectChanges();

      expect(table().canCustomizeColumns()).toBe(false);
    });

    it("is false when no column is removable", () => {
      host.displayed.set(["name", "actions"]);
      fixture.detectChanges();

      expect(table().canCustomizeColumns()).toBe(false);
    });
  });

  describe("composition with displayedColumns", () => {
    it("never offers a column the host has already dropped", () => {
      host.displayed.set(["name", "folder", "actions"]);
      fixture.detectChanges();

      expect(offered()).toEqual(["folder"]);
    });

    it("keeps a stored choice while the host drops the column, and reapplies it later", () => {
      setHidden("vault");
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

      setHidden("vault");
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
    <bit-table-v2 [tableDef]="table" stateKey="vaultItems">
      <bit-column width="minmax(240px, 480px)">
        <bit-header-cell>Name</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
      </bit-column>
      <bit-column removable label="Vault" width="100px">
        <bit-header-cell>Vault</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.vault; let row">{{ row.vault }}</bit-cell>
      </bit-column>
      <bit-column removable label="Folder" width="minmax(140px, 1fr)">
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
  const setHidden = (name: string, hidden = true) => openDialog(table()).setHidden(name, hidden);

  it("leaves the first column bounded while another visible column is flexible", () => {
    expect(table().gridTemplateColumns()).toBe(
      "minmax(240px, 480px) 100px minmax(140px, 1fr) 160px",
    );
  });

  it("frees the first column's max once the last flexible track is hidden", () => {
    setHidden("folder");
    fixture.detectChanges();

    expect(table().gridTemplateColumns()).toBe("minmax(240px, 1fr) 100px 160px");
  });

  it("restores the declared width when the flexible column comes back", () => {
    setHidden("folder");
    fixture.detectChanges();
    setHidden("folder", false);
    fixture.detectChanges();

    expect(table().gridTemplateColumns()).toBe(
      "minmax(240px, 480px) 100px minmax(140px, 1fr) 160px",
    );
  });

  it("keeps a fixed first column's length as the minimum", () => {
    const name = table()
      .effectiveColumns()
      .find((c) => c.name() === "name")!;
    jest.spyOn(name, "width").mockReturnValue("100px");
    setHidden("folder");
    fixture.detectChanges();

    expect(table().gridTemplateColumns()).toBe("minmax(100px, 1fr) 100px 160px");
  });
});

describe("BitTableV2Component while preferences load", () => {
  it("holds back removable columns until preferences arrive", async () => {
    const stateProvider = mock<StateProvider>();
    stateProvider.getActive.mockReturnValue({
      // Disk-backed state emits after the first render.
      state$: of({ "vault-items": ["folder"] }).pipe(delay(0)),
    } as unknown as ActiveUserState<unknown>);
    const fixture = await renderHost(TestHostComponent, stateProvider);
    const names = () =>
      fixture.componentInstance
        .tableCmp()
        .effectiveColumns()
        .map((c) => c.name());

    expect(names()).toEqual(["name", "actions"]);

    await fixture.whenStable();
    fixture.detectChanges();

    expect(names()).toEqual(["name", "vault", "actions"]);
  });
});
