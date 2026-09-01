import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { PrivateAccessBannerComponent } from "./private-access-banner.component";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe("PrivateAccessBannerComponent", () => {
  let fixture: ComponentFixture<PrivateAccessBannerComponent>;
  let measuredHeight: jest.SpyInstance<DOMRect>;
  const i18nService = mock<I18nService>();

  const banner = () => fixture.debugElement.query(By.css("bit-banner"));
  const pill = () => fixture.debugElement.query(By.css("[data-testid='private-access-pill']"));
  const container = () => fixture.debugElement.query(By.css("[resizeObserver]"));
  const height = () =>
    document.documentElement.style.getPropertyValue("--private-access-banner-height");

  beforeEach(async () => {
    i18nService.t.mockImplementation((key) => key);
    measuredHeight = jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ height: 43.5 } as DOMRect);

    await TestBed.configureTestingModule({
      imports: [PrivateAccessBannerComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivateAccessBannerComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    jest.restoreAllMocks();
  });

  it("names the environment restriction in both the banner and the pill", () => {
    expect(banner().nativeElement.textContent).toContain("privateAccessBanner");
    expect(pill().nativeElement.textContent).toContain("privateAccessBanner");
  });

  it("offers a user guide link in both the banner and the pill", () => {
    const bannerLink = banner().query(By.css("a")).nativeElement as HTMLAnchorElement;
    const pillLink = pill().query(By.css("a")).nativeElement as HTMLAnchorElement;

    for (const link of [bannerLink, pillLink]) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.textContent).toContain("viewUserGuide");
    }
  });

  it("hides the banner form and shows the pill form at xl width, via Tailwind's xl: variant", () => {
    expect(banner().nativeElement.classList).toContain("xl:tw-hidden");
    expect(pill().nativeElement.classList).toContain("xl:tw-flex");
    expect(pill().nativeElement.classList).toContain("tw-hidden");
  });

  it("publishes its height for the app shell to subtract", () => {
    expect(height()).toBe("43.5px");
  });

  it("republishes when the measurement changes", () => {
    measuredHeight.mockReturnValue({ height: 0 } as DOMRect);
    container().triggerEventHandler("resize", {});

    expect(height()).toBe("0px");
  });

  it("leaves the property untouched when the measurement is unchanged", () => {
    const setProperty = jest.spyOn(document.documentElement.style, "setProperty");
    container().triggerEventHandler("resize", {});

    expect(setProperty).not.toHaveBeenCalled();
  });

  it("stops claiming height once it is destroyed", () => {
    fixture.destroy();

    expect(height()).toBe("");
  });

  it("offers no way to dismiss it", () => {
    expect(fixture.debugElement.query(By.css("button"))).toBeNull();
  });
});
