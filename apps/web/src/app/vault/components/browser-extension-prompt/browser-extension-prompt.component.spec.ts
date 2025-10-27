import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  BrowserExtensionPromptService,
  BrowserPromptState,
} from "../../services/browser-extension-prompt.service";

import { BrowserExtensionPromptComponent } from "./browser-extension-prompt.component";

describe("BrowserExtensionPromptComponent", () => {
  let fixture: ComponentFixture<BrowserExtensionPromptComponent>;
  let component: BrowserExtensionPromptComponent;
  const start = jest.fn();
  const openExtension = jest.fn();
  const registerPopupUrl = jest.fn();
  const pageState$ = new BehaviorSubject<BrowserPromptState>(BrowserPromptState.Loading);
  const setAttribute = jest.fn();
  const getAttribute = jest.fn().mockReturnValue("width=1010");

  beforeEach(async () => {
    start.mockClear();
    openExtension.mockClear();
    registerPopupUrl.mockClear();
    setAttribute.mockClear();
    getAttribute.mockClear();

    // Store original querySelector
    const originalQuerySelector = document.querySelector.bind(document);

    // Mock querySelector while preserving the document context
    jest.spyOn(document, "querySelector").mockImplementation(function (selector) {
      if (selector === 'meta[name="viewport"]') {
        return { setAttribute, getAttribute } as unknown as HTMLMetaElement;
      }
      return originalQuerySelector.call(document, selector);
    });

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: BrowserExtensionPromptService,
          useValue: { start, openExtension, registerPopupUrl, pageState$ },
        },
        {
          provide: I18nService,
          useValue: { t: (key: string) => key },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of({
              get: (key: string) => null,
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BrowserExtensionPromptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    it("opens extension on button click", () => {
      const button = fixture.debugElement.query(By.css("button")).nativeElement;

      button.click();

      expect(openExtension).toHaveBeenCalledTimes(1);
      expect(openExtension).toHaveBeenCalledWith("openAtRiskPasswords", true);
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

    it("sets min-width on the body", () => {
      expect(document.body.style.minWidth).toBe("auto");
    });

    it("stores viewport content", () => {
      expect(getAttribute).toHaveBeenCalledWith("content");
      expect(component["viewportContent"]).toBe("width=1010");
    });

    it("sets viewport meta tag to be mobile friendly", () => {
      expect(setAttribute).toHaveBeenCalledWith("content", "width=device-width, initial-scale=1.0");
    });

    describe("on destroy", () => {
      beforeEach(() => {
        fixture.destroy();
      });

      it("resets body min-width", () => {
        expect(document.body.style.minWidth).toBe("");
      });

      it("resets viewport meta tag", () => {
        expect(setAttribute).toHaveBeenCalledWith("content", "width=1010");
      });
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
