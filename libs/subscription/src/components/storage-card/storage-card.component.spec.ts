import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Storage, StorageCardComponent } from "@bitwarden/subscription";

describe("StorageCardComponent", () => {
  let component: StorageCardComponent;
  let fixture: ComponentFixture<StorageCardComponent>;
  let i18nService: jest.Mocked<I18nService>;

  const baseStorage: Storage = {
    available: 5,
    used: 0,
    readableUsed: "0 GB",
  };

  beforeEach(async () => {
    i18nService = {
      t: jest.fn((key: string, ...args: any[]) => {
        const translations: Record<string, string> = {
          storage: "Storage",
          storageFull: "Storage full",
          storageUsedDescription: `You have used ${args[0]} out of ${args[1]} GB of your encrypted file storage.`,
          storageFullDescription: `You have used all ${args[0]} GB of your encrypted storage. To continue storing files, add more storage.`,
          addStorage: "Add storage",
          removeStorage: "Remove storage",
        };
        return translations[key] || key;
      }),
    } as any;

    await TestBed.configureTestingModule({
      imports: [StorageCardComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(StorageCardComponent);
    component = fixture.componentInstance;
  });

  function setupComponent(storage: Storage) {
    fixture.componentRef.setInput("storage", storage);
    fixture.detectChanges();
  }

  it("should create", () => {
    setupComponent(baseStorage);
    expect(component).toBeTruthy();
  });

  describe("isEmpty", () => {
    it("should return true when storage is empty", () => {
      setupComponent({ ...baseStorage, used: 0 });
      expect(component.isEmpty()).toBe(true);
    });

    it("should return false when storage is used", () => {
      setupComponent({ ...baseStorage, used: 2.5, readableUsed: "2.5 GB" });
      expect(component.isEmpty()).toBe(false);
    });

    it("should return false when storage is full", () => {
      setupComponent({ ...baseStorage, used: 5, readableUsed: "5 GB" });
      expect(component.isEmpty()).toBe(false);
    });
  });

  describe("isFull", () => {
    it("should return false when storage is empty", () => {
      setupComponent({ ...baseStorage, used: 0 });
      expect(component.isFull()).toBe(false);
    });

    it("should return false when storage is partially used", () => {
      setupComponent({ ...baseStorage, used: 2.5, readableUsed: "2.5 GB" });
      expect(component.isFull()).toBe(false);
    });

    it("should return true when storage is full", () => {
      setupComponent({ ...baseStorage, used: 5, readableUsed: "5 GB" });
      expect(component.isFull()).toBe(true);
    });

    it("should return true when used exceeds available", () => {
      setupComponent({ ...baseStorage, used: 6, readableUsed: "6 GB" });
      expect(component.isFull()).toBe(true);
    });
  });

  describe("percentageUsed", () => {
    it("should return 0 when storage is empty", () => {
      setupComponent({ ...baseStorage, used: 0 });
      expect(component.percentageUsed()).toBe(0);
    });

    it("should return 50 when half of storage is used", () => {
      setupComponent({ ...baseStorage, used: 2.5, readableUsed: "2.5 GB" });
      expect(component.percentageUsed()).toBe(50);
    });

    it("should return 100 when storage is full", () => {
      setupComponent({ ...baseStorage, used: 5, readableUsed: "5 GB" });
      expect(component.percentageUsed()).toBe(100);
    });

    it("should cap at 100 when used exceeds available", () => {
      setupComponent({ ...baseStorage, used: 6, readableUsed: "6 GB" });
      expect(component.percentageUsed()).toBe(100);
    });

    it("should return 0 when available is 0", () => {
      setupComponent({ available: 0, used: 0, readableUsed: "0 GB" });
      expect(component.percentageUsed()).toBe(0);
    });
  });

  describe("title", () => {
    it("should display 'Storage' when storage is empty", () => {
      setupComponent({ ...baseStorage, used: 0 });
      expect(component.title()).toBe("Storage");
    });

    it("should display 'Storage' when storage is partially used", () => {
      setupComponent({ ...baseStorage, used: 2.5, readableUsed: "2.5 GB" });
      expect(component.title()).toBe("Storage");
    });

    it("should display 'Storage full' when storage is full", () => {
      setupComponent({ ...baseStorage, used: 5, readableUsed: "5 GB" });
      expect(component.title()).toBe("Storage full");
    });
  });

  describe("description", () => {
    it("should display used description when storage is empty", () => {
      setupComponent({ ...baseStorage, used: 0 });
      expect(component.description()).toContain("You have used 0 GB out of 5 GB");
    });

    it("should display used description when storage is partially used", () => {
      setupComponent({ ...baseStorage, used: 2.5, readableUsed: "2.5 GB" });
      expect(component.description()).toContain("You have used 2.5 GB out of 5 GB");
    });

    it("should display full description when storage is full", () => {
      setupComponent({ ...baseStorage, used: 5, readableUsed: "5 GB" });
      const desc = component.description();
      expect(desc).toContain("You have used all 5 GB");
      expect(desc).toContain("To continue storing files, add more storage");
    });
  });

  describe("progressBarColor", () => {
    it("should return primary color when storage is not full", () => {
      setupComponent({ ...baseStorage, used: 2.5, readableUsed: "2.5 GB" });
      expect(component.progressBarColor()).toBe("primary");
    });

    it("should return danger color when storage is full", () => {
      setupComponent({ ...baseStorage, used: 5, readableUsed: "5 GB" });
      expect(component.progressBarColor()).toBe("danger");
    });
  });

  describe("canRemoveStorage", () => {
    it("should return true when storage is not full", () => {
      setupComponent({ ...baseStorage, used: 2.5, readableUsed: "2.5 GB" });
      expect(component.canRemoveStorage()).toBe(true);
    });

    it("should return false when storage is full", () => {
      setupComponent({ ...baseStorage, used: 5, readableUsed: "5 GB" });
      expect(component.canRemoveStorage()).toBe(false);
    });
  });

  describe("button rendering", () => {
    it("should render both buttons", () => {
      setupComponent(baseStorage);
      const buttons = fixture.debugElement.queryAll(By.css("button"));
      expect(buttons.length).toBe(2);
    });

    it("should enable remove button when storage is not full", () => {
      setupComponent({ ...baseStorage, used: 2.5, readableUsed: "2.5 GB" });
      const buttons = fixture.debugElement.queryAll(By.css("button"));
      const removeButton = buttons[1].nativeElement;
      expect(removeButton.disabled).toBe(false);
    });

    it("should disable remove button when storage is full", () => {
      setupComponent({ ...baseStorage, used: 5, readableUsed: "5 GB" });
      const buttons = fixture.debugElement.queryAll(By.css("button"));
      const removeButton = buttons[1];
      expect(removeButton.attributes["aria-disabled"]).toBe("true");
    });
  });

  describe("callsToActionDisabled", () => {
    it("should disable both buttons when callsToActionDisabled is true", () => {
      setupComponent(baseStorage);
      fixture.componentRef.setInput("callsToActionDisabled", true);
      fixture.detectChanges();

      const buttons = fixture.debugElement.queryAll(By.css("button"));
      expect(buttons[0].attributes["aria-disabled"]).toBe("true");
      expect(buttons[1].attributes["aria-disabled"]).toBe("true");
    });

    it("should enable both buttons when callsToActionDisabled is false and storage is not full", () => {
      setupComponent({ ...baseStorage, used: 2.5, readableUsed: "2.5 GB" });
      fixture.componentRef.setInput("callsToActionDisabled", false);
      fixture.detectChanges();

      const buttons = fixture.debugElement.queryAll(By.css("button"));
      expect(buttons[0].nativeElement.disabled).toBe(false);
      expect(buttons[1].nativeElement.disabled).toBe(false);
    });

    it("should keep remove button disabled when callsToActionDisabled is false but storage is full", () => {
      setupComponent({ ...baseStorage, used: 5, readableUsed: "5 GB" });
      fixture.componentRef.setInput("callsToActionDisabled", false);
      fixture.detectChanges();

      const buttons = fixture.debugElement.queryAll(By.css("button"));
      expect(buttons[0].nativeElement.disabled).toBe(false);
      expect(buttons[1].attributes["aria-disabled"]).toBe("true");
    });
  });

  describe("button click events", () => {
    it("should emit add-storage action when add button is clicked", () => {
      setupComponent(baseStorage);

      const emitSpy = jest.spyOn(component.callToActionClicked, "emit");

      const buttons = fixture.debugElement.queryAll(By.css("button"));
      buttons[0].triggerEventHandler("click", { button: 0 });
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith("add-storage");
    });

    it("should emit remove-storage action when remove button is clicked", () => {
      setupComponent({ ...baseStorage, used: 2.5, readableUsed: "2.5 GB" });

      const emitSpy = jest.spyOn(component.callToActionClicked, "emit");

      const buttons = fixture.debugElement.queryAll(By.css("button"));
      buttons[1].triggerEventHandler("click", { button: 0 });
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith("remove-storage");
    });
  });

  describe("progress bar rendering", () => {
    it("should render bit-progress component when storage is empty", () => {
      setupComponent({ ...baseStorage, used: 0 });
      const progressBar = fixture.debugElement.query(By.css("bit-progress"));
      expect(progressBar).toBeTruthy();
    });

    it("should pass correct barWidth to bit-progress when half storage is used", () => {
      setupComponent({ ...baseStorage, used: 2.5, readableUsed: "2.5 GB" });
      expect(component.percentageUsed()).toBe(50);
    });

    it("should pass correct barWidth to bit-progress when storage is full", () => {
      setupComponent({ ...baseStorage, used: 5, readableUsed: "5 GB" });
      expect(component.percentageUsed()).toBe(100);
    });

    it("should pass primary color to bit-progress when storage is not full", () => {
      setupComponent({ ...baseStorage, used: 2.5, readableUsed: "2.5 GB" });
      expect(component.progressBarColor()).toBe("primary");
    });

    it("should pass danger color to bit-progress when storage is full", () => {
      setupComponent({ ...baseStorage, used: 5, readableUsed: "5 GB" });
      expect(component.progressBarColor()).toBe("danger");
    });
  });
});
