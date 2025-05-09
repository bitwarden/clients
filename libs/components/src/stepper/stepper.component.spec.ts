// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
// import { By } from "@angular/platform-browser";

import { StepperModule } from "./index";

describe("Stepper", () => {
  let fixture: ComponentFixture<TestApp>;
  let testAppComponent: TestApp;
  // let buttonDebugElement: DebugElement;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [StepperModule],
      declarations: [TestApp],
    });

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    TestBed.compileComponents();
    fixture = TestBed.createComponent(TestApp);
    testAppComponent = fixture.debugElement.componentInstance;
    // buttonDebugElement = fixture.debugElement.query(By.css("button"));
    fixture.detectChanges();
    // disabledButtonDebugElement = fixture.debugElement.query(By.css("button#disabled"));
    // linkDebugElement = fixture.debugElement.query(By.css("a"));
  }));

  it("should be defined", () => {
    expect(testAppComponent).toBeDefined();
  });
});

@Component({
  selector: "test-app",
  template: `
    <bit-stepper>
      <bit-step label="Step 1">
        <p>Step 1 content</p>
      </bit-step>
      <bit-step label="Step 2">
        <p>Step 2 content</p>
      </bit-step>
    </bit-stepper>
  `,
})
class TestApp {}
