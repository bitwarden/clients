import { ChangeDetectionStrategy, Component, ElementRef, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService, ScrollLayoutService } from "@bitwarden/components";

import { PopupRouterCacheService } from "../view-cache/popup-router-cache.service";

import { PopupHeaderComponent } from "./popup-header.component";

@Component({
  template: `
    <popup-header [pageTitle]="pageTitle()" [showBackButton]="showBackButton()">
      <span data-testid="default">Default content</span>
      <span slot="start" data-testid="start">Icon tile</span>
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

    it("renders the start, title-end, and title-suffix slots in the title bar", () => {
      expect(titleBar().contains(slot("start"))).toBe(true);
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

    it("renders default content when there is no title", () => {
      fixture.componentInstance.pageTitle.set("");
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("h1")).toBeNull();
      expect(slot("default")).not.toBeNull();
    });
  });

  describe("title bar visibility", () => {
    const collapsed = () => titleBar().classList.contains("!tw-max-h-0");

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

        expect(titleBar().className).toContain("!tw-max-h-0");
        expect(titleBar().className).toContain("!tw-py-0");
      });

      it("keeps the hidden title bar reachable by keyboard", async () => {
        await scrollTo(200);

        expect(titleBar().className).toContain("focus-within:!tw-max-h-24");
      });

      it("keeps the app bar pinned while the title bar is hidden", async () => {
        const before = appBar().className;

        await scrollTo(200);

        expect(collapsed()).toBe(true);
        expect(appBar().className).toBe(before);
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
  });
});
