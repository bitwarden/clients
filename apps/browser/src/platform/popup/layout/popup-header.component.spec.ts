import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { PopupRouterCacheService } from "../view-cache/popup-router-cache.service";

import { PopupHeaderComponent } from "./popup-header.component";
import { PopupPageComponent } from "./popup-page.component";

@Component({
  template: `
    <popup-header [pageTitle]="pageTitle()" [showBackButton]="showBackButton()">
      <span data-testid="default">Default content</span>
      <span slot="badge" data-testid="badge">Beta</span>
      <span slot="app-actions" data-testid="app-actions">Pop out</span>
      <span slot="start" data-testid="start">Icon tile</span>
      <span slot="end" data-testid="end">3 Sends</span>
    </popup-header>
  `,
  imports: [PopupHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly pageTitle = signal("Send");
  readonly showBackButton = signal(false);
}

describe("PopupHeaderComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  const vfo1Enabled = new BehaviorSubject<boolean>(false);

  /** The branded app bar only exists in the v2 template. */
  const appBar = () => fixture.nativeElement.querySelector("[data-testid=app-bar]");
  const slot = (testId: string) => fixture.nativeElement.querySelector(`[data-testid=${testId}]`);

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

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

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

    it("drops app bar content, which has nowhere to render", () => {
      expect(slot("badge")).toBeNull();
      expect(slot("app-actions")).toBeNull();
    });

    it("renders default content alongside the title", () => {
      expect(slot("default")).not.toBeNull();
    });

    it("renders the end slot", () => {
      expect(slot("end")).not.toBeNull();
    });
  });

  describe("when the flag is on", () => {
    beforeEach(() => {
      vfo1Enabled.next(true);
      fixture.detectChanges();
    });

    it("renders the logo and badge in the app bar", () => {
      expect(appBar()).not.toBeNull();
      expect(appBar().querySelector("bit-svg")).not.toBeNull();
      expect(appBar().contains(slot("badge"))).toBe(true);
    });

    it("renders app-actions in the app bar rather than the title bar", () => {
      expect(appBar().contains(slot("app-actions"))).toBe(true);
      expect(appBar().contains(slot("end"))).toBe(false);
    });

    it("renders the start slot and the end slot in the title bar", () => {
      expect(slot("start")).not.toBeNull();
      expect(slot("end")).not.toBeNull();
      expect(appBar().contains(slot("start"))).toBe(false);
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
