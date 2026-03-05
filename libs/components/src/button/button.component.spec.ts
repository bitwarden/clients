import { Component, DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { ButtonModule } from "./index";

describe("Button", () => {
  let fixture: ComponentFixture<TestAppComponent>;
  let testAppComponent: TestAppComponent;
  let buttonDebugElement: DebugElement;
  let disabledButtonDebugElement: DebugElement;
  let linkDebugElement: DebugElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestAppComponent],
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TestAppComponent);
    testAppComponent = fixture.debugElement.componentInstance;
    buttonDebugElement = fixture.debugElement.query(By.css("button"));
    disabledButtonDebugElement = fixture.debugElement.query(By.css("button#disabled"));
    linkDebugElement = fixture.debugElement.query(By.css("a"));
  });

  it("should not be disabled when loading and disabled are false", () => {
    testAppComponent.loading = false;
    testAppComponent.disabled = false;
    fixture.detectChanges();

    expect(buttonDebugElement.attributes["loading"]).toBeFalsy();
    expect(linkDebugElement.attributes["loading"]).toBeFalsy();
    expect(buttonDebugElement.nativeElement.disabled).toBeFalsy();
  });

  it("should be aria-disabled and not html attribute disabled when disabled is true", () => {
    testAppComponent.disabled = true;
    fixture.detectChanges();
    expect(buttonDebugElement.attributes["aria-disabled"]).toBe("true");
    expect(buttonDebugElement.nativeElement.disabled).toBeFalsy();
    // Anchor tags cannot be disabled.
  });

  it("should be aria-disabled not html attribute disabled when attribute disabled is true", () => {
    fixture.detectChanges();
    expect(disabledButtonDebugElement.attributes["aria-disabled"]).toBe("true");
    expect(disabledButtonDebugElement.nativeElement.disabled).toBeFalsy();
  });

  it("should be disabled when loading is true", () => {
    testAppComponent.loading = true;
    fixture.detectChanges();

    expect(buttonDebugElement.attributes["aria-disabled"]).toBe("true");
  });
});

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "test-app",
  template: `
    <button
      type="button"
      bitButton
      [buttonType]="buttonType"
      [block]="block"
      [disabled]="disabled"
      [loading]="loading"
    >
      Button
    </button>
    <a
      href="#"
      bitButton
      [buttonType]="buttonType"
      [block]="block"
      [disabled]="disabled"
      [loading]="loading"
    >
      Link
    </a>

    <button id="disabled" type="button" bitButton disabled>Button</button>
  `,
  imports: [ButtonModule],
})
class TestAppComponent {
  buttonType?: string;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
}
