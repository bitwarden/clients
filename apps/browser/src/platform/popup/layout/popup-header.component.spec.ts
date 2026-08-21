import { ChangeDetectionStrategy, Component, ElementRef, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BitIconButtonComponent,
  I18nMockService,
  ScrollLayoutService,
} from "@bitwarden/components";

import { PopupRouterCacheService } from "../view-cache/popup-router-cache.service";

import { PopupHeaderComponent } from "./popup-header.component";
import { PopupPageComponent } from "./popup-page.component";

@Component({
  template: `
    <popup-header
      [pageTitle]="pageTitle()"
      [showBackButton]="showBackButton()"
      [hideTitleBar]="hideTitleBar()"
    >
      <span data-testid="default">Default content</span>
      <span slot="title-start" data-testid="title-start">Icon tile</span>
      <span slot="end" data-testid="end">Pop out</span>
      <span slot="title-end" data-testid="title-end">3 Sends</span>
      <span slot="title-suffix" data-testid="title-suffix">Switch vault</span>
    </popup-header>
  `,
  imports: [PopupHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly pageTitle = signal("Send");
  readonly showBackButton = signal(false);
  readonly hideTitleBar = signal(false);
}

/**
 * Stands in for the scroll region that `popup-page` marks with `bitScrollLayoutHost`. jsdom reports
 * `0` for every layout measurement, so the scroll geometry has to be stubbed.
 */
const createScrollable = (scrollHeight = 1000, clientHeight = 500) => {
  const element = document.createElement("div");

  Object.defineProperty(element, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: clientHeight, configurable: true });

  return element;
};

describe("PopupHeaderComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let scrollable: HTMLElement;
  const vfo1Enabled = new BehaviorSubject<boolean>(false);

  /** The branded app bar only exists in the v2 template. */
  const appBar = () => fixture.nativeElement.querySelector("[data-testid=app-bar]");
  const titleBar = (): HTMLElement =>
    fixture.nativeElement.querySelector("[data-testid=title-bar]");
  const banners = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll("header"));
  const slot = (testId: string) => fixture.nativeElement.querySelector(`[data-testid=${testId}]`);

  /** Scrolls the region and settles the resulting signal update, which arrives a frame later. */
  const scrollTo = async (top: number) => {
    scrollable.scrollTop = top;
    scrollable.dispatchEvent(new Event("scroll"));

    await new Promise((resolve) => requestAnimationFrame(resolve));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    vfo1Enabled.next(false);

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => vfo1Enabled } },
        { provide: PopupPageComponent, useValue: { isScrolled: signal(false) } },
        { provide: PopupRouterCacheService, useValue: { back: jest.fn() } },
        {
          provide: I18nService,
          useValue: new I18nMockService({ back: "Back", appLogoLabel: "Bitwarden" }),
        },
      ],
    }).compileComponents();

    scrollable = createScrollable();
    TestBed.inject(ScrollLayoutService).scrollableRef.set(new ElementRef(scrollable));

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  /**
   * The bars are containers, not landmarks. A second `header` would announce a second banner, and
   * moving the landmark onto a bar would lose it entirely in whichever flag state omits that bar.
   */
  it.each([false, true])(
    "exposes one banner landmark around both bars (flag on: %s)",
    (enabled) => {
      vfo1Enabled.next(enabled);
      fixture.detectChanges();

      expect(banners()).toHaveLength(1);
      expect(banners()[0].contains(titleBar())).toBe(true);

      if (enabled) {
        expect(banners()[0].contains(appBar())).toBe(true);
      }
    },
  );

  it("reads the VFO1 flag", () => {
    const configService = TestBed.inject(ConfigService);
    const getFeatureFlag$ = jest.spyOn(configService, "getFeatureFlag$");

    TestBed.createComponent(TestHostComponent).detectChanges();

    expect(getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.VFO1Foundation);
  });

  describe("when the flag is off", () => {
    it("renders a single bar with no logo", () => {
      expect(appBar()).toBeNull();
      expect(fixture.nativeElement.querySelector("bit-svg")).toBeNull();
    });

    it("renders the title", () => {
      expect(fixture.nativeElement.querySelector("h1").textContent).toContain("Send");
    });

    it("drops title bar content that only the v2 template renders", () => {
      expect(slot("title-end")).toBeNull();
    });

    it("renders default content alongside the title", () => {
      expect(slot("default")).not.toBeNull();
    });

    it("renders the end slot in the title bar, the only bar there is", () => {
      expect(titleBar().contains(slot("end"))).toBe(true);
    });

    it("renders the title-suffix slot, which the flag does not gate", () => {
      expect(titleBar().contains(slot("title-suffix"))).toBe(true);
    });
  });

  describe("when the flag is on", () => {
    beforeEach(() => {
      vfo1Enabled.next(true);
      fixture.detectChanges();
    });

    it("renders the logo in the app bar", () => {
      expect(appBar()).not.toBeNull();
      expect(appBar().querySelector("bit-svg")).not.toBeNull();
    });

    it("moves the end slot to the app bar", () => {
      expect(appBar().contains(slot("end"))).toBe(true);
      expect(titleBar().contains(slot("end"))).toBe(false);
    });

    it("renders the title-start, title-end, and title-suffix slots in the title bar", () => {
      expect(titleBar().contains(slot("title-start"))).toBe(true);
      expect(titleBar().contains(slot("title-end"))).toBe(true);
      expect(titleBar().contains(slot("title-suffix"))).toBe(true);
    });

    /**
     * Both slots have to resolve at once. Relocating `end` with a second
     * `<ng-content select="[slot=end]">` instead of a template outlet would leave one of them empty.
     */
    it("renders the end and title-end slots simultaneously", () => {
      expect(slot("end")).not.toBeNull();
      expect(slot("title-end")).not.toBeNull();
    });

    it("renders the title instead of default content", () => {
      expect(fixture.nativeElement.querySelector("h1").textContent).toContain("Send");
      expect(slot("default")).toBeNull();
    });

    /**
     * The app bar owns the branding, so a page that used the default slot to project its own logo
     * would render it twice. Dropping the slot outright is what keeps that from happening.
     */
    it("drops default content even when there is no title", () => {
      fixture.componentInstance.pageTitle.set("");
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("h1")).toBeNull();
      expect(slot("default")).toBeNull();
    });
  });

  /**
   * The bar publishes its own state on `data-state`, so these specs never read the classes that
   * implement it. The collapse itself is CSS — a `focus-within` reveal and a transition — and jsdom
   * computes no styles, so that part is left to manual verification.
   */
  describe("title bar visibility", () => {
    const collapsed = () => titleBar().dataset.state === "collapsed";

    describe("when the flag is on", () => {
      beforeEach(() => {
        vfo1Enabled.next(true);
        fixture.detectChanges();
      });

      it("shows the title bar before any scrolling", () => {
        expect(collapsed()).toBe(false);
      });

      it("hides the title bar when scrolling down", async () => {
        await scrollTo(200);

        expect(collapsed()).toBe(true);
      });

      it("keeps the app bar while the title bar collapses", async () => {
        await scrollTo(200);

        expect(collapsed()).toBe(true);
        expect(appBar()).not.toBeNull();
      });

      it("shows the title bar again when scrolling back up", async () => {
        await scrollTo(200);
        expect(collapsed()).toBe(true);

        await scrollTo(150);

        expect(collapsed()).toBe(false);
      });

      it("shows the title bar when there is no scroll host", async () => {
        TestBed.inject(ScrollLayoutService).scrollableRef.set(null);

        await scrollTo(200);

        expect(collapsed()).toBe(false);
      });
    });

    it("does not hide the title bar when the flag is off", async () => {
      await scrollTo(200);

      expect(collapsed()).toBe(false);
    });
  });

  describe("back button", () => {
    it.each([false, true])("is hidden without showBackButton (flag on: %s)", (enabled) => {
      vfo1Enabled.next(enabled);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("button[bitIconButton]")).toBeNull();
    });

    it.each([false, true])("is shown with showBackButton (flag on: %s)", (enabled) => {
      vfo1Enabled.next(enabled);
      fixture.componentInstance.showBackButton.set(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("button[bitIconButton]")).not.toBeNull();
    });

    /** The one-bar header keeps `main`'s default button; the two-bar header sizes it down. */
    it.each<[boolean, string]>([
      [false, "default"],
      [true, "small"],
    ])("sizes the button for the bar it sits in (flag on: %s)", (enabled, size) => {
      vfo1Enabled.next(enabled);
      fixture.componentInstance.showBackButton.set(true);
      fixture.detectChanges();

      const button = fixture.debugElement
        .query(By.directive(BitIconButtonComponent))
        .injector.get(BitIconButtonComponent);

      expect(button.size()).toBe(size);
    });
  });

  describe("hideTitleBar", () => {
    const backButtons = (): HTMLElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll("button[bitIconButton]"));

    /** The variant asked of the component, rather than the classes it resolves that variant into. */
    const backButtonType = () =>
      fixture.debugElement
        .query(By.directive(BitIconButtonComponent))
        .injector.get(BitIconButtonComponent)
        .buttonType();

    /**
     * The bar keeps its element so the `end` slot's projected content survives — destroying it
     * would take that content with it — so "hidden" here means hidden, not absent.
     */
    const suppressed = () => titleBar().dataset.state === "suppressed";

    describe("when the flag is on", () => {
      beforeEach(() => {
        vfo1Enabled.next(true);
        fixture.componentInstance.hideTitleBar.set(true);
        fixture.detectChanges();
      });

      it("hides the title bar and keeps the app bar", () => {
        expect(suppressed()).toBe(true);
        expect(appBar()).not.toBeNull();
        expect(banners()).toHaveLength(1);
      });

      it("renders the back button once, in the app bar", () => {
        fixture.componentInstance.showBackButton.set(true);
        fixture.detectChanges();

        expect(backButtons()).toHaveLength(1);
        expect(appBar().contains(backButtons()[0])).toBe(true);
      });

      /** The default ghost styling is illegible against the app bar's nav background. */
      it("styles the back button for the nav background", () => {
        fixture.componentInstance.showBackButton.set(true);
        fixture.detectChanges();

        expect(backButtonType()).toBe("side-nav");
      });

      it("renders no back button without showBackButton", () => {
        expect(backButtons()).toHaveLength(0);
      });

      it("keeps the end slot in the app bar", () => {
        expect(appBar().contains(slot("end"))).toBe(true);
      });

      /** `data-state` holds one value, so staying `suppressed` is also proof it never collapsed. */
      it("stays hidden through a scroll that would otherwise collapse the bar", async () => {
        await scrollTo(200);

        expect(suppressed()).toBe(true);
      });
    });

    it("does nothing when the flag is off", () => {
      fixture.componentInstance.hideTitleBar.set(true);
      fixture.componentInstance.showBackButton.set(true);
      fixture.detectChanges();

      expect(suppressed()).toBe(false);
      expect(titleBar().contains(backButtons()[0])).toBe(true);
      expect(backButtonType()).toBe("primaryGhost");
    });
  });
});
