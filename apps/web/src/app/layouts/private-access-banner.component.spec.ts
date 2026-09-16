import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  PrivateAccessBannerComponent,
  PrivateAccessBannerPlacement,
} from "./private-access-banner.component";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe("PrivateAccessBannerComponent", () => {
  let fixture: ComponentFixture<PrivateAccessBannerComponent>;
  let measuredHeight: jest.SpyInstance<DOMRect>;
  const i18nService = mock<I18nService>();

  const banner = (target = fixture) => target.debugElement.query(By.css("bit-banner"));
  const link = () => banner().query(By.css("a")).nativeElement as HTMLAnchorElement;
  const container = (target = fixture) => target.debugElement.query(By.css("[resizeObserver]"));
  const height = () =>
    document.documentElement.style.getPropertyValue("--private-access-banner-height");

  const createBanner = (placement: PrivateAccessBannerPlacement) => {
    const created = TestBed.createComponent(PrivateAccessBannerComponent);
    created.componentRef.setInput("placement", placement);
    created.detectChanges();
    return created;
  };

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
    document.documentElement.style.removeProperty("--private-access-banner-height");
    jest.restoreAllMocks();
  });

  it("names the environment restriction", () => {
    expect(banner().nativeElement.textContent).toContain("privateAccessBanner");
  });

  it("offers a user guide link", () => {
    expect(link().getAttribute("target")).toBe("_blank");
    expect(link().textContent).toContain("viewUserGuide");
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

  describe("inside a layout", () => {
    let layoutFixture: ComponentFixture<PrivateAccessBannerComponent>;

    beforeEach(() => {
      layoutFixture = createBanner("layout");
      fixture.detectChanges();
    });

    afterEach(() => {
      layoutFixture.destroy();
    });

    it("renders the banner in the layout", () => {
      expect(banner(layoutFixture)).not.toBeNull();
    });

    it("hides the app-level banner so only one is visible", () => {
      expect(banner()).toBeNull();
    });

    it("clears the height the app-level banner published", () => {
      expect(height()).toBe("");
    });

    it("does not publish a height of its own", () => {
      container(layoutFixture).triggerEventHandler("resize", {});

      expect(height()).toBe("");
    });

    it("brings the app-level banner back once the layout is gone", () => {
      layoutFixture.destroy();
      fixture.detectChanges();
      container().triggerEventHandler("resize", {});

      expect(banner()).not.toBeNull();
      expect(height()).toBe("43.5px");
    });

    it("keeps the app-level banner hidden while another layout banner remains", () => {
      const secondLayoutFixture = createBanner("layout");
      layoutFixture.destroy();
      fixture.detectChanges();

      expect(banner()).toBeNull();

      secondLayoutFixture.destroy();
    });
  });
});
