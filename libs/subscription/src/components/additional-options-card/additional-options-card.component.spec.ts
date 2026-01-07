import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { AdditionalOptionsCardComponent } from "@bitwarden/subscription";

describe("AdditionalOptionsCardComponent", () => {
  let component: AdditionalOptionsCardComponent;
  let fixture: ComponentFixture<AdditionalOptionsCardComponent>;
  let i18nService: jest.Mocked<I18nService>;

  beforeEach(async () => {
    i18nService = {
      t: jest.fn((key: string) => {
        const translations: Record<string, string> = {
          additionalOptions: "Additional options",
          additionalOptionsDesc:
            "For additional help in managing your subscription, please contact Customer Support.",
          downloadLicense: "Download license",
          cancelSubscription: "Cancel subscription",
        };
        return translations[key] || key;
      }),
    } as any;

    await TestBed.configureTestingModule({
      imports: [AdditionalOptionsCardComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdditionalOptionsCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("rendering", () => {
    it("should display the title", () => {
      const title = fixture.debugElement.query(By.css("h3"));
      expect(title.nativeElement.textContent.trim()).toBe("Additional options");
    });

    it("should display the description", () => {
      const description = fixture.debugElement.query(By.css("p"));
      expect(description.nativeElement.textContent.trim()).toContain(
        "For additional help in managing your subscription",
      );
    });

    it("should render both action buttons", () => {
      const buttons = fixture.debugElement.queryAll(By.css("button"));
      expect(buttons.length).toBe(2);
    });

    it("should render download license button with correct text", () => {
      const buttons = fixture.debugElement.queryAll(By.css("button"));
      expect(buttons[0].nativeElement.textContent.trim()).toBe("Download license");
    });

    it("should render cancel subscription button with correct text", () => {
      const buttons = fixture.debugElement.queryAll(By.css("button"));
      expect(buttons[1].nativeElement.textContent.trim()).toBe("Cancel subscription");
    });
  });

  describe("callsToActionDisabled", () => {
    it("should disable both buttons when callsToActionDisabled is true", () => {
      fixture.componentRef.setInput("callsToActionDisabled", true);
      fixture.detectChanges();

      const buttons = fixture.debugElement.queryAll(By.css("button"));
      expect(buttons[0].attributes["aria-disabled"]).toBe("true");
      expect(buttons[1].attributes["aria-disabled"]).toBe("true");
    });

    it("should enable both buttons when callsToActionDisabled is false", () => {
      fixture.componentRef.setInput("callsToActionDisabled", false);
      fixture.detectChanges();

      const buttons = fixture.debugElement.queryAll(By.css("button"));
      expect(buttons[0].nativeElement.disabled).toBe(false);
      expect(buttons[1].nativeElement.disabled).toBe(false);
    });

    it("should enable both buttons by default", () => {
      const buttons = fixture.debugElement.queryAll(By.css("button"));
      expect(buttons[0].nativeElement.disabled).toBe(false);
      expect(buttons[1].nativeElement.disabled).toBe(false);
    });
  });

  describe("button click events", () => {
    it("should emit download-license action when download button is clicked", () => {
      const emitSpy = jest.spyOn(component.callToActionClicked, "emit");

      const buttons = fixture.debugElement.queryAll(By.css("button"));
      buttons[0].triggerEventHandler("click", { button: 0 });
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith("download-license");
    });

    it("should emit cancel-subscription action when cancel button is clicked", () => {
      const emitSpy = jest.spyOn(component.callToActionClicked, "emit");

      const buttons = fixture.debugElement.queryAll(By.css("button"));
      buttons[1].triggerEventHandler("click", { button: 0 });
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith("cancel-subscription");
    });
  });
});
