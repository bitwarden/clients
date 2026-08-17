import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { HealthScanErrorComponent } from "./health-scan-error.component";

describe("HealthScanErrorComponent", () => {
  let fixture: ComponentFixture<HealthScanErrorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthScanErrorComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(HealthScanErrorComponent);
    fixture.detectChanges();
  });

  it("renders the failure heading and description", () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain("healthScanFailed");
    expect(text).toContain("healthScanFailedDescription");
  });

  it("renders the illustration decoratively", () => {
    // The heading carries the announcement; the artwork must not add a second one.
    const svg = fixture.nativeElement.querySelector("bit-svg");

    expect(svg).not.toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("announces the failure assertively", () => {
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});
