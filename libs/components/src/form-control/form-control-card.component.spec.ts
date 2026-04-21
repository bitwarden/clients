import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { CheckboxComponent } from "../checkbox/checkbox.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { FormControlCardComponent } from "./form-control-card.component";
import { FormControlModule } from "./form-control.module";

describe("FormControlCardComponent - aria-describedby reactivity", () => {
  @Component({
    selector: "test-host",
    imports: [ReactiveFormsModule, FormControlModule, CheckboxComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <form [formGroup]="formObj">
        <bit-form-control-card>
          <bit-label>Accept terms</bit-label>
          <input type="checkbox" bitCheckbox formControlName="accept" />
          <bit-hint>You must accept the terms</bit-hint>
        </bit-form-control-card>
      </form>
    `,
  })
  class TestHostComponent {
    formObj = new FormGroup({
      accept: new FormControl(false, Validators.requiredTrue),
    });

    get control() {
      return this.formObj.get("accept")!;
    }
  }

  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let card: FormControlCardComponent;
  let inputEl: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({ required: "required", inputRequired: "required" }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    host = fixture.componentInstance;
    card = fixture.debugElement.query(By.directive(FormControlCardComponent)).componentInstance;
    inputEl = fixture.nativeElement.querySelector("input[type=checkbox]");
  });

  it("sets aria-labelledby on the input element", () => {
    expect(inputEl.getAttribute("aria-labelledby")).toContain(card.labelId);
  });

  describe("when control is untouched and invalid", () => {
    it("does not set aria-describedby to the error element", () => {
      // Control starts untouched+invalid (requiredTrue, value=false)
      expect(inputEl.getAttribute("aria-describedby")).not.toBe(card.errorId);
    });

    it("sets aria-describedby to include the hint element", () => {
      const hintEl = fixture.nativeElement.querySelector("bit-hint");
      expect(inputEl.getAttribute("aria-describedby")).toContain(hintEl.id);
    });
  });

  describe("when control becomes touched and invalid", () => {
    beforeEach(async () => {
      host.control.markAsTouched();
      host.control.updateValueAndValidity();
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("updates aria-describedby to include the error element", () => {
      expect(inputEl.getAttribute("aria-describedby")).toContain(card.errorId);
    });
  });

  describe("when control transitions from invalid to valid", () => {
    beforeEach(async () => {
      host.control.markAsTouched();
      host.control.updateValueAndValidity();
      fixture.detectChanges();
      await fixture.whenStable();

      // Fix the error by setting a valid value
      host.control.setValue(true);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("reverts aria-describedby to include the hint element", () => {
      const hintEl = fixture.nativeElement.querySelector("bit-hint");
      expect(inputEl.getAttribute("aria-describedby")).toContain(hintEl.id);
    });
  });

  describe("when control transitions from valid to invalid", () => {
    beforeEach(async () => {
      // Start valid
      host.control.setValue(true);
      host.control.markAsTouched();
      fixture.detectChanges();
      await fixture.whenStable();

      // Break the value
      host.control.setValue(false);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it("updates aria-describedby to include the error element", () => {
      expect(inputEl.getAttribute("aria-describedby")).toContain(card.errorId);
    });
  });

  describe("when there is no hint and no error", () => {
    @Component({
      selector: "test-no-hint-host",
      imports: [ReactiveFormsModule, FormControlModule, CheckboxComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <form [formGroup]="formObj">
          <bit-form-control-card>
            <bit-label>Accept</bit-label>
            <input type="checkbox" bitCheckbox formControlName="accept" />
          </bit-form-control-card>
        </form>
      `,
    })
    class TestNoHintHostComponent {
      formObj = new FormGroup({
        accept: new FormControl(true),
      });
    }

    it("sets aria-describedby to the error element only", async () => {
      const noHintFixture = TestBed.createComponent(TestNoHintHostComponent);
      noHintFixture.detectChanges();
      await noHintFixture.whenStable();

      const cardInstance = noHintFixture.debugElement.query(By.directive(FormControlCardComponent))
        .componentInstance as FormControlCardComponent;
      const input = noHintFixture.nativeElement.querySelector("input[type=checkbox]");
      expect(input.getAttribute("aria-describedby")).toBe(cardInstance.errorId);
    });
  });
});
