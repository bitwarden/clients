import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { RouterModule } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { TOOLTIP_DELAY_MS } from "../tooltip";
import { I18nMockService } from "../utils/i18n-mock.service";
import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { NavItemComponent } from "./nav-item.component";
import { SideNavService } from "./side-nav.service";

@Component({
  imports: [NavItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (withRoute) {
      <bit-nav-item text="Reports" icon="bwi-bar-chart" route="reports"></bit-nav-item>
    } @else {
      <bit-nav-item text="Reports" icon="bwi-bar-chart"></bit-nav-item>
    }
  `,
})
class HostComponent {
  withRoute = true;
}

/**
 * Collapsed nav items hide their text label, so the tooltip is the only thing naming them. It
 * replaced a native `title`, which never appeared on keyboard focus — hence the focus coverage.
 */
describe("NavItemComponent tooltip (vfo1)", () => {
  let fixture: ComponentFixture<HostComponent>;
  let sideNavService: SideNavService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, RouterModule.forRoot([])],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({ submenu: "submenu" }),
        },
        { provide: GlobalStateProvider, useClass: StorybookGlobalStateProvider },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: () => new BehaviorSubject<boolean>(true).asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    sideNavService = TestBed.inject(SideNavService);
    sideNavService.version.set("vfo1");
  });

  afterEach(() => {
    // The overlay lives on document.body, outside the fixture, so it must be torn down explicitly.
    document.querySelectorAll(".cdk-overlay-container").forEach((el) => el.remove());
  });

  const interactiveEl = () =>
    fixture.debugElement.query(By.css("[data-testid='nav-item-interactive']"))
      .nativeElement as HTMLElement;

  const contentWrapper = () =>
    fixture.debugElement.query(By.css("[data-testid='nav-item-interactive'] > div"))
      .nativeElement as HTMLElement;

  const visibleTooltip = () => document.querySelector("[role='tooltip']");

  /** Hover and wait out the show delay. */
  const hover = (el: HTMLElement) => {
    el.dispatchEvent(new MouseEvent("mouseenter"));
    tick(TOOLTIP_DELAY_MS);
    fixture.detectChanges();
  };

  describe.each([
    ["anchor", true],
    ["button", false],
  ])("as an %s", (_name, withRoute) => {
    beforeEach(() => {
      fixture.componentInstance.withRoute = withRoute;
    });

    it("shows the item text on hover when collapsed", fakeAsync(() => {
      sideNavService.open.set(false);
      fixture.detectChanges();

      hover(interactiveEl());

      expect(visibleTooltip()).not.toBeNull();
      expect(visibleTooltip()!.textContent).toContain("Reports");
    }));

    it("shows the item text on keyboard focus when collapsed", fakeAsync(() => {
      sideNavService.open.set(false);
      fixture.detectChanges();

      const el = interactiveEl();
      // JSDOM does not implement :focus-visible, which the directive gates focus display on.
      const originalMatches = el.matches.bind(el);
      el.matches = jest.fn((selector: string) =>
        selector === ":focus-visible" ? true : originalMatches(selector),
      );

      el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      tick(TOOLTIP_DELAY_MS);
      fixture.detectChanges();

      expect(visibleTooltip()).not.toBeNull();
      expect(visibleTooltip()!.textContent).toContain("Reports");
    }));

    it("renders no tooltip on hover when open", fakeAsync(() => {
      sideNavService.open.set(true);
      fixture.detectChanges();

      hover(interactiveEl());

      expect(visibleTooltip()).toBeNull();
    }));

    it("drops the native title when collapsed so only one tooltip shows", () => {
      sideNavService.open.set(false);
      fixture.detectChanges();

      expect(contentWrapper().hasAttribute("title")).toBe(false);
    });

    it("keeps the native title when open, for truncated labels", () => {
      sideNavService.open.set(true);
      fixture.detectChanges();

      expect(contentWrapper().getAttribute("title")).toBe("Reports");
    });
  });
});

describe("NavItemComponent tooltip (default version)", () => {
  let fixture: ComponentFixture<HostComponent>;
  let sideNavService: SideNavService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, RouterModule.forRoot([])],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({ submenu: "submenu" }),
        },
        { provide: GlobalStateProvider, useClass: StorybookGlobalStateProvider },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: () => new BehaviorSubject<boolean>(false).asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    sideNavService = TestBed.inject(SideNavService);
  });

  afterEach(() => {
    document.querySelectorAll(".cdk-overlay-container").forEach((el) => el.remove());
  });

  it("is unchanged — native title only, no tooltip", fakeAsync(() => {
    sideNavService.open.set(false);
    fixture.detectChanges();

    const el = fixture.debugElement.query(By.css("[data-testid='nav-item-interactive']"))
      .nativeElement as HTMLElement;
    el.dispatchEvent(new MouseEvent("mouseenter"));
    tick(TOOLTIP_DELAY_MS);
    fixture.detectChanges();

    expect(document.querySelector("[role='tooltip']")).toBeNull();
    expect(el.querySelector("div")!.getAttribute("title")).toBe("Reports");
  }));
});
