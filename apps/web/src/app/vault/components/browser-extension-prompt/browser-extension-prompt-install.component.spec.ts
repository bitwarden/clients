import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { BehaviorSubject } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import {
  BrowserExtensionPromptService,
  BrowserPromptState,
} from "../../services/browser-extension-prompt.service";

import { BrowserExtensionPromptInstallComponent } from "./browser-extension-prompt-install.component";

describe("BrowserExtensionInstallComponent", () => {
  let fixture: ComponentFixture<BrowserExtensionPromptInstallComponent>;
  let component: BrowserExtensionPromptInstallComponent;
  const pageState$ = new BehaviorSubject(BrowserPromptState.Loading);

  const getDevice = jest.fn();

  beforeEach(async () => {
    getDevice.mockClear();
    await TestBed.configureTestingModule({
      providers: [
        {
          provide: BrowserExtensionPromptService,
          useValue: { pageState$ },
        },
        {
          provide: I18nService,
          useValue: { t: (key: string) => key },
        },
        {
          provide: PlatformUtilsService,
          useValue: { getDevice },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BrowserExtensionPromptInstallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("only shows during error state", () => {
    expect(fixture.nativeElement.textContent).toBe("");

    pageState$.next(BrowserPromptState.Success);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toBe("");

    pageState$.next(BrowserPromptState.Error);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toBe("");

    pageState$.next(BrowserPromptState.ManualOpen);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toBe("");
  });

  describe("error state", () => {
    beforeEach(() => {
      pageState$.next(BrowserPromptState.Error);
      fixture.detectChanges();
    });

    it("shows error text", () => {
      const errorText = fixture.debugElement.query(By.css("p")).nativeElement;
      expect(errorText.textContent).toBe("doNotHaveExtension");
    });

    it("links to bitwarden installation page by default", () => {
      const link = fixture.debugElement.query(By.css("a")).nativeElement;

      expect(link.getAttribute("href")).toBe(
        "https://bitwarden.com/download/#downloads-web-browser",
      );
    });

    it("links to bitwarden installation page for Chrome", () => {
      getDevice.mockReturnValue(DeviceType.ChromeBrowser);
      component.ngOnInit();
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css("a")).nativeElement;

      expect(link.getAttribute("href")).toBe(
        "https://chrome.google.com/webstore/detail/bitwarden-password-manage/nngceckbapebfimnlniiiahkandclblb",
      );
    });

    it("links to bitwarden installation page for Firefox", () => {
      getDevice.mockReturnValue(DeviceType.FirefoxBrowser);
      component.ngOnInit();
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css("a")).nativeElement;

      expect(link.getAttribute("href")).toBe(
        "https://addons.mozilla.org/en-US/firefox/addon/bitwarden-password-manager/",
      );
    });

    it("links to bitwarden installation page for Safari", () => {
      getDevice.mockReturnValue(DeviceType.SafariBrowser);
      component.ngOnInit();
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css("a")).nativeElement;

      expect(link.getAttribute("href")).toBe(
        "https://apps.apple.com/us/app/bitwarden/id1352778147?mt=12",
      );
    });

    it("links to bitwarden installation page for Opera", () => {
      getDevice.mockReturnValue(DeviceType.OperaBrowser);
      component.ngOnInit();
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css("a")).nativeElement;

      expect(link.getAttribute("href")).toBe(
        "https://addons.opera.com/extensions/details/bitwarden-free-password-manager/",
      );
    });

    it("links to bitwarden installation page for Edge", () => {
      getDevice.mockReturnValue(DeviceType.EdgeBrowser);
      component.ngOnInit();
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css("a")).nativeElement;

      expect(link.getAttribute("href")).toBe(
        "https://microsoftedge.microsoft.com/addons/detail/jbkfoedolllekgbhcbcoahefnbanhhlh",
      );
    });
  });
});
