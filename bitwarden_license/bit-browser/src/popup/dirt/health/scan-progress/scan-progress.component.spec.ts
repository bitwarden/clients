import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ScanProgressComponent } from "./scan-progress.component";

describe("ScanProgressComponent", () => {
  let fixture: ComponentFixture<ScanProgressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScanProgressComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(ScanProgressComponent);
    fixture.detectChanges();
  });

  it("renders the scan progress view", () => {
    expect(fixture.nativeElement.querySelector('[data-testid="scan-progress"]')).not.toBeNull();
  });

  it("announces progress to screen readers", () => {
    const view = fixture.nativeElement.querySelector('[data-testid="scan-progress"]');

    expect(view.getAttribute("role")).toBe("status");
  });

  it("shows a spinner with the scanning title and description", () => {
    const text = fixture.nativeElement.textContent;

    expect(fixture.nativeElement.querySelector("bit-spinner-lockup")).not.toBeNull();
    expect(text).toContain("healthScanInProgress");
    expect(text).toContain("healthScanInProgressDesc");
  });
});
