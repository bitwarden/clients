import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StorageCardComponent } from "@bitwarden/subscription";

describe("StorageCardComponent", () => {
  let component: StorageCardComponent;
  let fixture: ComponentFixture<StorageCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageCardComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string, ...args: any[]) => {
              const translations: Record<string, string> = {
                storage: "Storage",
                subscriptionStorage: `Your subscription has a total of ${args[0]} GB of encrypted file storage. You are currently using ${args[1]} GB`,
                addStorage: "Add storage",
                removeStorage: "Remove storage",
              };
              return translations[key] || key;
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StorageCardComponent);
    component = fixture.componentInstance;

    // Set default inputs
    fixture.componentRef.setInput("total", 5);
    fixture.componentRef.setInput("used", 1);
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("Usage Percentage Computation", () => {
    it("should calculate 20% usage when 1 GB is used out of 5 GB", () => {
      // Arrange
      fixture.componentRef.setInput("total", 5);
      fixture.componentRef.setInput("used", 1);
      fixture.detectChanges();

      // Act
      const usage = component.usage();

      // Assert
      expect(usage).toBe(20);
    });

    it("should calculate 50% usage when 5 GB is used out of 10 GB", () => {
      // Arrange
      fixture.componentRef.setInput("total", 10);
      fixture.componentRef.setInput("used", 5);
      fixture.detectChanges();

      // Act
      const usage = component.usage();

      // Assert
      expect(usage).toBe(50);
    });

    it("should calculate 80% usage when 4 GB is used out of 5 GB", () => {
      // Arrange
      fixture.componentRef.setInput("total", 5);
      fixture.componentRef.setInput("used", 4);
      fixture.detectChanges();

      // Act
      const usage = component.usage();

      // Assert
      expect(usage).toBe(80);
    });

    it("should calculate 100% usage when storage is at capacity", () => {
      // Arrange
      fixture.componentRef.setInput("total", 5);
      fixture.componentRef.setInput("used", 5);
      fixture.detectChanges();

      // Act
      const usage = component.usage();

      // Assert
      expect(usage).toBe(100);
    });

    it("should cap usage at 100% when storage exceeds capacity", () => {
      // Arrange
      fixture.componentRef.setInput("total", 5);
      fixture.componentRef.setInput("used", 6);
      fixture.detectChanges();

      // Act
      const usage = component.usage();

      // Assert
      expect(usage).toBe(100);
    });

    it("should return 0% usage when no storage is used", () => {
      // Arrange
      fixture.componentRef.setInput("total", 10);
      fixture.componentRef.setInput("used", 0);
      fixture.detectChanges();

      // Act
      const usage = component.usage();

      // Assert
      expect(usage).toBe(0);
    });

    it("should return 0% usage when total storage is 0 to avoid division by zero", () => {
      // Arrange
      fixture.componentRef.setInput("total", 0);
      fixture.componentRef.setInput("used", 0);
      fixture.detectChanges();

      // Act
      const usage = component.usage();

      // Assert
      expect(usage).toBe(0);
    });

    it("should handle decimal storage values correctly", () => {
      // Arrange
      fixture.componentRef.setInput("total", 10);
      fixture.componentRef.setInput("used", 2.5);
      fixture.detectChanges();

      // Act
      const usage = component.usage();

      // Assert
      expect(usage).toBe(25);
    });
  });

  describe("Description Computation", () => {
    it("should generate correct description with 5 GB total and 1 GB used", () => {
      // Arrange
      fixture.componentRef.setInput("total", 5);
      fixture.componentRef.setInput("used", 1);
      fixture.detectChanges();

      // Act
      const description = component.description();

      // Assert
      expect(description).toBe(
        "Your subscription has a total of 5 GB of encrypted file storage. You are currently using 1 GB",
      );
    });

    it("should generate correct description with 100 GB total and 45 GB used", () => {
      // Arrange
      fixture.componentRef.setInput("total", 100);
      fixture.componentRef.setInput("used", 45);
      fixture.detectChanges();

      // Act
      const description = component.description();

      // Assert
      expect(description).toBe(
        "Your subscription has a total of 100 GB of encrypted file storage. You are currently using 45 GB",
      );
    });

    it("should handle decimal values in description", () => {
      // Arrange
      fixture.componentRef.setInput("total", 10.5);
      fixture.componentRef.setInput("used", 3.25);
      fixture.detectChanges();

      // Act
      const description = component.description();

      // Assert
      expect(description).toBe(
        "Your subscription has a total of 10.5 GB of encrypted file storage. You are currently using 3.25 GB",
      );
    });
  });

  describe("Output Events", () => {
    it("should emit addStorageClicked when Add storage button is clicked", () => {
      // Arrange
      let emitted = false;
      component.addStorageClicked.subscribe(() => {
        emitted = true;
      });

      fixture.detectChanges();

      // Act
      const buttons = fixture.debugElement.queryAll(By.css("button[bitButton]"));
      expect(buttons).toHaveLength(2);
      const addButton = buttons[0]; // First button is "Add storage"
      addButton.nativeElement.click();

      // Assert
      expect(emitted).toBe(true);
    });

    it("should emit removeStorageClicked when Remove storage button is clicked", () => {
      // Arrange
      let emitted = false;
      component.removeStorageClicked.subscribe(() => {
        emitted = true;
      });

      fixture.detectChanges();

      // Act
      const buttons = fixture.debugElement.queryAll(By.css("button[bitButton]"));
      expect(buttons).toHaveLength(2);
      const removeButton = buttons[1]; // Second button is "Remove storage"
      removeButton.nativeElement.click();

      // Assert
      expect(emitted).toBe(true);
    });
  });

  describe("UI Rendering", () => {
    it("should display title as Storage", () => {
      // Act
      const title = fixture.debugElement.query(By.css("h2[bitTypography='h2']"));

      // Assert
      expect(title).toBeTruthy();
      expect(title.nativeElement.textContent.trim()).toBe("Storage");
    });

    it("should display description text", () => {
      // Act
      const description = fixture.debugElement.query(By.css("p[bitTypography='body1']"));

      // Assert
      expect(description).toBeTruthy();
      expect(description.nativeElement.textContent.trim()).toBe(
        "Your subscription has a total of 5 GB of encrypted file storage. You are currently using 1 GB",
      );
    });

    it("should display progress bar", () => {
      // Act
      const progressBar = fixture.debugElement.query(
        By.css(".tw-relative.tw-h-4.tw-w-full.tw-overflow-hidden.tw-rounded.tw-bg-secondary-100"),
      );

      // Assert
      expect(progressBar).toBeTruthy();
    });

    it("should set progress bar width based on usage percentage", () => {
      // Arrange
      fixture.componentRef.setInput("total", 10);
      fixture.componentRef.setInput("used", 5);
      fixture.detectChanges();

      // Act
      const progressBarFill = fixture.debugElement.query(
        By.css(".tw-absolute.tw-inset-y-0.tw-left-0.tw-bg-primary-600"),
      );

      // Assert
      expect(progressBarFill).toBeTruthy();
      expect(progressBarFill.nativeElement.style.width).toBe("50%");
    });

    it("should display Add storage button", () => {
      // Act
      const buttons = fixture.debugElement.queryAll(By.css("button[bitButton]"));
      const addButton = buttons[0];

      // Assert
      expect(addButton).toBeTruthy();
      expect(addButton.nativeElement.textContent.trim()).toBe("Add storage");
    });

    it("should display Remove storage button", () => {
      // Act
      const buttons = fixture.debugElement.queryAll(By.css("button[bitButton]"));
      const removeButton = buttons[1];

      // Assert
      expect(removeButton).toBeTruthy();
      expect(removeButton.nativeElement.textContent.trim()).toBe("Remove storage");
    });

    it("should display both action buttons", () => {
      // Act
      const buttons = fixture.debugElement.queryAll(By.css("button[bitButton]"));

      // Assert
      expect(buttons).toHaveLength(2);
    });

    it("should wrap content in bit-card", () => {
      // Act
      const card = fixture.debugElement.query(By.css("bit-card"));

      // Assert
      expect(card).toBeTruthy();
    });

    it("should display progress bar with 0% width when no storage is used", () => {
      // Arrange
      fixture.componentRef.setInput("total", 10);
      fixture.componentRef.setInput("used", 0);
      fixture.detectChanges();

      // Act
      const progressBarFill = fixture.debugElement.query(
        By.css(".tw-absolute.tw-inset-y-0.tw-left-0.tw-bg-primary-600"),
      );

      // Assert
      expect(progressBarFill).toBeTruthy();
      expect(progressBarFill.nativeElement.style.width).toBe("0%");
    });

    it("should display progress bar with 100% width when storage is at capacity", () => {
      // Arrange
      fixture.componentRef.setInput("total", 5);
      fixture.componentRef.setInput("used", 5);
      fixture.detectChanges();

      // Act
      const progressBarFill = fixture.debugElement.query(
        By.css(".tw-absolute.tw-inset-y-0.tw-left-0.tw-bg-primary-600"),
      );

      // Assert
      expect(progressBarFill).toBeTruthy();
      expect(progressBarFill.nativeElement.style.width).toBe("100%");
    });
  });
});
