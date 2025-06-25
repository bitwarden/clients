import { Component, model } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { ToggleGroupComponent } from "./toggle-group.component";
import { ToggleGroupModule } from "./toggle-group.module";

// TODO signals migration broke these
describe.skip("Button", () => {
  let mockGroupComponent: MockedButtonGroupComponent;
  let fixture: ComponentFixture<TestApp>;
  let testAppComponent: TestApp;
  let radioButton: HTMLInputElement;

  beforeEach(async () => {
    mockGroupComponent = new MockedButtonGroupComponent();

    TestBed.configureTestingModule({
      imports: [TestApp],
      providers: [{ provide: ToggleGroupComponent, useValue: mockGroupComponent }],
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TestApp);
    testAppComponent = fixture.debugElement.componentInstance;
    radioButton = fixture.debugElement.query(By.css("input[type=radio]")).nativeElement;
  });

  it("should emit value when clicking on radio button", () => {
    testAppComponent.value = "value";
    fixture.detectChanges();

    radioButton.click();
    fixture.detectChanges();

    expect(mockGroupComponent.onInputInteraction).toHaveBeenCalledWith("value");
  });

  it("should check radio button when selected matches value", () => {
    testAppComponent.value = "value";
    fixture.detectChanges();

    mockGroupComponent.selected.set("value");
    fixture.detectChanges();

    expect(radioButton.checked).toBe(true);
  });

  it("should not check radio button when selected does not match value", () => {
    testAppComponent.value = "value";
    fixture.detectChanges();

    mockGroupComponent.selected.set("nonMatchingValue");
    fixture.detectChanges();

    expect(radioButton.checked).toBe(false);
  });
});

@Component({
  selector: "mock-button-group",
})
class MockedButtonGroupComponent implements Partial<ToggleGroupComponent<string>> {
  onInputInteraction = jest.fn();
  selected = model<string>();
}

@Component({
  selector: "test-app",
  template: ` <bit-toggle [value]="value">Element</bit-toggle>`,
  imports: [ToggleGroupModule],
})
class TestApp {
  value?: string;
}
