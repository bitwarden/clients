import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  BrowserExtensionPromptService,
  BrowserPromptState,
} from "../../services/browser-extension-prompt.service";

import { BrowserExtensionPromptComponent } from "./browser-extension-prompt.component";

describe("BrowserExtensionPromptComponent", () => {
  let fixture: ComponentFixture<BrowserExtensionPromptComponent>;

  const start = jest.fn();
  const pageState$ = new BehaviorSubject(BrowserPromptState.Loading);

  beforeEach(async () => {
    start.mockClear();

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: BrowserExtensionPromptService,
          useValue: { start, pageState$ },
        },
        {
          provide: I18nService,
          useValue: { t: (key: string) => key },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BrowserExtensionPromptComponent);
    fixture.detectChanges();
  });

  it("calls start on initialization", () => {
    expect(start).toHaveBeenCalledTimes(1);
  });

  describe("loading state", () => {
    beforeEach(() => {
      pageState$.next(BrowserPromptState.Loading);
      fixture.detectChanges();
    });

    it("shows loading text", () => {
      const element = fixture.nativeElement;
      expect(element.textContent.trim()).toBe("openingExtension");
    });
  });

  describe("error state", () => {
    beforeEach(() => {
      pageState$.next(BrowserPromptState.Error);
      fixture.detectChanges();
    });

    it("shows error text", () => {
      const errorText = fixture.debugElement.query(By.css("p")).nativeElement;
      expect(errorText.textContent.trim()).toBe("openingExtensionError");
    });
  });

  describe("success state", () => {
    beforeEach(() => {
      pageState$.next(BrowserPromptState.Success);
      fixture.detectChanges();
    });

    it("shows success message", () => {
      const successText = fixture.debugElement.query(By.css("p")).nativeElement;
      expect(successText.textContent.trim()).toBe("openedExtensionViewAtRiskPasswords");
    });
  });

  describe("mobile state", () => {
    beforeEach(() => {
      pageState$.next(BrowserPromptState.MobileBrowser);
      fixture.detectChanges();
    });

    it("shows mobile message", () => {
      const mobileText = fixture.debugElement.query(By.css("p")).nativeElement;
      expect(mobileText.textContent.trim()).toBe("reopenLinkOnDesktop");
    });
  });

  describe("manual error state", () => {
    beforeEach(() => {
      pageState$.next(BrowserPromptState.ManualOpen);
      fixture.detectChanges();
    });

    it("shows manual open error message", () => {
      const manualText = fixture.debugElement.query(By.css("p")).nativeElement;
      expect(manualText.textContent.trim()).toContain("openExtensionManuallyPart1");
      expect(manualText.textContent.trim()).toContain("openExtensionManuallyPart2");
    });
  });
});
