import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { HealthScanningComponent } from "./health-scanning.component";

describe("HealthScanningComponent", () => {
  let fixture: ComponentFixture<HealthScanningComponent>;

  beforeEach(async () => {
    jest.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [HealthScanningComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(HealthScanningComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Destroying the fixture clears the component's interval; without this the
    // timer keeps ticking across tests.
    fixture.destroy();
    jest.useRealTimers();
  });

  it("renders the scanning heading and description", () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain("scanningYourVault");
    expect(text).toContain("scanningYourVaultDescription");
  });

  it("exposes the progress as a polite live region", () => {
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
  });

  it("renders a progress bar", () => {
    expect(fixture.nativeElement.querySelector("bit-progress-bar")).not.toBeNull();
  });

  it("advances the indicator while the scan runs", () => {
    const width = () =>
      parseFloat(fixture.nativeElement.querySelector('[role="progressbar"]').style.width) || 0;
    const before = width();

    jest.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(width()).toBeGreaterThan(before);
  });

  it("never reaches 100, because the view is replaced rather than completed", () => {
    // The indicator is animated, not driven by real progress, so it must not
    // claim the scan finished. The root swaps this view out on completion.
    jest.advanceTimersByTime(120000);
    fixture.detectChanges();

    const width = parseFloat(
      fixture.nativeElement.querySelector('[role="progressbar"]').style.width,
    );

    expect(width).toBeLessThan(100);
  });

  it("announces the heading once, not twice", () => {
    // The heading is projected into the bar's label slot. Left unprojected, the
    // bar renders its own sr-only copy of accessibleName, and this polite live
    // region would then announce the same phrase twice.
    const occurrences = (fixture.nativeElement.textContent.match(/scanningYourVault(?!D)/g) ?? [])
      .length;

    expect(occurrences).toBe(1);
  });

  it("names the progress bar from the projected heading", () => {
    const bar = fixture.nativeElement.querySelector('[role="progressbar"]');
    const labelledBy = bar.getAttribute("aria-labelledby");

    expect(labelledBy).toBeTruthy();
    expect(fixture.nativeElement.querySelector(`#${labelledBy}`).textContent).toContain(
      "scanningYourVault",
    );
  });

  it("does not announce a percentage to assistive technology", () => {
    // The percentage is animated rather than real, so the bar announces its
    // status instead of a misleading number.
    const bar = fixture.nativeElement.querySelector('[role="progressbar"]');

    expect(bar.getAttribute("aria-valuetext")).toBe("scanInProgress");
  });

  it("gives the progress bar a value distinct from its name", () => {
    // A screen reader announces the bar's name and then its value. Reusing the
    // heading as the value would speak the same phrase twice, which is the same
    // duplication the projected label above removed from the DOM.
    const bar = fixture.nativeElement.querySelector('[role="progressbar"]');
    const name = fixture.nativeElement.querySelector(
      `#${bar.getAttribute("aria-labelledby")}`,
    ).textContent;

    expect(bar.getAttribute("aria-valuetext")).not.toBe(name.trim());
  });
});
