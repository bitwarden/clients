import { Component, DebugElement } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils";

import { ButtonModule } from "./index";

describe("Button", () => {
  let fixture: ComponentFixture<TestApp>;
  let testAppComponent: TestApp;
  let buttonDebugElement: DebugElement;
  let disabledButtonDebugElement: DebugElement;
  let linkDebugElement: DebugElement;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ButtonModule],
      declarations: [TestApp],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({
            loading: "Loading",
          }),
        },
      ],
    });

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    TestBed.compileComponents();
    fixture = TestBed.createComponent(TestApp);
    testAppComponent = fixture.debugElement.componentInstance;
    buttonDebugElement = fixture.debugElement.query(By.css("button"));
    disabledButtonDebugElement = fixture.debugElement.query(By.css("button#disabled"));
    linkDebugElement = fixture.debugElement.query(By.css("a"));
  }));

  it("should apply classes based on type", () => {
    testAppComponent.buttonType = "primary";
    fixture.detectChanges();
    expect(buttonDebugElement.nativeElement.classList.contains("tw-bg-primary-600")).toBe(true);
    expect(linkDebugElement.nativeElement.classList.contains("tw-bg-primary-600")).toBe(true);

    testAppComponent.buttonType = "secondary";
    fixture.detectChanges();
    expect(buttonDebugElement.nativeElement.classList.contains("tw-border-text-muted")).toBe(true);
    expect(linkDebugElement.nativeElement.classList.contains("tw-border-text-muted")).toBe(true);

    testAppComponent.buttonType = "danger";
    fixture.detectChanges();
    expect(buttonDebugElement.nativeElement.classList.contains("tw-border-danger-600")).toBe(true);
    expect(linkDebugElement.nativeElement.classList.contains("tw-border-danger-600")).toBe(true);

    testAppComponent.buttonType = "unstyled";
    fixture.detectChanges();
    expect(
      Array.from(buttonDebugElement.nativeElement.classList).some((klass: string) =>
        klass.startsWith("tw-bg"),
      ),
    ).toBe(false);
    expect(
      Array.from(linkDebugElement.nativeElement.classList).some((klass: string) =>
        klass.startsWith("tw-bg"),
      ),
    ).toBe(false);

    testAppComponent.buttonType = null;
    fixture.detectChanges();
    expect(buttonDebugElement.nativeElement.classList.contains("tw-border-text-muted")).toBe(true);
    expect(linkDebugElement.nativeElement.classList.contains("tw-border-text-muted")).toBe(true);
  });

  it("should apply block when true and inline-block when false", () => {
    testAppComponent.block = true;
    fixture.detectChanges();
    expect(buttonDebugElement.nativeElement.classList.contains("tw-block")).toBe(true);
    expect(linkDebugElement.nativeElement.classList.contains("tw-block")).toBe(true);
    expect(buttonDebugElement.nativeElement.classList.contains("tw-inline-block")).toBe(false);
    expect(linkDebugElement.nativeElement.classList.contains("tw-inline-block")).toBe(false);

    testAppComponent.block = false;
    fixture.detectChanges();
    expect(buttonDebugElement.nativeElement.classList.contains("tw-inline-block")).toBe(true);
    expect(linkDebugElement.nativeElement.classList.contains("tw-inline-block")).toBe(true);
    expect(buttonDebugElement.nativeElement.classList.contains("tw-block")).toBe(false);
    expect(linkDebugElement.nativeElement.classList.contains("tw-block")).toBe(false);
  });

  it("should not be disabled when loading and disabled are false", () => {
    testAppComponent.loading = false;
    testAppComponent.disabled = false;
    fixture.detectChanges();

    expect(buttonDebugElement.attributes["loading"]).toBeFalsy();
    expect(linkDebugElement.attributes["loading"]).toBeFalsy();
    expect(buttonDebugElement.nativeElement.disabled).toBeFalsy();
  });

  it("should be disabled when disabled is true", () => {
    testAppComponent.disabled = true;
    fixture.detectChanges();

    expect(buttonDebugElement.nativeElement.disabled).toBeTruthy();
    // Anchor tags cannot be disabled.
  });

  it("should be disabled when attribute disabled is true", () => {
    expect(disabledButtonDebugElement.nativeElement.disabled).toBeTruthy();
  });

  it("should be disabled when loading is true", () => {
    testAppComponent.loading = true;
    fixture.detectChanges();

    expect(buttonDebugElement.nativeElement.disabled).toBeTruthy();
  });
});

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
})
class TestApp {
  buttonType: string;
  block: boolean;
  disabled: boolean;
  loading: boolean;
}
