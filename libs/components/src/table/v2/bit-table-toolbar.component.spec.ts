import { ChangeDetectionStrategy, Component, signal, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DialogService } from "../../dialog";
import { FilterToggleComponent } from "../../filter-menu/filter-toggle.component";
import { CollapseOnScrollDirective } from "../../layout/collapse-on-scroll.directive";
import { SearchComponent } from "../../search/search.component";
import { TooltipDirective } from "../../tooltip";
import { I18nMockService } from "../../utils/i18n-mock.service";

import { BitTableToolbarComponent } from "./bit-table-toolbar.component";

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

/** A toolbar carrying `bitCollapseOnScroll`, whose enabled state decides who draws the divider. */
@Component({
  imports: [BitTableToolbarComponent, CollapseOnScrollDirective, SearchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-table-toolbar [bitCollapseOnScroll]="collapse()">
      <bit-search placeholder="Search"></bit-search>
    </bit-table-toolbar>
  `,
})
class CollapsingHostComponent {
  readonly collapse = signal(true);
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
      imports: [HostComponent, SearchOnlyHostComponent, CollapsingHostComponent],
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

  describe("with bitCollapseOnScroll", () => {
    let collapsing: ComponentFixture<CollapsingHostComponent>;

    const toolbar = () =>
      collapsing.nativeElement.querySelector("bit-table-toolbar") as HTMLElement;

    beforeEach(() => {
      collapsing = TestBed.createComponent(CollapsingHostComponent);
      collapsing.detectChanges();
    });

    it("leaves the divider to the directive while it is enabled", () => {
      // The directive draws the page's seam on this same host, and two `border-color` utilities
      // there would resolve by stylesheet order rather than by either one's intent.
      expect(toolbar().className).not.toContain("tw-border-border-base");
    });

    it("keeps its own divider when the directive is opted out", () => {
      collapsing.componentInstance.collapse.set(false);
      collapsing.detectChanges();

      expect(toolbar().className).toContain("tw-border-b");
    });
  });
});
