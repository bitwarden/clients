import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitFormFieldControlDirective } from "../form-field/form-field-control.directive";
import { BitFormFieldComponent } from "../form-field/form-field.component";
import { FormFieldModule } from "../form-field/form-field.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BitInputDirective } from "./input.directive";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldModule],
  template: `
    <bit-form-field>
      <bit-label>Label</bit-label>
      <input bitInput />
    </bit-form-field>
  `,
})
class TestInputComponent {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldModule],
  template: `
    <bit-form-field>
      <bit-label>Label</bit-label>
      <input bitInput id="custom-id" />
    </bit-form-field>
  `,
})
class TestCustomIdInputComponent {}

describe("BitInputDirective — default id generation", () => {
  let fixture: ComponentFixture<TestInputComponent>;
  let inputEl: HTMLInputElement;
  let formFieldControl: BitFormFieldControlDirective;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestInputComponent],
      providers: [{ provide: I18nService, useValue: new I18nMockService({}) }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestInputComponent);
    fixture.detectChanges();

    inputEl = fixture.debugElement.query(By.directive(BitInputDirective)).nativeElement;
    formFieldControl = fixture.debugElement
      .query(By.directive(BitFormFieldComponent))
      .componentInstance.input();
  });

  it("sets a generated id attribute on the input element", () => {
    expect(inputEl.id).toMatch(/^bit-form-field-\d+$/);
  });

  it("sets labelForId to the generated id so the label associates with the input", () => {
    expect(formFieldControl.labelForId()).toBe(inputEl.id);
  });

  it("generates a unique id for each instance", () => {
    const fixture2 = TestBed.createComponent(TestInputComponent);
    fixture2.detectChanges();
    const inputEl2 = fixture2.debugElement.query(By.directive(BitInputDirective)).nativeElement;

    expect(inputEl.id).not.toBe(inputEl2.id);
  });
});

describe("BitInputDirective — custom id", () => {
  let inputEl: HTMLInputElement;
  let formFieldControl: BitFormFieldControlDirective;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestCustomIdInputComponent],
      providers: [{ provide: I18nService, useValue: new I18nMockService({}) }],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestCustomIdInputComponent);
    fixture.detectChanges();

    inputEl = fixture.debugElement.query(By.directive(BitInputDirective)).nativeElement;
    formFieldControl = fixture.debugElement
      .query(By.directive(BitFormFieldComponent))
      .componentInstance.input();
  });

  it("uses the provided id on the input element", () => {
    expect(inputEl.id).toBe("custom-id");
  });

  it("sets labelForId to the custom id so the label associates correctly", () => {
    expect(formFieldControl.labelForId()).toBe("custom-id");
  });
});
