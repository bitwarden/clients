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
import { TooltipDirective } from "../tooltip";

import { FilterMenuComponent } from "./filter-menu.component";
import { FilterOptionComponent } from "./filter-option.component";
import { FilterSectionComponent } from "./filter-section.component";

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
 * regression this covers is a row that truncates with nothing on hover.
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

  it("tooltips a row with the full label it truncates, not some other row's", async () => {
    const fixture = await setUp(TreeTooltipHostComponent);

    for (const row of tooltips(fixture)) {
      expect(row.text).toContain(row.tooltip);
    }
  });
});
