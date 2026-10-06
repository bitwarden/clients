import { ChangeDetectionStrategy, Component, signal, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { MockProxy, mock } from "jest-mock-extended";
import { Observable, Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/state";

import { ChipComponent } from "../../chips";
import { DialogRef, DialogService } from "../../dialog";
import {
  FilterDialogComponent,
  FilterDialogParams,
} from "../../filter-menu/filter-dialog.component";
import { FilterMenuComponent } from "../../filter-menu/filter-menu.component";
import { FilterOptionComponent } from "../../filter-menu/filter-option.component";
import { FilterToggleComponent } from "../../filter-menu/filter-toggle.component";
import { CollapseOnScrollDirective } from "../../layout/collapse-on-scroll.directive";
import { SearchComponent } from "../../search/search.component";
import { TooltipDirective } from "../../tooltip";
import { StorybookStateProvider } from "../../utils";
import { I18nMockService } from "../../utils/i18n-mock.service";

import { BitCellDefDirective } from "./bit-cell-def.directive";
import { BitCellComponent } from "./bit-cell.component";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderCellComponent } from "./bit-header-cell.component";
import { BitTableToolbarComponent } from "./bit-table-toolbar.component";
import {
  CustomizeColumnsDialogComponent,
  CustomizeColumnsDialogParams,
} from "./customize-columns-dialog.component";
import { defineTable } from "./table-def";
import { TableStateKey } from "./table-state-keys";
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

/** A toolbar inside a real table, so the Customize control has a table to ask. */
@Component({
  imports: [
    BitTableToolbarComponent,
    SearchComponent,
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-table-v2 [tableDef]="table" [stateKey]="key()">
      <bit-table-toolbar>
        <bit-search placeholder="Search"></bit-search>
      </bit-table-toolbar>
      <bit-column>
        <bit-header-cell>Name</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
      </bit-column>
      <bit-column label="Other" [removable]="removable()">
        <bit-header-cell>Other</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.other; let row">{{ row.other }}</bit-cell>
      </bit-column>
    </bit-table-v2>
  `,
})
class RemovableHostComponent {
  readonly key = signal<TableStateKey | undefined>("vaultItems");
  readonly removable = signal(true);
  readonly rows = signal([{ name: "one", other: "two" }]);
  readonly table = defineTable<{ name: string; other: string }>(this.rows);
}

describe("BitTableToolbarComponent customize control", () => {
  let fixture: ComponentFixture<RemovableHostComponent>;
  let host: RemovableHostComponent;
  let dialogService: MockProxy<DialogService>;

  beforeEach(async () => {
    dialogService = mock<DialogService>();

    await TestBed.configureTestingModule({
      imports: [RemovableHostComponent],
      providers: [
        { provide: StateProvider, useClass: StorybookStateProvider },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              filters: "Filters",
              clearAll: "Clear all",
              search: "Search",
              resetSearch: "Reset search",
              customize: "Customize",
            }),
        },
        { provide: DialogService, useValue: dialogService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RemovableHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const customizeButton = () =>
    fixture.nativeElement.querySelector(
      "[data-testid='customize-columns']",
    ) as HTMLButtonElement | null;

  // jsdom has no `matchMedia`, so these run at a small-screen width — where the control is
  // still offered. Only `presentation` and `stateKey` decide, never the viewport.
  it("offers the control at any width when the table has a removable column and a key", () => {
    expect(customizeButton()).not.toBeNull();
  });

  it("withholds the control when no column is removable", () => {
    host.removable.set(false);
    fixture.detectChanges();

    expect(customizeButton()).toBeNull();
  });

  it("withholds the control when the table has no stateKey", () => {
    host.key.set(undefined);
    fixture.detectChanges();

    expect(customizeButton()).toBeNull();
  });

  it("opens the dialog with the table's togglable columns", () => {
    customizeButton()!.click();

    const [component, config] = dialogService.open.mock.lastCall!;
    const { columns } = config!.data as CustomizeColumnsDialogParams;
    expect(component).toBe(CustomizeColumnsDialogComponent);
    expect(columns.map((c) => [c.name(), c.label()])).toEqual([["other", "Other"]]);
  });
});

/** A toolbar whose filter dialog is driven from outside, as the browser popup drives it. */
@Component({
  imports: [BitTableToolbarComponent, FilterToggleComponent, SearchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-table-toolbar [(filterDialogOpen)]="open">
      <bit-search placeholder="Search"></bit-search>
      <bit-filter-toggle key="favorites" label="Favorites" icon="bwi-star"></bit-filter-toggle>
      @if (extraFilter()) {
        <bit-filter-toggle key="archive" label="Archive" icon="bwi-archive"></bit-filter-toggle>
      }
    </bit-table-toolbar>
  `,
})
class DialogHostComponent {
  readonly open = signal(false);
  /** Stands in for a chip gated on options that arrive after the dialog is already open. */
  readonly extraFilter = signal(false);
}

describe("BitTableToolbarComponent filter dialog", () => {
  let fixture: ComponentFixture<DialogHostComponent>;
  let host: DialogHostComponent;
  let dialogService: MockProxy<DialogService>;
  let closed: Subject<unknown>;
  let mediaListeners: ((event: MediaQueryListEvent) => void)[];
  /** The starting viewport for any fixture created after it's set. */
  let wide: boolean;

  /** Widen past `md`, so the chip row lays out inline and the collapsed trigger goes away. */
  const widenViewport = () => {
    wide = true;
    mediaListeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
  };

  const trigger = () =>
    fixture.nativeElement.querySelector("button[bitIconButton]") as HTMLButtonElement;

  /** The filters the toolbar handed the dialog, read as the dialog itself reads them. */
  const dialogFilters = () => {
    const config = dialogService.open.mock.calls[0][1] as { data: FilterDialogParams };
    return config.data.filters().map((filter) => filter.key());
  };

  beforeEach(async () => {
    // `isAtOrLargerThanBreakpointSignal` reads `matchMedia`, which JSDOM does not implement.
    // Capture the listener so a test can widen the viewport after the fact.
    mediaListeners = [];
    wide = false;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        get matches() {
          return wide;
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
          mediaListeners.push(listener),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    closed = new Subject<unknown>();
    const ref = mock<DialogRef>();
    // `closed` is declared readonly, and `mock()` auto-stubs it over anything passed in.
    (ref as { closed: Observable<unknown> }).closed = closed.asObservable();
    dialogService = mock<DialogService>();
    dialogService.open.mockReturnValue(ref);

    await TestBed.configureTestingModule({
      imports: [DialogHostComponent],
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
        { provide: DialogService, useValue: dialogService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DialogHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("stays closed until something opens it", () => {
    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it("raises the model when the trigger is clicked", () => {
    trigger().click();
    fixture.detectChanges();

    expect(host.open()).toBe(true);
    expect(dialogService.open).toHaveBeenCalledTimes(1);
  });

  it("opens the dialog when the model is raised from outside", () => {
    // The popup restores this from its view cache on load, with no click involved.
    host.open.set(true);
    fixture.detectChanges();

    expect(dialogService.open).toHaveBeenCalledWith(FilterDialogComponent, expect.anything());
  });

  it("hands the dialog a live view of the projected filters", () => {
    host.open.set(true);
    fixture.detectChanges();

    expect(dialogFilters()).toEqual(["favorites"]);

    // A chip gated on async options registers after the restored dialog is already open.
    host.extraFilter.set(true);
    fixture.detectChanges();

    expect(dialogFilters()).toEqual(["favorites", "archive"]);
  });

  it("lowers the model when the dialog closes", () => {
    host.open.set(true);
    fixture.detectChanges();

    closed.next(undefined);
    fixture.detectChanges();

    expect(host.open()).toBe(false);
  });

  it("closes the dialog when the model is lowered from outside", () => {
    host.open.set(true);
    fixture.detectChanges();

    const ref = dialogService.open.mock.results[0].value as DialogRef;
    host.open.set(false);
    fixture.detectChanges();

    expect(ref.close).toHaveBeenCalled();
  });

  it("opens only once while the model stays raised", () => {
    host.open.set(true);
    fixture.detectChanges();

    // An unrelated signal read by the same effect must not reopen the dialog.
    host.extraFilter.set(true);
    fixture.detectChanges();

    expect(dialogService.open).toHaveBeenCalledTimes(1);
  });

  it("leaves the model raised when the host is destroyed with the dialog open", () => {
    host.open.set(true);
    fixture.detectChanges();

    // `CdkDialog` closes its open dialogs as the app tears down. Mistaking that for the user
    // dismissing the dialog would persist `false` and reinstate the defect.
    fixture.destroy();
    closed.next(undefined);

    expect(host.open()).toBe(true);
  });

  it("keeps the dialog open once the filters are shown inline", () => {
    host.open.set(true);
    fixture.detectChanges();

    const ref = dialogService.open.mock.results[0].value as DialogRef;
    widenViewport();
    fixture.detectChanges();

    // Closing here would drop whatever page the user drilled into, and the focus with it: CDK
    // returns focus to the trigger, which is the element that just went away.
    expect(ref.close).not.toHaveBeenCalled();
  });

  it("drops a model raised while the filters are already inline", async () => {
    widenViewport();
    // The toolbar only knows no trigger is coming once the row is measured, which lands in a
    // `document.fonts.ready` continuation.
    await fixture.whenStable();
    fixture.detectChanges();

    host.open.set(true);
    fixture.detectChanges();

    expect(dialogService.open).not.toHaveBeenCalled();
    expect(host.open()).toBe(false);
  });

  it("holds a raised model until the chip row has been measured", async () => {
    // A fresh fixture, wide from its first frame: the one from `beforeEach` has already measured.
    wide = true;
    const restored = TestBed.createComponent(DialogHostComponent);
    restored.componentInstance.open.set(true);
    restored.detectChanges();

    // Unmeasured, the row reports no overflow and so no trigger. Clearing on that would throw
    // away state the measurement is about to justify.
    expect(restored.componentInstance.open()).toBe(true);
    expect(dialogService.open).not.toHaveBeenCalled();

    await restored.whenStable();
    restored.detectChanges();

    expect(restored.componentInstance.open()).toBe(false);
  });
});
