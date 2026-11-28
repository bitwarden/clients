import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  Type,
  ViewContainerRef,
  WritableSignal,
  signal,
  viewChild,
} from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BerryComponent } from "../berry/berry.component";
import { IconTileComponent } from "../icon-tile";
import { MenuTriggerForDirective } from "../menu/menu-trigger-for.directive";
import { TooltipDirective } from "../tooltip";

import { FilterMenuComponent } from "./filter-menu.component";
import { FilterOptionComponent, FilterOptionNode } from "./filter-option.component";
import { FilterSectionComponent } from "./filter-section.component";
import { FILTER_HOST, FilterHost, FilterOptionRow } from "./filter-tokens";

const mockI18nService = { t: (key: string) => key };

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterOptionComponent],
  template: `
    <bit-filter-menu key="test" placeholderText="Test" multiple>
      <ng-container #anchor></ng-container>
      @for (value of readyValues(); track value) {
        <bit-filter-option [value]="value">{{ value }}</bit-filter-option>
      }
    </bit-filter-menu>
  `,
})
class TestHostComponent {
  readonly anchor = viewChild.required("anchor", { read: ViewContainerRef });
  readonly readyValues = signal<string[]>([]);
}

describe("FilterMenuComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let menu: FilterMenuComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    menu = fixture.debugElement.query(By.directive(FilterMenuComponent)).componentInstance;
  });

  it("skips an option whose required `value` input hasn't bound yet, instead of throwing NG0950", () => {
    // Simulates the real-world race: an option lands in the content-projected DOM (e.g. an
    // async collections list appending a row) a tick before Angular binds its `value` input.
    const optionRef = host.anchor().createComponent(FilterOptionComponent);
    expect(() => optionRef.instance.value()).toThrow(/NG0950/);

    menu.setValue(["abc"]);

    expect(() => fixture.detectChanges()).not.toThrow();

    optionRef.destroy();
  });

  it("picks up a late-added option's selection once its value resolves", () => {
    menu.setValue(["abc"]);
    fixture.detectChanges();
    expect(menu.summary()).toBe("");

    host.readyValues.set(["abc"]);
    fixture.detectChanges();

    expect(menu.isSelected("abc")).toBe(true);
    expect(menu.summary()).toBe("abc");
  });
});

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterOptionComponent],
  template: `
    <bit-filter-menu #multi key="type" placeholderText="Type" multiple>
      <bit-filter-option [value]="'login'">Login</bit-filter-option>
      <bit-filter-option [value]="'card'">Card</bit-filter-option>
    </bit-filter-menu>
    <bit-filter-menu #single key="vault" placeholderText="Vault">
      <bit-filter-option [value]="'mine'">My vault</bit-filter-option>
    </bit-filter-menu>
  `,
})
class SelectionHostComponent {
  readonly multi = viewChild.required<FilterMenuComponent>("multi");
  readonly single = viewChild.required<FilterMenuComponent>("single");
}

describe("FilterMenuComponent selections", () => {
  let fixture: ComponentFixture<SelectionHostComponent>;
  let host: SelectionHostComponent;

  /** The committed count the chip's berry shows; normally only a menu close updates it. */
  const berryValue = (menu: FilterMenuComponent) =>
    fixture.debugElement
      .queryAll(By.directive(BerryComponent))
      .map((el) => el.componentInstance as BerryComponent)
      [menu === host.multi() ? 0 : 1].value();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectionHostComponent],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectionHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("pairs each selected option's label with the value that produced it", () => {
    host.multi().setValue(["login", "card"]);
    fixture.detectChanges();

    expect(host.multi().selections()).toEqual([
      { value: "login", label: "Login" },
      { value: "card", label: "Card" },
    ]);
  });

  it("drops a single selection and leaves the rest", () => {
    host.multi().setValue(["login", "card"]);
    fixture.detectChanges();

    host.multi().deselect("login");
    fixture.detectChanges();

    expect(host.multi().selections()).toEqual([{ value: "card", label: "Card" }]);
    expect(host.multi().isSelected("login")).toBe(false);
    expect(host.multi().active()).toBe(true);
  });

  it("commits the berry on deselect, since nothing closed the menu to do it", () => {
    host.multi().setValue(["login", "card"]);
    fixture.detectChanges();
    expect(berryValue(host.multi())).toBe(2);

    host.multi().deselect("login");
    fixture.detectChanges();

    expect(berryValue(host.multi())).toBe(1);
  });

  it("ignores a value that isn't selected", () => {
    host.multi().setValue(["login"]);
    fixture.detectChanges();

    host.multi().deselect("card");
    fixture.detectChanges();

    expect(host.multi().selections()).toEqual([{ value: "login", label: "Login" }]);
  });

  it("leaves a single-select chip alone — it clears rather than deselects", () => {
    host.single().setValue("mine");
    fixture.detectChanges();

    host.single().deselect("mine");
    fixture.detectChanges();

    expect(host.single().selections()).toEqual([{ value: "mine", label: "My vault" }]);
  });
});

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterOptionComponent, NgTemplateOutlet],
  template: `
    <bit-filter-menu #chip key="type" placeholderText="Type" multiple>
      <bit-filter-option
        [value]="'login'"
        [iconTile]="{ icon: 'bwi-globe', variant: 'teal', emphasis: 'bold' }"
        >Login</bit-filter-option
      >
      <bit-filter-option [value]="'card'">Card</bit-filter-option>
      <bit-filter-option
        [value]="'sshKey'"
        [iconTile]="{ icon: 'bwi-key', variant: 'purple', color: '#175ddc' }"
        disabled
        >SSH key</bit-filter-option
      >
    </bit-filter-menu>
    <!-- Stamps the chip's option rows the way the responsive filter dialog does, so the rows are
         reachable without opening the overlay. -->
    @if (showRows()) {
      <ng-container *ngTemplateOutlet="chip.optionsTemplate()!"></ng-container>
    }
  `,
})
class TileHostComponent {
  readonly showRows = signal(false);
}

describe("FilterMenuComponent icon tiles", () => {
  let fixture: ComponentFixture<TileHostComponent>;

  const tiles = () =>
    fixture.debugElement
      .queryAll(By.directive(IconTileComponent))
      .map((el) => el.componentInstance as IconTileComponent);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TileHostComponent],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(TileHostComponent);
    fixture.detectChanges();

    // The chip's `optionsTemplate` resolves as its own view initializes, so stamp the rows on a
    // second pass.
    fixture.componentInstance.showRows.set(true);
    fixture.detectChanges();
  });

  it("renders a tile only for the options that declare one", () => {
    expect(tiles().map((tile) => tile.icon())).toEqual(["bwi-globe", "bwi-key"]);
  });

  it("renders tiles at xs so every row lines up", () => {
    expect(tiles().map((tile) => tile.size())).toEqual(["xs", "xs"]);
  });

  it("mutes a disabled option's tile to gray, ignoring its variant and custom color", () => {
    const [enabled, disabled] = tiles();

    expect(enabled.variant()).toBe("teal");
    expect(enabled.emphasis()).toBe("bold");
    expect(disabled.variant()).toBe("gray");
    expect(disabled.color()).toBeUndefined();
  });
});

type Row = { value: string; label: string; options?: Row[] };

/**
 * A data-driven tree via `[options]`, the way a consumer builds an arbitrary-depth option tree
 * from data rather than literal markup — see `FilterMenuComponent.options` /
 * `FilterSectionComponent.options`.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterSectionComponent, FilterOptionComponent],
  template: `
    <bit-filter-menu key="test" placeholderText="Test" multiple [options]="grouped ? [] : rows">
      @if (grouped) {
        <bit-filter-section label="Group A" [options]="rows"></bit-filter-section>
      }
    </bit-filter-menu>
  `,
})
class DataDrivenTreeHostComponent {
  grouped = false;
  rows: Row[] = [
    { value: "parent", label: "Parent", options: [{ value: "child", label: "Child" }] },
  ];
}

describe("FilterMenuComponent options built from FilterMenuComponent.options", () => {
  async function setup(grouped: boolean): Promise<{
    fixture: ComponentFixture<DataDrivenTreeHostComponent>;
    menu: FilterMenuComponent;
  }> {
    await TestBed.configureTestingModule({
      imports: [DataDrivenTreeHostComponent],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();
    const fixture = TestBed.createComponent(DataDrivenTreeHostComponent);
    fixture.componentInstance.grouped = grouped;
    fixture.detectChanges();
    const menu = fixture.debugElement.query(By.directive(FilterMenuComponent))
      .componentInstance as FilterMenuComponent;
    return { fixture, menu };
  }

  /** Finds a data-driven row by its value — these are plain objects, never stamped components. */
  function findOption(menu: FilterMenuComponent, value: string): FilterOptionRow {
    const option = (menu["allOptions"]() as FilterOptionRow[]).find((o) => o.value() === value);
    if (!option) {
      throw new Error(`No option found for value ${value}`);
    }
    return option;
  }

  it("selecting the parent selects its whole nested subtree (ungrouped)", async () => {
    const { menu } = await setup(false);

    expect(menu.isSelected("parent")).toBe(false);
    menu["toggleOption"](findOption(menu, "parent"));
    expect(menu.isSelected("parent")).toBe(true);
    expect(menu.isSelected("child")).toBe(true);
  });

  it("keeps the tree nested rather than flattening it, and excludes descendant text from a label", async () => {
    const { menu } = await setup(false);

    expect(menu["entries"]().map((e) => (e as FilterOptionRow).value())).toEqual(["parent"]);
    const parent = findOption(menu, "parent");
    expect(parent.children().map((o) => o.value())).toEqual(["child"]);
    expect(parent.label()).toBe("Parent");
  });

  it("groups the nested option's subtree under its bit-filter-section", async () => {
    const { fixture, menu } = await setup(true);
    const section = fixture.debugElement.query(By.directive(FilterSectionComponent))
      .componentInstance as FilterSectionComponent;

    expect(section.children().map((o) => o.value())).toEqual(["parent"]);
    expect(section.allOptions().map((o) => o.value())).toEqual(["parent", "child"]);

    menu["toggleOption"](findOption(menu, "parent"));
    expect(menu.isSelected("child")).toBe(true);
  });
});

const LONG_SECTION = "An organization name long enough to truncate in the row";
const LONG_PARENT = "A collection name long enough to truncate in the row";
const LONG_CHILD = "A nested collection name long enough to truncate in the row";
const LONG_COLLAPSIBLE_SECTION = "A second organization name long enough to truncate in the row";

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterOptionComponent, FilterSectionComponent, NgTemplateOutlet],
  template: `
    <bit-filter-menu #chip key="collection" placeholderText="Shared folders" multiple>
      <bit-filter-section [label]="sectionLabel">
        <bit-filter-option [value]="'parent'" expanded
          >{{ parentLabel }}
          <bit-filter-option [value]="'child'">{{ childLabel }}</bit-filter-option>
        </bit-filter-option>
      </bit-filter-section>
    </bit-filter-menu>
    @if (showRows()) {
      <ng-container *ngTemplateOutlet="chip.optionsTemplate()!"></ng-container>
    }
  `,
})
class TreeTooltipHostComponent {
  readonly sectionLabel = LONG_SECTION;
  readonly parentLabel = LONG_PARENT;
  readonly childLabel = LONG_CHILD;
  readonly showRows = signal(false);
}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterOptionComponent, FilterSectionComponent, NgTemplateOutlet],
  template: `
    <bit-filter-menu #chip key="folder" placeholderText="My folders">
      <bit-filter-option [value]="'folder'">{{ optionLabel }}</bit-filter-option>
      <!-- Both header kinds: a plain one renders a static header, a collapsible one a button. -->
      <bit-filter-section [label]="sectionLabel">
        <bit-filter-option [value]="'nested'">{{ childLabel }}</bit-filter-option>
      </bit-filter-section>
      <bit-filter-section [label]="collapsibleSectionLabel" collapsible>
        <bit-filter-option [value]="'collapsible-nested'">{{ childLabel }}</bit-filter-option>
      </bit-filter-section>
    </bit-filter-menu>
    @if (showRows()) {
      <ng-container *ngTemplateOutlet="chip.optionsTemplate()!"></ng-container>
    }
  `,
})
class FlatTooltipHostComponent {
  readonly optionLabel = LONG_PARENT;
  readonly sectionLabel = LONG_SECTION;
  readonly collapsibleSectionLabel = LONG_COLLAPSIBLE_SECTION;
  readonly childLabel = LONG_CHILD;
  readonly showRows = signal(false);
}

/**
 * Every row truncates its label, so each one carries a tooltip with the full text — the
 * regression this covers is a row that truncates with nothing on hover. The chip trigger is the
 * exception: it carries no label tooltip, only a `disabledTooltip`.
 */
describe("FilterMenuComponent row tooltips", () => {
  const setUp = async <T extends { showRows: WritableSignal<boolean> }>(
    hostType: Type<T>,
  ): Promise<ComponentFixture<T>> => {
    await TestBed.configureTestingModule({
      imports: [hostType],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(hostType);
    fixture.detectChanges();

    // The chip's `optionsTemplate` resolves as its own view initializes, so stamp the rows on a
    // second pass — the same two-step the icon tile specs use.
    fixture.componentInstance.showRows.set(true);
    fixture.detectChanges();

    return fixture;
  };

  /**
   * Each tooltipped row, paired with the text it renders, in row order. Scoped to the stamped
   * rows, which sit outside the chip — the trigger has a tooltip directive but no label content
   * for it.
   */
  const tooltips = (fixture: ComponentFixture<unknown>) => {
    const chip = fixture.debugElement.query(By.directive(FilterMenuComponent))
      .nativeElement as HTMLElement;

    return fixture.debugElement
      .queryAll(By.directive(TooltipDirective))
      .filter((row) => !chip.contains(row.nativeElement as HTMLElement))
      .map((row) => ({
        tooltip: (row.injector.get(TooltipDirective) as TooltipDirective).tooltipContent(),
        text: (row.nativeElement as HTMLElement).textContent?.replace(/\s+/g, " ").trim(),
      }));
  };

  it("tooltips each multi-select tree row, sections and nested options included", async () => {
    const fixture = await setUp(TreeTooltipHostComponent);

    expect(tooltips(fixture).map((row) => row.tooltip)).toEqual([
      LONG_SECTION,
      LONG_PARENT,
      LONG_CHILD,
    ]);
  });

  it("tooltips each single-select row, section headers and the injected unset row included", async () => {
    const fixture = await setUp(FlatTooltipHostComponent);

    // `mockI18nService` echoes the key, so the unset row's label is "all".
    expect(tooltips(fixture).map((row) => row.tooltip)).toEqual([
      "all",
      LONG_PARENT,
      LONG_SECTION,
      LONG_CHILD,
      LONG_COLLAPSIBLE_SECTION,
      LONG_CHILD,
    ]);
  });

  it("opens a tree row's label tooltip on keyboard focus and closes it on blur", async () => {
    const fixture = await setUp(TreeTooltipHostComponent);
    const rowEl = fixture.debugElement.query(By.css('[role="treeitem"]'));
    const tooltip = rowEl.query(By.directive(TooltipDirective)).injector.get(TooltipDirective);
    const show = jest.spyOn(tooltip, "showTooltip");
    const hide = jest.spyOn(tooltip, "hideTooltip");
    const row = rowEl.nativeElement as HTMLElement;

    // Mouse focus isn't `:focus-visible`, so it leaves the tooltip closed.
    row.dispatchEvent(new FocusEvent("focus"));
    expect(show).not.toHaveBeenCalled();

    jest.spyOn(row, "matches").mockImplementation((selector) => selector === ":focus-visible");
    row.dispatchEvent(new FocusEvent("focus"));
    expect(show).toHaveBeenCalled();

    row.dispatchEvent(new FocusEvent("blur"));
    expect(hide).toHaveBeenCalled();
  });

  it("tooltips a row with the full label it truncates, not some other row's", async () => {
    const fixture = await setUp(TreeTooltipHostComponent);

    for (const row of tooltips(fixture)) {
      expect(row.text).toContain(row.tooltip);
    }
  });
});

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterOptionComponent],
  template: `
    <bit-filter-menu key="collection" placeholderText="Shared folders" multiple disabled>
      <bit-filter-option [value]="'parent'">Parent</bit-filter-option>
    </bit-filter-menu>
  `,
})
class DisabledHostComponent {}

/**
 * A disabled chip is `aria-disabled`, not `disabled`, so it stays focusable and a
 * `disabledTooltip` can still reach a keyboard user. `MenuTriggerForDirective` is what keeps it
 * from opening, not the missing attribute.
 */
describe("FilterMenuComponent disabled trigger", () => {
  let fixture: ComponentFixture<DisabledHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisabledHostComponent],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DisabledHostComponent);
    fixture.detectChanges();
  });

  const trigger = () =>
    fixture.debugElement.query(By.directive(MenuTriggerForDirective))
      .nativeElement as HTMLButtonElement;

  it("marks the trigger `aria-disabled` and leaves it focusable", () => {
    expect(trigger().getAttribute("aria-disabled")).toBe("true");
    expect(trigger().hasAttribute("disabled")).toBe(false);
    expect(trigger().disabled).toBe(false);
  });

  it("leaves the trigger untooltipped when disabled with no reason supplied", () => {
    const tooltip = fixture.debugElement
      .query(By.directive(MenuTriggerForDirective))
      .injector.get(TooltipDirective);

    expect(tooltip.tooltipContent()).toBe("");
  });

  it("does not open the menu when the disabled trigger is clicked", () => {
    const menuTrigger = fixture.debugElement
      .query(By.directive(MenuTriggerForDirective))
      .injector.get(MenuTriggerForDirective);

    trigger().click();
    fixture.detectChanges();

    expect(menuTrigger.isOpen()).toBe(false);
  });
});

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterOptionComponent],
  template: `
    <bit-filter-menu
      key="collection"
      placeholderText="Shared folders"
      multiple
      [disabled]="off()"
      [disabledTooltip]="reason()"
    >
      <bit-filter-option [value]="'parent'">Parent</bit-filter-option>
    </bit-filter-menu>
  `,
})
class DisabledReasonHostComponent {
  readonly reason = signal("No shared folders to show");
  readonly off = signal(true);
}

/**
 * `disabledTooltip` is the reason a chip is disabled — something the label can't convey. It is the
 * chip's only tooltip, and it rides the trigger's `aria-describedby` so assistive tech hears it.
 */
describe("FilterMenuComponent disabledTooltip", () => {
  let fixture: ComponentFixture<DisabledReasonHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisabledReasonHostComponent],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DisabledReasonHostComponent);
    fixture.detectChanges();
  });

  const triggerEl = () =>
    fixture.debugElement.query(By.directive(MenuTriggerForDirective))
      .nativeElement as HTMLButtonElement;

  const tooltip = () =>
    fixture.debugElement
      .query(By.directive(MenuTriggerForDirective))
      .injector.get(TooltipDirective);

  it("tooltips the trigger with the reason while disabled", () => {
    expect(tooltip().tooltipContent()).toBe("No shared folders to show");
  });

  it("describes the trigger with the reason, so a keyboard user hears why", () => {
    const id = triggerEl().getAttribute("aria-describedby");
    expect(id).toBeTruthy();

    // The description node is the tooltip itself, which the directive attaches on hover or focus.
    triggerEl().dispatchEvent(new MouseEvent("mouseenter"));
    fixture.detectChanges();

    expect(document.getElementById(id!)?.textContent?.trim()).toBe("No shared folders to show");
  });

  it("gives the disabled trigger pointer events back so the reason is hoverable", () => {
    expect(triggerEl().classList).toContain("tw-pointer-events-auto");
  });

  it("drops the tooltip, and describes nothing, once enabled", () => {
    fixture.componentInstance.off.set(false);
    fixture.detectChanges();

    expect(tooltip().tooltipContent()).toBe("");
    // The label is already the trigger's accessible name; repeating it as a description is noise.
    expect(triggerEl().hasAttribute("aria-describedby")).toBe(false);
    expect(triggerEl().classList).not.toContain("tw-pointer-events-auto");
  });

  it("drops the tooltip when disabled with no reason supplied", () => {
    fixture.componentInstance.reason.set("");
    fixture.detectChanges();

    expect(tooltip().tooltipContent()).toBe("");
    expect(triggerEl().hasAttribute("aria-describedby")).toBe(false);
  });
});

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterOptionComponent],
  template: `
    <bit-filter-menu #single key="type" placeholderText="Type">
      <bit-filter-option value="login">Login</bit-filter-option>
      <bit-filter-option value="card">Card</bit-filter-option>
    </bit-filter-menu>
    <bit-filter-menu #multi key="vault" placeholderText="Vault" multiple>
      <bit-filter-option value="org-1">Org 1</bit-filter-option>
      <bit-filter-option value="org-2">Org 2</bit-filter-option>
    </bit-filter-menu>
  `,
})
class CountedHostComponent {
  readonly single = viewChild.required<FilterMenuComponent>("single");
  readonly multi = viewChild.required<FilterMenuComponent>("multi");
}

describe("FilterMenuComponent host counts", () => {
  const filterHost = mock<FilterHost>();
  let fixture: ComponentFixture<CountedHostComponent>;

  beforeEach(async () => {
    filterHost.optionCounts.mockImplementation((_key, values) =>
      values.map((_, index) => 10 + index),
    );
    await TestBed.configureTestingModule({
      imports: [CountedHostComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: FILTER_HOST, useValue: filterHost },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CountedHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => jest.clearAllMocks());

  it("asks for the All row's count ahead of the options on a single-select chip", () => {
    const menu = fixture.componentInstance.single();

    expect(menu["unsetCount"]()).toBe(10);
    expect([...menu["optionCounts"]().values()]).toEqual([11, 12]);
    expect(filterHost.optionCounts).toHaveBeenCalledWith("type", [null, "login", "card"]);
  });

  it("does not ask for an All row count on a multi-select chip, which has no All row", () => {
    const menu = fixture.componentInstance.multi();

    expect(menu["unsetCount"]()).toBeUndefined();
    expect([...menu["optionCounts"]().values()]).toEqual([10, 11]);
    expect(filterHost.optionCounts).toHaveBeenCalledWith("vault", [["org-1"], ["org-2"]]);
  });
});

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterOptionComponent, NgTemplateOutlet],
  template: `
    <bit-filter-menu #chip key="letters" placeholderText="Letters" multiple>
      <bit-filter-option [value]="'alpha'" disabled>Alpha</bit-filter-option>
      <bit-filter-option [value]="'beta'"
        >Beta
        <bit-filter-option [value]="'beta-one'">Beta one</bit-filter-option>
        <bit-filter-option [value]="'beta-two'">Beta two</bit-filter-option>
      </bit-filter-option>
      <bit-filter-option [value]="'gamma'"
        >Gamma
        <bit-filter-option [value]="'gamma-one'">Gamma one</bit-filter-option>
      </bit-filter-option>
      <bit-filter-option [value]="'delta'">Delta</bit-filter-option>
    </bit-filter-menu>
    @if (showRows()) {
      <ng-container *ngTemplateOutlet="chip.optionsTemplate()!"></ng-container>
    }
  `,
})
class TreeKeyboardHostComponent {
  readonly showRows = signal(false);
}

const letterOptions = (): FilterOptionNode<string>[] =>
  ["Alpha", "Beta", "Gamma", "Delta"].map((label) => ({ value: label.toLowerCase(), label }));

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, NgTemplateOutlet],
  template: `
    <bit-filter-menu
      #chip
      key="letters"
      placeholderText="Letters"
      multiple
      [options]="options()"
    ></bit-filter-menu>
    @if (showRows()) {
      <ng-container *ngTemplateOutlet="chip.optionsTemplate()!"></ng-container>
    }
  `,
})
class TreeKeyboardDataHostComponent {
  readonly options = signal(letterOptions());
  readonly showRows = signal(false);
}

describe("FilterMenuComponent tree keyboard navigation", () => {
  let fixture: ComponentFixture<{ showRows: WritableSignal<boolean> }>;

  const chip = () =>
    fixture.debugElement.query(By.directive(FilterMenuComponent))
      .componentInstance as FilterMenuComponent;

  const rows = () =>
    fixture.debugElement
      .queryAll(By.css('[role="treeitem"]'))
      .map((row) => row.nativeElement as HTMLElement);

  const label = (row: Element | null) =>
    row?.querySelector("[data-filter-row-label]")?.textContent?.trim();

  const labels = () => rows().map(label);

  const row = (text: string) => rows().find((el) => label(el) === text)!;

  const focused = () => label(document.activeElement);

  const tabStops = () =>
    rows()
      .filter((el) => el.tabIndex === 0)
      .map(label);

  /** Sends a key to the focused row, returning whether the tree claimed it. */
  const press = (key: string): boolean => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(event);
    fixture.detectChanges();
    return event.defaultPrevented;
  };

  const focus = (text: string) => {
    row(text).focus();
    fixture.detectChanges();
  };

  const render = <T extends { showRows: WritableSignal<boolean> }>(hostType: Type<T>) => {
    const created = TestBed.createComponent(hostType);
    fixture = created;
    fixture.detectChanges();
    fixture.componentInstance.showRows.set(true);
    fixture.detectChanges();
    return created;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeKeyboardHostComponent],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    render(TreeKeyboardHostComponent);
  });

  it("starts with the tab stop on the first enabled row", () => {
    expect(labels()).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
    expect(tabStops()).toEqual(["Beta"]);
  });

  it("moves one row at a time with the arrow keys and stops at either end", () => {
    focus("Gamma");

    press("ArrowDown");
    expect(focused()).toBe("Delta");
    press("ArrowDown");
    expect(focused()).toBe("Delta");

    press("ArrowUp");
    press("ArrowUp");
    expect(focused()).toBe("Beta");
  });

  it("lets the arrow keys reach a disabled row, so its label can still be read", () => {
    focus("Beta");

    press("ArrowUp");
    expect(focused()).toBe("Alpha");
    press("ArrowUp");
    expect(focused()).toBe("Alpha");
  });

  it("jumps to the first and last row with Home and End", () => {
    focus("Beta");

    press("End");
    expect(focused()).toBe("Delta");

    press("Home");
    expect(focused()).toBe("Alpha");
  });

  it("keeps a single tab stop, on whichever row last had focus", () => {
    focus("Beta");
    press("ArrowDown");

    expect(tabStops()).toEqual(["Gamma"]);
  });

  it("opens a closed parent with ArrowRight, then steps into its first child", () => {
    focus("Beta");

    press("ArrowRight");
    expect(labels()).toEqual(["Alpha", "Beta", "Beta one", "Beta two", "Gamma", "Delta"]);
    expect(focused()).toBe("Beta");

    press("ArrowRight");
    expect(focused()).toBe("Beta one");
  });

  it("steps out to the parent with ArrowLeft, then closes it", () => {
    focus("Beta");
    press("ArrowRight");
    focus("Beta two");

    press("ArrowLeft");
    expect(focused()).toBe("Beta");

    press("ArrowLeft");
    expect(labels()).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
    expect(focused()).toBe("Beta");
  });

  it("leaves a top-level row with nothing to open where it is", () => {
    focus("Delta");

    press("ArrowLeft");
    expect(focused()).toBe("Delta");
    press("ArrowRight");
    expect(focused()).toBe("Delta");
    expect(labels()).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
  });

  it("opens every parent at the focused row's level with *", () => {
    focus("Delta");

    press("*");
    // Focus follows the option on the render after its position changes.
    fixture.detectChanges();

    expect(labels()).toEqual([
      "Alpha",
      "Beta",
      "Beta one",
      "Beta two",
      "Gamma",
      "Gamma one",
      "Delta",
    ]);
    expect(focused()).toBe("Delta");
  });

  it("toggles the focused option with Enter and with Space", () => {
    focus("Delta");

    press("Enter");
    expect(chip().value()).toEqual(["delta"]);

    press(" ");
    expect(chip().value()).toEqual([]);
  });

  it("does not toggle a disabled option", () => {
    focus("Alpha");

    press("Enter");
    press(" ");

    expect(chip().value()).toBeUndefined();
  });

  it("claims the keys it handles and leaves the rest to the browser", () => {
    focus("Beta");

    expect(press("ArrowDown")).toBe(true);
    expect(press("Home")).toBe(true);
    expect(press("Tab")).toBe(false);
    expect(press("a")).toBe(false);
  });

  it("keeps its place when a consumer rebuilds the options while a row has focus", () => {
    const data = render(TreeKeyboardDataHostComponent);
    focus("Gamma");

    data.componentInstance.options.set(letterOptions());
    fixture.detectChanges();
    fixture.detectChanges();

    expect(tabStops()).toEqual(["Gamma"]);
    expect(focused()).toBe("Gamma");
    press("ArrowDown");
    expect(focused()).toBe("Delta");
  });

  it("goes straight from a leaf to its parent with ArrowLeft, even after ArrowRight on the leaf", () => {
    focus("Beta");
    press("ArrowRight");
    focus("Beta one");

    press("ArrowRight");
    press("ArrowLeft");

    expect(focused()).toBe("Beta");
  });
});

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterOptionComponent, FilterSectionComponent, NgTemplateOutlet],
  template: `
    <bit-filter-menu #chip key="fruit" placeholderText="Fruit" multiple>
      <bit-filter-option [value]="'apple'">Apple</bit-filter-option>
      <bit-filter-section label="Stone fruit">
        <bit-filter-option [value]="'peach'"
          >Peach
          <bit-filter-option [value]="'white-peach'">White peach</bit-filter-option>
          <bit-filter-option [value]="'nectarine'">Nectarine</bit-filter-option>
        </bit-filter-option>
        <bit-filter-option [value]="'plum'">Plum</bit-filter-option>
      </bit-filter-section>
      <bit-filter-section label="Citrus">
        <bit-filter-option [value]="'lime'">Lime</bit-filter-option>
      </bit-filter-section>
    </bit-filter-menu>
    @if (showRows()) {
      <ng-container *ngTemplateOutlet="chip.optionsTemplate()!"></ng-container>
    }
  `,
})
class SearchHostComponent {
  readonly showRows = signal(false);
}

describe("FilterMenuComponent search", () => {
  let fixture: ComponentFixture<SearchHostComponent>;
  let chip: FilterMenuComponent;

  const labels = () =>
    fixture.debugElement
      .queryAll(By.css('[role="treeitem"] [data-filter-row-label]'))
      .map((label) => (label.nativeElement as HTMLElement).textContent?.trim());

  const search = (term: string) => {
    chip.setSearchTerm(term);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchHostComponent],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchHostComponent);
    fixture.detectChanges();
    fixture.componentInstance.showRows.set(true);
    fixture.detectChanges();
    chip = fixture.debugElement.query(By.directive(FilterMenuComponent)).componentInstance;
  });

  it("shows every row, with nested options closed, while nothing is searched", () => {
    expect(labels()).toEqual(["Apple", "Stone fruit", "Peach", "Plum", "Citrus", "Lime"]);
    expect(chip["resultCount"]()).toBeUndefined();
    expect(chip["noResults"]()).toBe(false);
  });

  it("keeps a match's parent and section, opened, and hides everything else", () => {
    search("nect");

    expect(labels()).toEqual(["Stone fruit", "Peach", "Nectarine"]);
  });

  it("hides a matching parent's children that don't match themselves", () => {
    search("peach");

    expect(labels()).toEqual(["Stone fruit", "Peach", "White peach"]);
  });

  it("counts the options left showing, a kept parent included", () => {
    search("nect");
    expect(chip["resultCount"]()).toBe(2);

    search("lime");
    expect(chip["resultCount"]()).toBe(1);
  });

  it("ignores case and surrounding space", () => {
    search("  LIME ");

    expect(labels()).toEqual(["Citrus", "Lime"]);
  });

  it("does not match a section by its own label", () => {
    search("stone");

    expect(labels()).toEqual([]);
    expect(chip["noResults"]()).toBe(true);
    expect(chip["resultCount"]()).toBeUndefined();
  });

  it("restores the list as it was once the term is cleared", () => {
    search("nect");
    search("");

    expect(labels()).toEqual(["Apple", "Stone fruit", "Peach", "Plum", "Citrus", "Lime"]);
  });
});

describe("FilterMenuComponent checked state", () => {
  let fixture: ComponentFixture<SearchHostComponent>;
  let chip: FilterMenuComponent;

  const row = (text: string) =>
    fixture.debugElement
      .queryAll(By.css('[role="treeitem"]'))
      .map((el) => el.nativeElement as HTMLElement)
      .find((el) => el.querySelector("[data-filter-row-label]")?.textContent?.trim() === text)!;

  const checked = (text: string) => row(text).getAttribute("aria-checked");

  const select = (values: string[]) => {
    chip.setValue(values);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchHostComponent],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchHostComponent);
    fixture.detectChanges();
    fixture.componentInstance.showRows.set(true);
    fixture.detectChanges();
    chip = fixture.debugElement.query(By.directive(FilterMenuComponent)).componentInstance;
  });

  it("starts every option unchecked, and gives a section header no checked state", () => {
    expect(checked("Apple")).toBe("false");
    expect(checked("Peach")).toBe("false");
    expect(checked("Stone fruit")).toBeNull();
  });

  it("checks a parent only when it and everything beneath it are selected", () => {
    select(["peach", "white-peach", "nectarine"]);

    expect(checked("Peach")).toBe("true");
  });

  it("marks a parent mixed when only part of its subtree is selected", () => {
    select(["white-peach"]);
    expect(checked("Peach")).toBe("mixed");

    // Its children alone aren't the whole subtree: the parent's own value is part of it.
    select(["white-peach", "nectarine"]);
    expect(checked("Peach")).toBe("mixed");
  });

  it("selects a mixed parent's whole subtree on click, leaving other selections alone", () => {
    select(["apple", "white-peach"]);

    row("Peach").click();
    fixture.detectChanges();

    expect(chip.value()).toEqual(["apple", "white-peach", "peach", "nectarine"]);
    expect(checked("Peach")).toBe("true");
  });

  it("clears a checked parent's whole subtree on click, leaving other selections alone", () => {
    select(["apple", "peach", "white-peach", "nectarine"]);

    row("Peach").click();
    fixture.detectChanges();

    expect(chip.value()).toEqual(["apple"]);
    expect(checked("Peach")).toBe("false");
  });

  it("counts a section's selected options, nested ones included", () => {
    const [stoneFruit, citrus] = fixture.debugElement
      .queryAll(By.directive(FilterSectionComponent))
      .map((el) => el.componentInstance as FilterSectionComponent);

    select(["white-peach", "plum", "apple"]);

    expect(chip.sectionSelectedCount(stoneFruit)).toBe(2);
    expect(chip.sectionSelectedCount(citrus)).toBe(0);
  });
});

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterOptionComponent, FilterSectionComponent, NgTemplateOutlet],
  template: `
    <bit-filter-menu #chip key="fruit" placeholderText="Fruit" [multiple]="multiple()">
      <bit-filter-option [value]="'apple'">Apple</bit-filter-option>
      <bit-filter-section label="Still loading">
        @for (name of loaded(); track name) {
          <bit-filter-option [value]="name">{{ name }}</bit-filter-option>
        }
      </bit-filter-section>
    </bit-filter-menu>
    @if (showRows()) {
      <ng-container *ngTemplateOutlet="chip.optionsTemplate()!"></ng-container>
    }
  `,
})
class EmptySectionHostComponent {
  readonly multiple = signal(true);
  readonly loaded = signal<string[]>([]);
  readonly showRows = signal(false);
}

describe("FilterMenuComponent empty sections", () => {
  let fixture: ComponentFixture<EmptySectionHostComponent>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent;

  const render = async (multiple: boolean) => {
    await TestBed.configureTestingModule({
      imports: [EmptySectionHostComponent],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptySectionHostComponent);
    fixture.componentInstance.multiple.set(multiple);
    fixture.detectChanges();
    fixture.componentInstance.showRows.set(true);
    fixture.detectChanges();
  };

  it.each([
    ["multi-select", true],
    ["single-select", false],
  ])(
    "hides a section with no options on a %s chip, with no search running",
    async (_, multiple) => {
      await render(multiple);

      expect(text()).toContain("Apple");
      expect(text()).not.toContain("Still loading");
    },
  );

  it("shows the section once it has an option", async () => {
    await render(true);

    fixture.componentInstance.loaded.set(["Pear"]);
    fixture.detectChanges();

    expect(text()).toContain("Still loading");
    expect(text()).toContain("Pear");
  });
});
