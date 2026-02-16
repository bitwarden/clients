import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils";

import { SpinnerLockupComponent } from "./spinner-lockup.component";

describe("SpinnerLockupComponent", () => {
  let component: SpinnerLockupComponent;
  let fixture: ComponentFixture<SpinnerLockupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpinnerLockupComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({ loading: "Loading" }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpinnerLockupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("Render Tests", () => {
    it("create", () => {
      expect(component).toBeTruthy();
    });

    it("render with default layout (horizontal)", () => {
      const container = fixture.nativeElement.querySelector("div");

      expect(container.classList.contains("tw-flex-row")).toBe(true);
      expect(container.classList.contains("tw-items-center")).toBe(true);
      expect(container.classList.contains("tw-gap-3")).toBe(true);
    });

    it("pass variant to nested spinner", () => {
      fixture.componentRef.setInput("variant", "danger");
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector("bit-spinner");
      expect(spinner).toBeTruthy();
    });

    it("pass size to nested spinner", () => {
      fixture.componentRef.setInput("size", "lg");
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector("bit-spinner");
      expect(spinner).toBeTruthy();
    });
  });

  describe("Accessibility Tests", () => {
    it("apply correct font weight to title", () => {
      const titleSpan = fixture.nativeElement.querySelector("span");

      expect(titleSpan.classList.contains("tw-font-medium")).toBe(true);
    });

    it("apply correct font weight to body", () => {
      const bodySpan = fixture.nativeElement.querySelectorAll("span")[1];

      expect(bodySpan.classList.contains("tw-font-normal")).toBe(true);
    });

    it("apply correct text color to title", () => {
      const titleSpan = fixture.nativeElement.querySelector("span");

      expect(titleSpan.classList.contains("tw-text-fg-heading")).toBe(true);
    });

    it("apply correct text color to body", () => {
      const bodySpan = fixture.nativeElement.querySelectorAll("span")[1];

      expect(bodySpan.classList.contains("tw-text-fg-body")).toBe(true);
    });
  });
});

describe("SpinnerLockupComponent Content Projection", () => {
  @Component({
    template: `
      <bit-spinner-lockup>
        <span title>{{ titleText }}</span>
        <span body>{{ bodyText }}</span>
      </bit-spinner-lockup>
    `,
    imports: [SpinnerLockupComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class TestWrapperComponent {
    titleText = "Loading data";
    bodyText = "Please wait";
  }

  let wrapperFixture: ComponentFixture<TestWrapperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestWrapperComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({ loading: "Loading" }),
        },
      ],
    }).compileComponents();

    wrapperFixture = TestBed.createComponent(TestWrapperComponent);
    wrapperFixture.detectChanges();
  });

  it("project title content", () => {
    const titleSpan = wrapperFixture.nativeElement.querySelector("[title]");
    expect(titleSpan.textContent).toContain("Loading data");
  });

  it("project body content", () => {
    const bodySpan = wrapperFixture.nativeElement.querySelector("[body]");
    expect(bodySpan.textContent).toContain("Please wait");
  });

  it("project both title and body content", () => {
    expect(wrapperFixture.nativeElement.textContent).toContain("Loading data");
    expect(wrapperFixture.nativeElement.textContent).toContain("Please wait");
  });

  it("handle empty content slots gracefully", () => {
    wrapperFixture.componentInstance.titleText = "";
    wrapperFixture.componentInstance.bodyText = "";
    wrapperFixture.detectChanges();

    const spans = wrapperFixture.nativeElement.querySelectorAll("span");
    expect(spans.length).toBeGreaterThan(0);
  });

  it("project rich HTML content", () => {
    @Component({
      template: `
        <bit-spinner-lockup>
          <span title><strong>Bold</strong> text</span>
          <span body>Body text</span>
        </bit-spinner-lockup>
      `,
      imports: [SpinnerLockupComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class RichContentWrapperComponent {}

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RichContentWrapperComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({ loading: "Loading" }),
        },
      ],
    });

    const richFixture = TestBed.createComponent(RichContentWrapperComponent);
    richFixture.detectChanges();

    expect(richFixture.nativeElement.querySelector("strong")).toBeTruthy();
    expect(richFixture.nativeElement.textContent).toContain("Bold text");
  });
});
