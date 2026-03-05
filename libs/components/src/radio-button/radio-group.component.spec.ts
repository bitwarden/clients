import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { RadioButtonComponent } from "./radio-button.component";
import { RadioButtonModule } from "./radio-button.module";

describe("RadioGroupComponent", () => {
  let fixture: ComponentFixture<TestAppComponent>;
  let testAppComponent: TestAppComponent;
  let buttonElements: RadioButtonComponent[];
  let radioButtons: HTMLInputElement[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestAppComponent],
      providers: [{ provide: I18nService, useValue: new I18nMockService({}) }],
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TestAppComponent);
    fixture.detectChanges();
    testAppComponent = fixture.debugElement.componentInstance;
    buttonElements = fixture.debugElement
      .queryAll(By.css("bit-radio-button"))
      .map((e) => e.componentInstance);
    radioButtons = fixture.debugElement
      .queryAll(By.css("input[type=radio]"))
      .map((e) => e.nativeElement);

    fixture.detectChanges();
  });

  it("should select second element when setting selected to second", async () => {
    testAppComponent.selected = "second";
    fixture.detectChanges();
    await fixture.whenStable();

    expect(buttonElements[1].selected).toBe(true);
  });

  it("should not select second element when setting selected to third", async () => {
    testAppComponent.selected = "third";
    fixture.detectChanges();
    await fixture.whenStable();

    expect(buttonElements[1].selected).toBe(false);
  });

  it("should emit new value when changing selection by clicking on radio button", async () => {
    testAppComponent.selected = "first";
    fixture.detectChanges();
    await fixture.whenStable();

    radioButtons[1].click();

    expect(testAppComponent.selected).toBe("second");
  });
});

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "test-app",
  template: `
    <bit-radio-group [(ngModel)]="selected">
      <bit-radio-button value="first">First</bit-radio-button>
      <bit-radio-button value="second">Second</bit-radio-button>
      <bit-radio-button value="third">Third</bit-radio-button>
    </bit-radio-group>
  `,
  imports: [FormsModule, RadioButtonModule],
})
class TestAppComponent {
  selected?: string;
}
