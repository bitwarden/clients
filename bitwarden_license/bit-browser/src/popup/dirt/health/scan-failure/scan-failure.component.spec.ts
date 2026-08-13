import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ScanFailureComponent } from "./scan-failure.component";

describe("ScanFailureComponent", () => {
  let fixture: ComponentFixture<ScanFailureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScanFailureComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(ScanFailureComponent);
    fixture.detectChanges();
  });

  it("renders the scan failure state", () => {
    expect(fixture.nativeElement.querySelector('[data-testid="scan-failure"]')).not.toBeNull();
  });

  it("announces the failure to screen readers", () => {
    const view = fixture.nativeElement.querySelector('[data-testid="scan-failure"]');

    expect(view.getAttribute("role")).toBe("alert");
  });

  it("shows the failure title and description", () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain("healthScanFailed");
    expect(text).toContain("healthScanFailedDesc");
  });

  it("offers no retry control, because the scan re-runs on the next Health tab open", () => {
    expect(fixture.nativeElement.querySelector("button")).toBeNull();
  });
});
