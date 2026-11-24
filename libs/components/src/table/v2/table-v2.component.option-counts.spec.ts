import { ChangeDetectionStrategy, Component, effect, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DialogService } from "../../dialog";
import { FilterMenuComponent, FilterMenuModule } from "../../filter-menu";

import { BitCellDefDirective } from "./bit-cell-def.directive";
import { BitCellComponent } from "./bit-cell.component";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderCellComponent } from "./bit-header-cell.component";
import { defineTable } from "./table-def";
import { BitTableV2Component } from "./table-v2.component";

type Item = { id: number; type: string; folders: string[] };
type Filters = { type?: string | null; folder?: string[] | null };

const items: Item[] = [
  { id: 1, type: "login", folders: ["work"] },
  { id: 2, type: "login", folders: ["work", "home"] },
  { id: 3, type: "card", folders: ["home"] },
  { id: 4, type: "card", folders: [] },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
    FilterMenuModule,
  ],
  template: `
    <bit-table-v2 [tableDef]="table" [filter]="filter" [optionValues]="optionValues">
      <bit-filter-menu key="type" placeholderText="Type" multiple>
        <bit-filter-option [value]="'login'">Login</bit-filter-option>
        <bit-filter-option [value]="'card'">Card</bit-filter-option>
      </bit-filter-menu>
      <bit-filter-menu key="folder" placeholderText="Folders" multiple>
        <bit-filter-option [value]="'work'">Work</bit-filter-option>
        <bit-filter-option [value]="'home'">Home</bit-filter-option>
      </bit-filter-menu>
      <bit-column>
        <bit-header-cell>Id</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
      </bit-column>
    </bit-table-v2>
  `,
})
class CountsHostComponent {
  protected readonly table = defineTable<Item>(signal(items));
  private tests = 0;

  /** How many times the table has tested a row since this was last called. */
  takeRowTests(): number {
    const tests = this.tests;
    this.tests = 0;
    return tests;
  }

  protected readonly filter = (row: Item, values: Filters) => {
    this.tests++;
    const types = (values.type ?? []) as unknown as string[];
    const folders = values.folder ?? [];
    return (
      (types.length === 0 || types.includes(row.type)) &&
      (folders.length === 0 || row.folders.some((folder) => folders.includes(folder)))
    );
  };

  protected readonly optionValues = {
    type: (row: Item) => [row.type],
    folder: (row: Item) => row.folders,
  };
}

describe("BitTableV2Component option counts", () => {
  let host: CountsHostComponent;
  let table: BitTableV2Component<Item, never, Filters>;
  let folderChip: FilterMenuComponent;
  let typeChip: FilterMenuComponent;

  const folderCounts = () => [...folderChip.optionCounts().values()];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CountsHostComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DialogService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(CountsHostComponent);
    fixture.detectChanges();
    host = fixture.componentInstance;
    table = fixture.debugElement.query(By.directive(BitTableV2Component)).componentInstance;
    // Chips outside a toolbar aren't projected, so reach them through the table's registry.
    const chips = table.filterControls() as FilterMenuComponent[];
    typeChip = chips.find((chip) => chip.key() === "type")!;
    folderChip = chips.find((chip) => chip.key() === "folder")!;

    // Stands in for the open folder menu, which shows the counts, and the table's own rows.
    TestBed.runInInjectionContext(() =>
      effect(() => {
        table.filtered();
        folderChip.optionCounts();
      }),
    );
    TestBed.tick();
    host.takeRowTests();
  });

  it("counts each option's rows", () => {
    expect(folderCounts()).toEqual([2, 2]);
  });

  it("does not count a chip's options again when only that chip's own selection changes", () => {
    folderChip.toggle("work");
    TestBed.tick();

    // One pass to filter the table's rows, and none to recount: an option's count is taken
    // with its own chip cleared, so the chip's selection can't change it.
    expect(host.takeRowTests()).toBe(items.length);
    expect(folderCounts()).toEqual([2, 2]);
  });

  it("counts a chip's options again when another chip's selection changes", () => {
    typeChip.toggle("card");
    TestBed.tick();

    expect(host.takeRowTests()).toBe(items.length * 2);
    expect(folderCounts()).toEqual([0, 1]);
  });
});
