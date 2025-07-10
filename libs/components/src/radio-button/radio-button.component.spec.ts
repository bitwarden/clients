import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { RadioButtonModule } from "./radio-button.module";
import { RadioGroupComponent } from "./radio-group.component";

describe("RadioButton", () => {
  let mockGroupComponent: MockedButtonGroupComponent;
  let fixture: ComponentFixture<TestApp>;
  let testAppComponent: TestApp;
  let radioButton: HTMLInputElement;

  beforeEach(async () => {
    mockGroupComponent = new MockedButtonGroupComponent();

    TestBed.configureTestingModule({
      imports: [TestApp],
      providers: [
        { provide: RadioGroupComponent, useValue: mockGroupComponent },
        { provide: I18nService, useValue: new I18nMockService({}) },
      ],
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TestApp);
    fixture.detectChanges();
    testAppComponent = fixture.debugElement.componentInstance;
    radioButton = fixture.debugElement.query(By.css("input[type=radio]")).nativeElement;
  });

  it("should emit value when clicking on radio button", () => {
    testAppComponent.value = "value";
    fixture.detectChanges();

    radioButton.click();
    fixture.detectChanges();

    expect(mockGroupComponent.onInputChange).toHaveBeenCalledWith("value");
  });

  it("should check radio button when selected matches value", () => {
    testAppComponent.value = "value";
    fixture.detectChanges();

    mockGroupComponent.selected = "value";
    fixture.detectChanges();

    expect(radioButton.checked).toBe(true);
  });

  it("should not check radio button when selected does not match value", () => {
    testAppComponent.value = "value";
    fixture.detectChanges();

    mockGroupComponent.selected = "nonMatchingValue";
    fixture.detectChanges();

    expect(radioButton.checked).toBe(false);
  });
});

class MockedButtonGroupComponent implements Partial<RadioGroupComponent> {
  onInputChange = jest.fn();
  selected: unknown = null;
}

@Component({
  selector: "test-app",
  template: `<bit-radio-button [value]="value"><bit-label>Element</bit-label></bit-radio-button>`,
  imports: [RadioButtonModule],
})
class TestApp {
  value?: string;
}
