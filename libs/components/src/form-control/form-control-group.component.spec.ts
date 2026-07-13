import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { FormControlGroupComponent } from "./form-control-group.component";
import { FormControlModule } from "./form-control.module";

describe("FormControlGroupComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let group: FormControlGroupComponent;

  @Component({
    selector: "test-host",
    imports: [ReactiveFormsModule, FormControlModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <bit-form-control-group [formControl]="ctrl">
        <bit-label>Options</bit-label>
      </bit-form-control-group>
    `,
  })
  class TestHostComponent {
    ctrl = new FormControl<string | string[] | null>(null, Validators.required);
  }

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
    group = fixture.debugElement.query(By.directive(FormControlGroupComponent)).componentInstance;
  });

  describe("mode detection", () => {
    it("defaults to multi mode", () => {
      expect(group.mode()).toBe("multi");
    });

    it("switches to single mode when a radio child registers", () => {
      group.registerRadioChild();
      expect(group.mode()).toBe("single");
    });
  });

  describe("multi mode value management", () => {
    it("adds a value when it is not already selected", () => {
      group.onItemChange("a");
      expect(group.selectedValues()).toEqual(["a"]);
    });

    it("removes a value when it is already selected (toggle)", () => {
      group.onItemChange("a");
      group.onItemChange("a");
      expect(group.selectedValues()).toEqual([]);
    });

    it("accumulates multiple distinct values", () => {
      group.onItemChange("a");
      group.onItemChange("b");
      expect(group.selectedValues()).toEqual(["a", "b"]);
    });

    it("notifies onChange with the full array", () => {
      const spy = jest.fn();
      group.registerOnChange(spy);
      group.onItemChange("a");
      expect(spy).toHaveBeenCalledWith(["a"]);
    });

    it("writeValue with an array sets selectedValues", () => {
      group.writeValue(["x", "y"]);
      expect(group.selectedValues()).toEqual(["x", "y"]);
    });
  });

  describe("single mode value management", () => {
    beforeEach(() => {
      group.registerRadioChild();
    });

    it("replaces selectedValues with the new value", () => {
      group.onItemChange("a");
      group.onItemChange("b");
      expect(group.selectedValues()).toEqual(["b"]);
    });

    it("notifies onChange with a scalar value", () => {
      const spy = jest.fn();
      group.registerOnChange(spy);
      group.onItemChange("a");
      expect(spy).toHaveBeenCalledWith("a");
    });

    it("writeValue with a scalar wraps it in selectedValues", () => {
      group.writeValue("x");
      expect(group.selectedValues()).toEqual(["x"]);
    });

    it("writeValue with null clears selectedValues", () => {
      group.writeValue("x");
      group.writeValue(null);
      expect(group.selectedValues()).toEqual([]);
    });
  });

  describe("validation state", () => {
    it("hasError is false when control is untouched", () => {
      expect(group.hasError()).toBe(false);
    });

    it("hasError becomes true when control is invalid and touched via interaction", async () => {
      // Triggering onItemChange calls notifyOnTouched which sets _touched
      group.onItemChange("a");
      group.onItemChange("a"); // toggle back off, leaving it invalid (required)
      fixture.detectChanges();
      await fixture.whenStable();
      expect(group.hasError()).toBe(true);
    });

    it("hasError becomes false once a valid value is set", async () => {
      group.onItemChange("a");
      group.onItemChange("a"); // toggle off → invalid+touched
      fixture.detectChanges();
      await fixture.whenStable();

      group.onItemChange("a"); // select a valid value
      fixture.detectChanges();
      await fixture.whenStable();
      expect(group.hasError()).toBe(false);
    });

    it("required reflects the presence of a required validator", () => {
      expect(group.required()).toBe(true);
    });

    it("required is false when no required validator is set", async () => {
      @Component({
        selector: "test-no-required-host",
        imports: [ReactiveFormsModule, FormControlModule],
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: ` <bit-form-control-group [formControl]="ctrl"></bit-form-control-group> `,
      })
      class TestNoRequiredHostComponent {
        ctrl = new FormControl(null);
      }

      const noRequiredFixture = TestBed.createComponent(TestNoRequiredHostComponent);
      noRequiredFixture.detectChanges();
      await noRequiredFixture.whenStable();

      const noRequiredGroup = noRequiredFixture.debugElement.query(
        By.directive(FormControlGroupComponent),
      ).componentInstance as FormControlGroupComponent;

      expect(noRequiredGroup.required()).toBe(false);
    });

    it("displayError returns the translated required message", async () => {
      group.onItemChange("a");
      group.onItemChange("a"); // toggle off → required error
      fixture.detectChanges();
      await fixture.whenStable();
      expect(group.displayError()).toBe("required");
    });
  });

  describe("disabled state", () => {
    it("groupDisabled is false by default", () => {
      expect(group.groupDisabled()).toBe(false);
    });

    it("setDisabledState(true) sets groupDisabled to true", () => {
      group.setDisabledState(true);
      expect(group.groupDisabled()).toBe(true);
    });

    it("setDisabledState(false) clears groupDisabled", () => {
      group.setDisabledState(true);
      group.setDisabledState(false);
      expect(group.groupDisabled()).toBe(false);
    });

    it("disabling via form control propagates to groupDisabled", async () => {
      host.ctrl.disable();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(group.groupDisabled()).toBe(true);
    });
  });

  describe("touch propagation", () => {
    it("onBlur calls notifyOnTouched and sets _touched", () => {
      const spy = jest.fn();
      group.registerOnTouched(spy);
      group.onBlur();
      expect(spy).toHaveBeenCalled();
    });

    it("onFocusOut does not trigger blur when focus stays inside the component", () => {
      const spy = jest.fn();
      group.registerOnTouched(spy);
      const hostEl: HTMLElement = fixture.debugElement.query(
        By.directive(FormControlGroupComponent),
      ).nativeElement;
      const child = hostEl.firstElementChild as HTMLElement;

      const event = new FocusEvent("focusout", { relatedTarget: child });
      group.onFocusOut(event);
      expect(spy).not.toHaveBeenCalled();
    });

    it("onFocusOut triggers blur when focus leaves the component", () => {
      const spy = jest.fn();
      group.registerOnTouched(spy);
      const outside = document.createElement("div");
      const event = new FocusEvent("focusout", { relatedTarget: outside });
      group.onFocusOut(event);
      expect(spy).toHaveBeenCalled();
    });
  });
});
