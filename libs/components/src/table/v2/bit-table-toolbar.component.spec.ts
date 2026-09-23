import { ChangeDetectionStrategy, Component, signal, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DialogService } from "../../dialog";
import { FilterToggleComponent } from "../../filter-menu/filter-toggle.component";
import { SearchComponent } from "../../search/search.component";
import { TooltipDirective } from "../../tooltip";
import { I18nMockService } from "../../utils/i18n-mock.service";

import { BitCellDefDirective } from "./bit-cell-def.directive";
import { BitCellComponent } from "./bit-cell.component";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderCellComponent } from "./bit-header-cell.component";
import { BitTableToolbarComponent } from "./bit-table-toolbar.component";
import { defineTable } from "./table-def";
import { BitTableV2Component } from "./table-v2.component";

@Component({
  imports: [BitTableToolbarComponent, FilterToggleComponent, SearchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-table-toolbar>
      <bit-search placeholder="Search"></bit-search>
      <bit-filter-toggle
        key="favorites"
        label="Favorites"
        icon="bwi-star"
        iconActive="bwi-star-f"
      ></bit-filter-toggle>
    </bit-table-toolbar>
  `,
})
class HostComponent {
  readonly search = viewChild.required(SearchComponent);
  readonly toggle = viewChild.required(FilterToggleComponent);
}

/** A search-only toolbar: no filter chips projected, so no filter row should lay out. */
@Component({
  imports: [BitTableToolbarComponent, SearchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-table-toolbar>
      <bit-search placeholder="Search"></bit-search>
    </bit-table-toolbar>
  `,
})
class SearchOnlyHostComponent {}

type CountRow = { id: number; name: string };

/** A toolbar inside a real table, so the item count on the filter row has a count to render. */
@Component({
  imports: [
    BitTableToolbarComponent,
    BitTableV2Component,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
    FilterToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-table-v2 [tableDef]="table">
      <bit-table-toolbar [countLabel]="countLabel()">
        <bit-filter-toggle key="favorites" label="Favorites" icon="bwi-star"></bit-filter-toggle>
      </bit-table-toolbar>
      <bit-column>
        <bit-header-cell>Name</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
      </bit-column>
    </bit-table-v2>
  `,
})
class CountHostComponent {
  readonly rows = signal<CountRow[]>([
    { id: 1, name: "one" },
    { id: 2, name: "two" },
    { id: 3, name: "three" },
  ]);
  protected readonly table = defineTable<CountRow>(this.rows);
  readonly countLabel = signal<((count: number) => string) | undefined>(undefined);
}

describe("BitTableToolbarComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const clearAllButton = () =>
    fixture.nativeElement.querySelector(
      "#bit-table-toolbar_button_clear-all",
    ) as HTMLButtonElement | null;

  // The button stays in the DOM so the overflow list's item set never changes; `tw-hidden`
  // is what hides it. Assert on visibility rather than presence.
  const clearAllVisible = () => {
    const button = clearAllButton();
    return button != null && !button.classList.contains("tw-hidden");
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, SearchOnlyHostComponent, CountHostComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              filters: "Filters",
              clearAll: "Clear all",
              search: "Search",
              resetSearch: "Reset search",
              removeItem: (name?: string) => `Remove ${name}`,
              itemCount: (count?: string) => `${count} items`,
              filterResults: (count?: string) => `${count} results`,
            }),
        },
        { provide: DialogService, useValue: mock<DialogService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("hides the clear-all button when no filter is active", () => {
    expect(clearAllVisible()).toBe(false);
  });

  it("shows the clear-all button once a filter becomes active", () => {
    host.toggle().flip();
    fixture.detectChanges();

    expect(clearAllVisible()).toBe(true);
  });

  it("clears active filter chips but leaves the search term untouched", () => {
    host.toggle().flip();
    host.search().onChange("vault");
    fixture.detectChanges();

    expect(host.toggle().active()).toBe(true);
    expect(host.search().value()).toBe("vault");

    clearAllButton()!.click();
    fixture.detectChanges();

    expect(host.toggle().active()).toBe(false);
    expect(host.search().value()).toBe("vault");
    expect(clearAllVisible()).toBe(false);
  });
  it("tooltips an active filter chip with its full applied label", () => {
    host.toggle().flip();
    fixture.detectChanges();

    const chip = fixture.debugElement.query(By.css("bit-chip"));
    expect(chip).not.toBeNull();
    expect(chip.injector.get(TooltipDirective).tooltipContent()).toBe("Favorites");
  });

  it("leaves the filter row free of element children when no filters are projected", () => {
    const searchOnly = TestBed.createComponent(SearchOnlyHostComponent);
    searchOnly.detectChanges();

    // `empty:tw-hidden` collapses the row, and `:empty` ignores comments but not elements
    // -- so an unconditional child here would leave an empty strip under the search row.
    const filterRow = searchOnly.nativeElement.querySelector("[bitOverflowList]") as HTMLElement;
    expect(filterRow).not.toBeNull();
    expect(filterRow.childElementCount).toBe(0);
  });

  describe("item count", () => {
    let counted: ComponentFixture<CountHostComponent>;

    const countText = () =>
      (
        counted.nativeElement.querySelector("[bitOverflowTrigger]") as HTMLElement | null
      )?.textContent
        ?.replace(/\s+/g, " ")
        .trim();

    beforeEach(() => {
      counted = TestBed.createComponent(CountHostComponent);
      counted.detectChanges();
    });

    afterEach(() => counted.destroy());

    it("counts the rows as items when no label is given", () => {
      expect(countText()).toBe("3 items");
    });

    it("renders a host-supplied label instead", () => {
      counted.componentInstance.countLabel.set((count) => `${count} results`);
      counted.detectChanges();

      expect(countText()).toBe("3 results");
    });

    it("keeps a host-supplied label in step with the row count", () => {
      counted.componentInstance.countLabel.set((count) => `${count} results`);
      counted.componentInstance.rows.update((rows) => rows.slice(0, 2));
      counted.detectChanges();

      expect(countText()).toBe("2 results");
    });
  });
});
