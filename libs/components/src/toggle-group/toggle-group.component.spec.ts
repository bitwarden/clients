import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { ToggleGroupModule } from "./toggle-group.module";
import { ToggleComponent } from "./toggle.component";

describe("Button", () => {
  let fixture: ComponentFixture<TestApp>;
  let testAppComponent: TestApp;
  let buttonElements: ToggleComponent<unknown>[];
  let radioButtons: HTMLInputElement[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestApp],
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TestApp);
    testAppComponent = fixture.debugElement.componentInstance;
    buttonElements = fixture.debugElement
      .queryAll(By.css("bit-toggle"))
      .map((e) => e.componentInstance);
    radioButtons = fixture.debugElement
      .queryAll(By.css("input[type=radio]"))
      .map((e) => e.nativeElement);

    fixture.detectChanges();
  });

  it("should select second element when setting selected to second", () => {
    testAppComponent.selected = "second";
    fixture.detectChanges();

    expect(buttonElements[1].selected).toBe(true);
  });

  it("should not select second element when setting selected to third", () => {
    testAppComponent.selected = "third";
    fixture.detectChanges();

    expect(buttonElements[1].selected).toBe(false);
  });

  it("should emit new value when changing selection by clicking on radio button", () => {
    testAppComponent.selected = "first";
    fixture.detectChanges();

    radioButtons[1].click();

    expect(testAppComponent.selected).toBe("second");
  });
});

@Component({
  selector: "test-app",
  template: `
    <bit-toggle-group [(selected)]="selected">
      <bit-toggle value="first">First</bit-toggle>
      <bit-toggle value="second">Second</bit-toggle>
      <bit-toggle value="third">Third</bit-toggle>
    </bit-toggle-group>
  `,
  imports: [ToggleGroupModule],
})
class TestApp {
  selected?: string;
}
