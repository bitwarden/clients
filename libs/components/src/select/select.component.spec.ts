import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SelectComponent } from "./select.component";
import { SelectModule } from "./select.module";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SelectModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <bit-select formControlName="fruits"></bit-select>
    </form>
  `,
})
export class TestFormComponent {
  readonly form = new FormGroup({
    fruits: new FormControl<"apple" | "pear" | "banana">("apple"),
  });
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SelectModule],
  template: `
    <bit-select>
      <bit-option
        value="apple"
        label="Apple"
        [iconTile]="{ icon: 'bwi-star', variant: 'teal', emphasis: 'bold' }"
      ></bit-option>
      <bit-option value="pear" label="Pear" icon="bwi-key"></bit-option>
      <bit-option
        value="banana"
        label="Banana"
        icon="bwi-key"
        [iconTile]="{ icon: 'bwi-star' }"
      ></bit-option>
    </bit-select>
  `,
})
export class TestOptionsComponent {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SelectModule],
  template: `<bit-select [disabled]="disabled()"></bit-select>`,
})
export class TestDisabledInputComponent {
  readonly disabled = signal(false);
}

describe("Select Component", () => {
  let fixture: ComponentFixture<TestFormComponent>;
  let select: SelectComponent<unknown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestFormComponent],
      providers: [{ provide: I18nService, useValue: mock<I18nService>() }],
    }).compileComponents();
    fixture = TestBed.createComponent(TestFormComponent);
    fixture.detectChanges();

    select = fixture.debugElement.query(By.directive(SelectComponent)).componentInstance;
  });

  describe("initial state", () => {
    it("selected option should update when items input changes", () => {
      expect(select.selectedOption()?.value).toBeUndefined();

      select.items.set([
        { label: "Apple", value: "apple" },
        { label: "Pear", value: "pear" },
        { label: "Banana", value: "banana" },
      ]);

      expect(select.selectedOption()?.value).toBe("apple");
    });
  });

  describe("ID and label association", () => {
    it("labelForId targets the internal search input, not the component root element", () => {
      expect(select.formFieldControl.labelForId()).not.toBe(select.formFieldControl.id());
    });

    it("labelForId is derived from the component id with a '-search' suffix", () => {
      expect(select.formFieldControl.labelForId()).toBe(`${select.formFieldControl.id()}-search`);
    });
  });

  describe("disabled state", () => {
    /**
     * The host is OnPush, so nothing marks the select dirty on the consumer's behalf — these assert
     * that the control's disabled state propagates off the component's own signal writes.
     *
     * `ng-select` has no `disabled` input of its own: the binding reaches the inner `NgModel`,
     * which disables its control in a microtask, so the rendered state needs a flush to settle.
     */
    it("picks up the form control being disabled", async () => {
      expect(select.disabled()).toBe(false);

      fixture.componentInstance.form.controls.fruits.disable();
      await settle();

      expect(select.disabled()).toBe(true);
      expect(hostElement().getAttribute("disabled")).not.toBeNull();
      expect(ngSelectElement().classList).toContain("ng-select-disabled");
    });

    it("picks up the form control being re-enabled", async () => {
      fixture.componentInstance.form.controls.fruits.disable();
      await settle();

      fixture.componentInstance.form.controls.fruits.enable();
      await settle();

      expect(select.disabled()).toBe(false);
      expect(hostElement().getAttribute("disabled")).toBeNull();
      expect(ngSelectElement().classList).not.toContain("ng-select-disabled");
    });

    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    const hostElement = (): HTMLElement =>
      fixture.debugElement.query(By.directive(SelectComponent)).nativeElement;

    const ngSelectElement = (): HTMLElement => hostElement().querySelector("ng-select")!;
  });
});

describe("Select Component disabled by input", () => {
  let fixture: ComponentFixture<TestDisabledInputComponent>;
  let select: SelectComponent<unknown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestDisabledInputComponent],
      providers: [{ provide: I18nService, useValue: mock<I18nService>() }],
    }).compileComponents();
    fixture = TestBed.createComponent(TestDisabledInputComponent);
    fixture.detectChanges();

    select = fixture.debugElement.query(By.directive(SelectComponent)).componentInstance;
  });

  it("is enabled by default", () => {
    expect(select.disabled()).toBe(false);
  });

  it("follows the disabled input", () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    expect(select.disabled()).toBe(true);
    expect(
      fixture.debugElement
        .query(By.directive(SelectComponent))
        .nativeElement.getAttribute("disabled"),
    ).not.toBeNull();
  });
});

describe("Select Component with bit-option children", () => {
  let select: SelectComponent<unknown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestOptionsComponent],
      providers: [{ provide: I18nService, useValue: mock<I18nService>() }],
    }).compileComponents();
    const fixture = TestBed.createComponent(TestOptionsComponent);
    fixture.detectChanges();

    select = fixture.debugElement.query(By.directive(SelectComponent)).componentInstance;
  });

  it("maps the iconTile input onto the items it derives from bit-option", () => {
    expect(select.items()).toEqual([
      {
        label: "Apple",
        value: "apple",
        icon: undefined,
        iconTile: { icon: "bwi-star", variant: "teal", emphasis: "bold" },
        description: undefined,
        disabled: undefined,
      },
      {
        label: "Pear",
        value: "pear",
        icon: "bwi-key",
        iconTile: undefined,
        description: undefined,
        disabled: undefined,
      },
      {
        label: "Banana",
        value: "banana",
        icon: "bwi-key",
        iconTile: { icon: "bwi-star" },
        description: undefined,
        disabled: undefined,
      },
    ]);
  });
});
