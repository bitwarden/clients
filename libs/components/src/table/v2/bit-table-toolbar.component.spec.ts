import { ChangeDetectionStrategy, Component, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ChipComponent } from "../../chips";
import { DialogService } from "../../dialog";
import { FilterMenuComponent } from "../../filter-menu/filter-menu.component";
import { FilterOptionComponent } from "../../filter-menu/filter-option.component";
import { FilterToggleComponent } from "../../filter-menu/filter-toggle.component";
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
      imports: [HostComponent, SearchOnlyHostComponent],
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
});

/**
 * A collapsed toolbar's filter row with both kinds of chip: a multi-select that draws one
 * chip per selected option, and a single-select that draws one chip.
 */
@Component({
  imports: [BitTableToolbarComponent, FilterMenuComponent, FilterOptionComponent, SearchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-table-toolbar>
      <bit-search placeholder="Search"></bit-search>
      <bit-filter-menu #type key="type" placeholderText="Type" icon="bwi-list" multiple>
        <bit-filter-option [value]="'login'">Login</bit-filter-option>
        <bit-filter-option [value]="'card'">Card</bit-filter-option>
      </bit-filter-menu>
      <bit-filter-menu #vault key="vault" placeholderText="Vault">
        <bit-filter-option [value]="'mine'">My vault</bit-filter-option>
      </bit-filter-menu>
    </bit-table-toolbar>
  `,
})
class FilterMenuHostComponent {
  readonly type = viewChild.required<FilterMenuComponent>("type");
  readonly vault = viewChild.required<FilterMenuComponent>("vault");
}

describe("BitTableToolbarComponent active filter chips", () => {
  let fixture: ComponentFixture<FilterMenuHostComponent>;
  let host: FilterMenuHostComponent;

  const chips = () =>
    fixture.debugElement
      .queryAll(By.directive(ChipComponent))
      .map((el) => el.componentInstance as ChipComponent);

  const chipLabels = () => chips().map((chip) => chip.label());

  // Scoped to `bit-chip`: every `bit-filter-menu` has its own dismiss button on the hidden
  // wide-viewport row, and that one clears the whole filter.
  const dismissButtons = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        "bit-chip button[bit-chip-dismiss-button]",
      ) as NodeListOf<HTMLButtonElement>,
    );

  const dismissLabels = () => dismissButtons().map((button) => button.getAttribute("aria-label"));

  const dismiss = (index: number) => dismissButtons()[index].click();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterMenuHostComponent],
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
              // The menu's footer is projected content, so it renders with the chip even
              // though the popover is closed.
              clear: "Clear",
              filtersSelected: (count?: string) => `${count} selected`,
            }),
        },
        { provide: DialogService, useValue: mock<DialogService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterMenuHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("draws a chip per selected option for a multi-select", () => {
    host.type().setValue(["login", "card"]);
    fixture.detectChanges();

    expect(chipLabels()).toEqual(["Login", "Card"]);
  });

  it("leads each chip with the filter's icon", () => {
    host.type().setValue(["login"]);
    fixture.detectChanges();

    expect(chips()[0].startIcon()).toBe("bwi-list");
  });

  it("names each chip's dismiss button with the filter and the option", () => {
    host.type().setValue(["login", "card"]);
    fixture.detectChanges();

    // The chips show only the option name, and the dismiss button is the only focusable node
    // in them, so its name is what identifies the filter to a screen reader.
    expect(dismissLabels()).toEqual(["Remove Type: Login", "Remove Type: Card"]);
  });

  it("spells the filter out in each chip's tooltip", () => {
    host.type().setValue(["login"]);
    fixture.detectChanges();

    const chip = fixture.debugElement.query(By.directive(ChipComponent));
    expect(chip.injector.get(TooltipDirective).tooltipContent()).toBe("Type: Login");
  });

  it("drops only the dismissed option, leaving the filter's other chips", () => {
    host.type().setValue(["login", "card"]);
    fixture.detectChanges();

    dismiss(0);
    fixture.detectChanges();

    expect(chipLabels()).toEqual(["Card"]);
    expect(host.type().isSelected("login")).toBe(false);
    expect(host.type().active()).toBe(true);
  });

  it("keeps one qualified chip for a single-select, cleared as a whole", () => {
    host.vault().setValue("mine");
    fixture.detectChanges();

    expect(chipLabels()).toEqual(["Vault: My vault"]);
    expect(dismissLabels()).toEqual(["Remove Vault: My vault"]);

    dismiss(0);
    fixture.detectChanges();

    expect(chipLabels()).toEqual([]);
    expect(host.vault().active()).toBe(false);
  });
});
