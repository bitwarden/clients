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

  it("announces the failure assertively", () => {
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("does not offer a rescan control", () => {
    // The scan runs on every Health tab open, so reopening the tab is the retry
    // path and there is deliberately no manual rescan.
    expect(fixture.nativeElement.querySelector("button")).toBeNull();
  });
});
