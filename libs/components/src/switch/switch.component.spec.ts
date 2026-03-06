import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { By } from "@angular/platform-browser";

import { FormControlModule } from "../form-control/form-control.module";
import { BitLabelComponent } from "../form-control/label.component";

import { SwitchComponent } from "./switch.component";

describe("SwitchComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let switchComponent: SwitchComponent;
  let inputEl: HTMLInputElement;

  // TODO: Fix this the next time the file is edited.
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  @Component({
    selector: "test-host",
    imports: [FormsModule, ReactiveFormsModule, FormControlModule, SwitchComponent],
    template: `
      <form [formGroup]="formObj">
        <bit-form-control>
          <bit-switch formControlName="switch"> </bit-switch>
          <bit-label>Element</bit-label>
        </bit-form-control>
      </form>
    `,
  })
  class TestHostComponent {
    formObj = new FormGroup({
      switch: new FormControl(false),
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const debugSwitch = fixture.debugElement.query(By.directive(SwitchComponent));
    switchComponent = debugSwitch.componentInstance;
    inputEl = debugSwitch.nativeElement.querySelector("input[type=checkbox]");
  });

  it("should update checked attribute when selected changes programmatically", () => {
    expect(inputEl.checked).toBe(false);

    switchComponent.writeValue(true);
    fixture.detectChanges();
    expect(inputEl.checked).toBe(true);

    switchComponent.writeValue(false);
    fixture.detectChanges();
    expect(inputEl.checked).toBe(false);
  });

  it("should update checked attribute when switch is clicked", () => {
    expect(inputEl.checked).toBe(false);

    inputEl.click();
    fixture.detectChanges();

    expect(inputEl.checked).toBe(true);

    inputEl.click();
    fixture.detectChanges();

    expect(inputEl.checked).toBe(false);
  });

  it("should update checked when selected input changes outside of a form", async () => {
    // TODO: Fix this the next time the file is edited.
    // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
    @Component({
      selector: "test-selected-host",
      template: `
        <bit-form-control>
          <bit-switch [selected]="checked"></bit-switch>
          <bit-label>Element</bit-label>
        </bit-form-control>
      `,
      imports: [SwitchComponent, BitLabelComponent, FormControlModule],
    })
    class TestSelectedHostComponent {
      checked = false;
    }

    const hostFixture = TestBed.createComponent(TestSelectedHostComponent);
    hostFixture.detectChanges();
    const switchDebug = hostFixture.debugElement.query(By.directive(SwitchComponent));
    const input = switchDebug.nativeElement.querySelector('input[type="checkbox"]');

    expect(input.checked).toBe(false);

    hostFixture.componentInstance.checked = true;
    hostFixture.detectChanges();
    expect(input.checked).toBe(true);

    hostFixture.componentInstance.checked = false;
    hostFixture.detectChanges();
    expect(input.checked).toBe(false);
  });

  describe("BitFormControlAbstraction", () => {
    it("should report disabled from ngControl", () => {
      fixture.componentInstance.formObj.get("switch")!.disable();
      fixture.detectChanges();
      expect(switchComponent.disabled).toBe(true);

      fixture.componentInstance.formObj.get("switch")!.enable();
      fixture.detectChanges();
      expect(switchComponent.disabled).toBe(false);
    });

    it("should report required when Validators.requiredTrue is set", () => {
      expect(switchComponent.required).toBe(false);

      fixture.componentInstance.formObj.get("switch")!.setValidators(Validators.requiredTrue);
      fixture.componentInstance.formObj.get("switch")!.updateValueAndValidity();
      fixture.detectChanges();
      expect(switchComponent.required).toBe(true);
    });

    it("should report hasError when control is invalid and touched", () => {
      fixture.componentInstance.formObj.get("switch")!.setValidators(Validators.requiredTrue);
      fixture.componentInstance.formObj.get("switch")!.updateValueAndValidity();
      fixture.componentInstance.formObj.get("switch")!.markAsTouched();
      fixture.detectChanges();
      expect(switchComponent.hasError).toBe(true);
    });

    it("should not report hasError when control is invalid but untouched", () => {
      fixture.componentInstance.formObj.get("switch")!.setValidators(Validators.requiredTrue);
      fixture.componentInstance.formObj.get("switch")!.updateValueAndValidity();
      fixture.detectChanges();
      expect(switchComponent.hasError).toBe(false);
    });
  });
});
