import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ViewContainerRef,
  signal,
  viewChild,
} from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconTileComponent } from "../icon-tile";

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

type Row = { value: string; label: string; nested?: Row[] };

/**
 * A data-driven tree via `nested`, the way a consumer builds an arbitrary-depth option tree
 * from data rather than literal markup — see `FilterOptionComponent.nested`.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterMenuComponent, FilterSectionComponent, FilterOptionComponent],
  template: `
    <bit-filter-menu key="test" placeholderText="Test" multiple>
      @if (grouped) {
        <bit-filter-section label="Group A">
          @for (row of rows; track row.value) {
            <bit-filter-option [value]="row.value" [nested]="row.nested ?? []">{{
              row.label
            }}</bit-filter-option>
          }
        </bit-filter-section>
      } @else {
        @for (row of rows; track row.value) {
          <bit-filter-option [value]="row.value" [nested]="row.nested ?? []">{{
            row.label
          }}</bit-filter-option>
        }
      }
    </bit-filter-menu>
  `,
})
class DataDrivenTreeHostComponent {
  grouped = false;
  rows: Row[] = [
    { value: "parent", label: "Parent", nested: [{ value: "child", label: "Child" }] },
  ];
}

describe("FilterMenuComponent options built from FilterOptionComponent.nested", () => {
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

  /** Finds a rendered option instance by its value, via the real component tree. */
  function findOption(
    fixture: ComponentFixture<DataDrivenTreeHostComponent>,
    value: string,
  ): FilterOptionComponent {
    const option = fixture.debugElement
      .queryAll(By.directive(FilterOptionComponent))
      .map((el) => el.componentInstance as FilterOptionComponent)
      .find((o) => o.value() === value);
    if (!option) {
      throw new Error(`No option found for value ${value}`);
    }
    return option;
  }

  it("selecting the parent selects its whole nested subtree (ungrouped)", async () => {
    const { fixture, menu } = await setup(false);

    expect(menu.isSelected("parent")).toBe(false);
    menu["toggleOption"](findOption(fixture, "parent"));
    expect(menu.isSelected("parent")).toBe(true);
    expect(menu.isSelected("child")).toBe(true);
  });

  it("groups the nested option's subtree under its bit-filter-section", async () => {
    const { fixture, menu } = await setup(true);
    const section = fixture.debugElement.query(By.directive(FilterSectionComponent))
      .componentInstance as FilterSectionComponent;

    expect(section.options().map((o) => o.value())).toEqual(["parent"]);
    expect(section.allOptions().map((o) => o.value())).toEqual(["parent", "child"]);

    menu["toggleOption"](findOption(fixture, "parent"));
    expect(menu.isSelected("child")).toBe(true);
  });
});
