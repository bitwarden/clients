import { Component, DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconButtonModule } from "../icon-button";
import { BitIconButtonComponent } from "../icon-button/icon-button.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BitFormFieldControl } from "./form-field-control";
import { BitFormFieldComponent } from "./form-field.component";
import { FormFieldModule } from "./form-field.module";
import { BitPasswordInputToggleDirective } from "./password-input-toggle.directive";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "test-form-field",
  template: `
    <form>
      <bit-form-field>
        <bit-label>Password</bit-label>
        <input bitInput type="password" />
        <button
          type="button"
          label="Toggle password visibility"
          bitIconButton
          bitSuffix
          bitPasswordInputToggle
        ></button>
      </bit-form-field>
    </form>
  `,
  imports: [FormFieldModule, IconButtonModule],
})
class TestFormFieldComponent {}

describe("PasswordInputToggle", () => {
  let fixture: ComponentFixture<TestFormFieldComponent>;
  let button: BitIconButtonComponent;
  let input: BitFormFieldControl;
  let toggle: DebugElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestFormFieldComponent],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({
            toggleVisibility: "Toggle visibility",
            loading: "Loading",
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestFormFieldComponent);
    fixture.detectChanges();

    toggle = fixture.debugElement.query(By.directive(BitPasswordInputToggleDirective));
    const buttonEl = fixture.debugElement.query(By.directive(BitIconButtonComponent));
    button = buttonEl.componentInstance;
    const formFieldEl = fixture.debugElement.query(By.directive(BitFormFieldComponent));
    const formField: BitFormFieldComponent = formFieldEl.componentInstance;
    input = formField.input();
  });

  describe("initial state", () => {
    it("has correct icon", () => {
      expect(button.icon()).toBe("bwi-eye");
    });

    it("input is type password", () => {
      expect(input.type!()).toBe("password");
    });

    it("spellcheck is disabled", () => {
      expect(input.spellcheck!()).toBe(undefined);
    });
  });

  describe("when toggled", () => {
    beforeEach(() => {
      toggle.triggerEventHandler("click");
    });

    it("has correct icon", () => {
      expect(button.icon()).toBe("bwi-eye-slash");
    });

    it("input is type text", () => {
      expect(input.type!()).toBe("text");
    });

    it("spellcheck is disabled", () => {
      expect(input.spellcheck!()).toBe(false);
    });
  });

  describe("when toggled twice", () => {
    beforeEach(() => {
      toggle.triggerEventHandler("click");
      toggle.triggerEventHandler("click");
    });

    it("has correct icon", () => {
      expect(button.icon()).toBe("bwi-eye");
    });

    it("input is type password", () => {
      expect(input.type!()).toBe("password");
    });

    it("spellcheck is disabled", () => {
      expect(input.spellcheck!()).toBe(undefined);
    });
  });
});
