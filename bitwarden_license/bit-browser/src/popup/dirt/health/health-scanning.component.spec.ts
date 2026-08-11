import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { HealthScanningComponent } from "./health-scanning.component";

describe("HealthScanningComponent", () => {
  let fixture: ComponentFixture<HealthScanningComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthScanningComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(HealthScanningComponent);
    fixture.detectChanges();
  });

  it("renders the scanning heading and description", () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain("scanningYourVault");
    expect(text).toContain("scanningYourVaultDescription");
  });

  it("exposes the progress as a polite live region", () => {
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
  });

  it("hides the decorative spinner from assistive technology", () => {
    // bit-icon derives this from the absence of an ariaLabel, so the assertion
    // also pins that no one later gives the spinner its own announcement.
    const icon = fixture.nativeElement.querySelector("bit-icon");

    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });
});
