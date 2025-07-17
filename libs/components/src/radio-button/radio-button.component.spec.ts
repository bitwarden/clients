import { Component, DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { RadioButtonModule } from "./radio-button.module";
import { RadioGroupComponent } from "./radio-group.component";

describe("RadioButton", () => {
  let fixture: ComponentFixture<TestComponent>;
  let radioButtonGroup: RadioGroupComponent;
  let radioButtons: DebugElement[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
      providers: [{ provide: I18nService, useValue: new I18nMockService({}) }],
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    radioButtonGroup = fixture.debugElement.query(
      By.directive(RadioGroupComponent),
    ).componentInstance;
    radioButtons = fixture.debugElement.queryAll(By.css("input[type=radio]"));
  });

  it("should emit value when clicking on radio button", () => {
    const spyFn = jest.spyOn(radioButtonGroup, "onInputChange");

    radioButtons[1].triggerEventHandler("change");
    fixture.detectChanges();

    expect(spyFn).toHaveBeenCalledWith(1);
  });

  it("should check radio button only when selected matches value", () => {
    fixture.detectChanges();

    expect(radioButtons[0].nativeElement.checked).toBe(true);
    expect(radioButtons[1].nativeElement.checked).toBe(false);

    radioButtons[1].triggerEventHandler("change");
    fixture.detectChanges();

    expect(radioButtons[0].nativeElement.checked).toBe(false);
    expect(radioButtons[1].nativeElement.checked).toBe(true);
  });
});

@Component({
  selector: "test-component",
  template: `
    <form [formGroup]="formObj">
      <bit-radio-group formControlName="radio">
        <bit-radio-button [value]="0"><bit-label>Element</bit-label></bit-radio-button>
        <bit-radio-button [value]="1"><bit-label>Element</bit-label></bit-radio-button>
      </bit-radio-group>
    </form>
  `,
  imports: [FormsModule, ReactiveFormsModule, RadioButtonModule],
})
class TestComponent {
  formObj = new FormGroup({
    radio: new FormControl(0),
  });
}
