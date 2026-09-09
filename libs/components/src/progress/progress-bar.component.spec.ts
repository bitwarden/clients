import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ProgressBarComponent } from "./progress-bar.component";

describe("ProgressBarComponent", () => {
  let fixture: ComponentFixture<ProgressBarComponent>;

  const trackHeightClass = () =>
    fixture.nativeElement.querySelector('[role="progressbar"]').parentElement.className;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressBarComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProgressBarComponent);
  });

  it("defaults to the 8px size", () => {
    fixture.detectChanges();

    expect(trackHeightClass()).toContain("tw-h-2");
  });

  it("renders at 16px when size is md", () => {
    fixture.componentRef.setInput("size", "md");
    fixture.detectChanges();

    expect(trackHeightClass()).toContain("tw-h-4");
    expect(trackHeightClass()).not.toContain("tw-h-2");
  });
});
