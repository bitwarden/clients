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

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconTileComponent } from "../icon-tile";
import { MenuTriggerForDirective } from "../menu/menu-trigger-for.directive";
import { TooltipDirective } from "../tooltip";

import { FilterMenuComponent } from "./filter-menu.component";
import { FilterOptionComponent } from "./filter-option.component";
import { FilterSectionComponent } from "./filter-section.component";
import { FilterOptionRow } from "./filter-tokens";

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
 * regression this covers is a row that truncates with nothing on hover. The chip trigger
 * truncates too, so it carries one as well.
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

  /** Each tooltipped element, paired with the text it renders, in row order. */
  const tooltips = (fixture: ComponentFixture<unknown>) =>
    fixture.debugElement.queryAll(By.directive(TooltipDirective)).map((row) => ({
      tooltip: (row.injector.get(TooltipDirective) as TooltipDirective).tooltipContent(),
      text: (row.nativeElement as HTMLElement).textContent?.replace(/\s+/g, " ").trim(),
    }));

  it("tooltips each multi-select tree row, sections and nested options included", async () => {
    const fixture = await setUp(TreeTooltipHostComponent);

    // The chip trigger leads: it precedes the stamped rows in the host's DOM order.
    expect(tooltips(fixture).map((row) => row.tooltip)).toEqual([
      "Shared folders",
      LONG_SECTION,
      LONG_PARENT,
      LONG_CHILD,
    ]);
  });

  it("tooltips each single-select row, section headers and the injected unset row included", async () => {
    const fixture = await setUp(FlatTooltipHostComponent);

    // `mockI18nService` echoes the key, so the unset row's label is "all".
    expect(tooltips(fixture).map((row) => row.tooltip)).toEqual([
      "My folders",
      "all",
      LONG_PARENT,
      LONG_SECTION,
      LONG_CHILD,
      LONG_COLLAPSIBLE_SECTION,
      LONG_CHILD,
    ]);
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
 * A disabled chip is `aria-disabled`, not `disabled`, so it stays focusable and its tooltip can
 * still read out a truncated label. The regression that buys is a disabled chip whose full label
 * is unreachable by keyboard.
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

  it("keeps the trigger's tooltip so the label stays reachable while disabled", () => {
    const tooltip = fixture.debugElement
      .query(By.directive(MenuTriggerForDirective))
      .injector.get(TooltipDirective);

    expect(tooltip.tooltipContent()).toBe("Shared folders");
  });

  it("does not open the menu when the disabled trigger is clicked", () => {
    const menuTrigger = fixture.debugElement
      .query(By.directive(MenuTriggerForDirective))
      .injector.get(MenuTriggerForDirective);

    trigger().click();
    fixture.detectChanges();

    expect(menuTrigger.isOpen).toBe(false);
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
 * `disabledTooltip` is the reason a chip is disabled — something the label can't convey, so unlike
 * the label it has to reach assistive tech. It rides the trigger's `aria-describedby`, which is
 * why it is the one tooltip on this component that opts into `addTooltipToDescribedby`.
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

  it("shows the reason in place of the label while disabled", () => {
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

  it("falls back to the label, and describes nothing, once enabled", () => {
    fixture.componentInstance.off.set(false);
    fixture.detectChanges();

    expect(tooltip().tooltipContent()).toBe("Shared folders");
    // The label is already the trigger's accessible name; repeating it as a description is noise.
    expect(triggerEl().hasAttribute("aria-describedby")).toBe(false);
    expect(triggerEl().classList).not.toContain("tw-pointer-events-auto");
  });

  it("falls back to the label when disabled with no reason supplied", () => {
    fixture.componentInstance.reason.set("");
    fixture.detectChanges();

    expect(tooltip().tooltipContent()).toBe("Shared folders");
    expect(triggerEl().hasAttribute("aria-describedby")).toBe(false);
  });
});
