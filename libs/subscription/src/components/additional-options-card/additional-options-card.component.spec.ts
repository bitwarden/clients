import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { AdditionalOptionsCardComponent } from "@bitwarden/subscription";

describe("AdditionalOptionsCardComponent", () => {
  let component: AdditionalOptionsCardComponent;
  let fixture: ComponentFixture<AdditionalOptionsCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdditionalOptionsCardComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => {
              const translations: Record<string, string> = {
                additionalOptions: "Additional options",
                additionalOptionsDescription:
                  "For additional help managing your subscription, please contact Customer Support",
                downloadLicense: "Download license",
                cancelSubscription: "Cancel subscription",
              };
              return translations[key] || key;
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdditionalOptionsCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("Output Events", () => {
    it("should emit downloadLicenseClicked when Download license button is clicked", () => {
      // Arrange
      let emitted = false;
      component.downloadLicenseClicked.subscribe(() => {
        emitted = true;
      });

      fixture.detectChanges();

      // Act
      const buttons = fixture.debugElement.queryAll(By.css("button[bitButton]"));
      expect(buttons).toHaveLength(2);
      const downloadButton = buttons[0]; // First button is "Download license"
      downloadButton.nativeElement.click();

      // Assert
      expect(emitted).toBe(true);
    });

    it("should emit cancelSubscriptionClicked when Cancel subscription button is clicked", () => {
      // Arrange
      let emitted = false;
      component.cancelSubscriptionClicked.subscribe(() => {
        emitted = true;
      });

      fixture.detectChanges();

      // Act
      const buttons = fixture.debugElement.queryAll(By.css("button[bitButton]"));
      expect(buttons).toHaveLength(2);
      const cancelButton = buttons[1]; // Second button is "Cancel subscription"
      cancelButton.nativeElement.click();

      // Assert
      expect(emitted).toBe(true);
    });
  });

  describe("UI Rendering", () => {
    it("should display title as Additional options", () => {
      // Act
      const title = fixture.debugElement.query(By.css("h2[bitTypography='h2']"));

      // Assert
      expect(title).toBeTruthy();
      expect(title.nativeElement.textContent.trim()).toBe("Additional options");
    });

    it("should display description text", () => {
      // Act
      const description = fixture.debugElement.query(By.css("p[bitTypography='body1']"));

      // Assert
      expect(description).toBeTruthy();
      expect(description.nativeElement.textContent.trim()).toBe(
        "For additional help managing your subscription, please contact Customer Support",
      );
    });

    it("should display Download license button", () => {
      // Act
      const buttons = fixture.debugElement.queryAll(By.css("button[bitButton]"));
      const downloadButton = buttons[0];

      // Assert
      expect(downloadButton).toBeTruthy();
      expect(downloadButton.nativeElement.textContent.trim()).toBe("Download license");
    });

    it("should display Cancel subscription button", () => {
      // Act
      const buttons = fixture.debugElement.queryAll(By.css("button[bitButton]"));
      const cancelButton = buttons[1];

      // Assert
      expect(cancelButton).toBeTruthy();
      expect(cancelButton.nativeElement.textContent.trim()).toBe("Cancel subscription");
    });

    it("should display both action buttons", () => {
      // Act
      const buttons = fixture.debugElement.queryAll(By.css("button[bitButton]"));

      // Assert
      expect(buttons).toHaveLength(2);
    });

    it("should display Download license button with secondary button type", () => {
      // Act
      const buttons = fixture.debugElement.queryAll(By.css("button[bitButton]"));
      const downloadButton = buttons[0];

      // Assert
      expect(downloadButton).toBeTruthy();
      expect(downloadButton.componentInstance.buttonType()).toBe("secondary");
    });

    it("should display Cancel subscription button with danger button type", () => {
      // Act
      const buttons = fixture.debugElement.queryAll(By.css("button[bitButton]"));
      const cancelButton = buttons[1];

      // Assert
      expect(cancelButton).toBeTruthy();
      expect(cancelButton.componentInstance.buttonType()).toBe("danger");
    });

    it("should wrap content in bit-card", () => {
      // Act
      const card = fixture.debugElement.query(By.css("bit-card"));

      // Assert
      expect(card).toBeTruthy();
    });
  });
});
