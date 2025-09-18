import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { CartSummaryComponent, LineItem } from "./cart-summary.component";

describe("CartSummaryComponent", () => {
  let component: CartSummaryComponent;
  let fixture: ComponentFixture<CartSummaryComponent>;

  const mockPasswordManager: LineItem = {
    quantity: 5,
    name: "Password Manager",
    cost: 50,
    cadence: "month",
  };

  const mockAdditionalStorage: LineItem = {
    quantity: 2,
    name: "Additional Storage",
    cost: 10,
    cadence: "month",
  };

  const mockSecretsManager = {
    seats: {
      quantity: 3,
      name: "Secrets Manager Seats",
      cost: 30,
      cadence: "month" as "month" | "year",
    },
    additionalServiceAccounts: {
      quantity: 2,
      name: "Additional Service Accounts",
      cost: 6,
      cadence: "month" as "month" | "year",
    },
  };

  const mockEstimatedTax = 9.6;

  function setupComponent(
    options: {
      passwordManager?: LineItem;
      additionalStorage?: LineItem | null;
      secretsManager?: { seats: LineItem; additionalServiceAccounts?: LineItem } | null;
      estimatedTax?: number;
    } = {},
  ) {
    const pm = options.passwordManager ?? mockPasswordManager;
    const storage =
      options.additionalStorage !== null
        ? (options.additionalStorage ?? mockAdditionalStorage)
        : undefined;
    const sm =
      options.secretsManager !== null ? (options.secretsManager ?? mockSecretsManager) : undefined;
    const tax = options.estimatedTax ?? mockEstimatedTax;

    // Set input values
    fixture.componentRef.setInput("passwordManager", pm);
    if (storage !== undefined) {
      fixture.componentRef.setInput("additionalStorage", storage);
    }
    if (sm !== undefined) {
      fixture.componentRef.setInput("secretsManager", sm);
    }
    fixture.componentRef.setInput("estimatedTax", tax);

    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartSummaryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CartSummaryComponent);
    component = fixture.componentInstance;

    // Default setup with all inputs
    setupComponent();
  });

  it("should create", () => {
    // Assert
    expect(component).toBeTruthy();
  });

  describe("UI Toggle Functionality", () => {
    it("should toggle expanded state when the button is clicked", () => {
      // Arrange
      expect(component.isExpanded()).toBe(true);
      const toggleButton = fixture.debugElement.query(By.css("button[type='button']"));
      expect(toggleButton).toBeTruthy();

      // Act - First click (collapse)
      toggleButton.triggerEventHandler("click", null);
      fixture.detectChanges();

      // Assert - Component is collapsed
      expect(component.isExpanded()).toBe(false);
      const icon = fixture.debugElement.query(By.css("i.bwi"));
      expect(icon.nativeElement.classList.contains("bwi-angle-down")).toBe(true);

      // Act - Second click (expand)
      toggleButton.triggerEventHandler("click", null);
      fixture.detectChanges();

      // Assert - Component is expanded again
      expect(component.isExpanded()).toBe(true);
      expect(icon.nativeElement.classList.contains("bwi-angle-up")).toBe(true);
    });

    it("should hide details when collapsed", () => {
      // Arrange
      component.isExpanded.set(false);
      fixture.detectChanges();

      // Act / Assert
      const detailsSection = fixture.debugElement.query(By.css(".tw-mb-4.tw-pb-4.tw-text-muted"));
      expect(detailsSection).toBeFalsy();
    });

    it("should show details when expanded", () => {
      // Arrange
      component.isExpanded.set(true);
      fixture.detectChanges();

      // Act / Assert
      const detailsSection = fixture.debugElement.query(By.css(".tw-mb-4.tw-pb-4.tw-text-muted"));
      expect(detailsSection).toBeTruthy();
    });
  });

  describe("Content Rendering", () => {
    it("should display correct password manager information", () => {
      // Arrange
      const pmSection = fixture.debugElement.query(By.css(".tw-mb-3.tw-border-b"));
      const pmHeading = pmSection.query(By.css(".tw-font-semibold"));
      const pmLineItem = pmSection.query(By.css(".tw-flex-1 .tw-text-sm"));
      const pmTotal = pmSection.query(By.css(".tw-text-sm:not(.tw-flex-1 *)"));

      // Act/ Assert
      expect(pmSection).toBeTruthy();
      expect(pmHeading.nativeElement.textContent.trim()).toBe("Password Manager");
      expect(pmLineItem.nativeElement.textContent).toContain("5 Members");
      expect(pmLineItem.nativeElement.textContent).toContain("$50.00");
      expect(pmLineItem.nativeElement.textContent).toContain("month");
      expect(pmTotal.nativeElement.textContent).toContain("$250.00"); // 5 * $50
    });

    it("should display correct additional storage information", () => {
      // Arrange
      const storageItem = fixture.debugElement.query(
        By.css(".tw-mb-3.tw-border-b .tw-flex-justify-between:nth-of-type(3)"),
      );
      const storageText = fixture.debugElement.query(By.css(".tw-mb-3.tw-border-b")).nativeElement
        .textContent;
      // Act/Assert

      expect(storageItem).toBeTruthy();
      expect(storageText).toContain("2 Additional GB");
      expect(storageText).toContain("$10.00");
      expect(storageText).toContain("$20.00");
    });

    it("should display correct secrets manager information", () => {
      // Arrange
      const smSection = fixture.debugElement.queryAll(By.css(".tw-mb-3.tw-border-b"))[1];
      const smHeading = smSection.query(By.css(".tw-font-semibold"));
      const sectionText = smSection.nativeElement.textContent;

      // Act/ Assert
      expect(smSection).toBeTruthy();
      expect(smHeading.nativeElement.textContent.trim()).toBe("Secrets Manager");

      // Check seats line item
      expect(sectionText).toContain("3 Members");
      expect(sectionText).toContain("$30.00");
      expect(sectionText).toContain("$90.00"); // 3 * $30

      // Check additional service accounts
      expect(sectionText).toContain("2 Additional machine accounts");
      expect(sectionText).toContain("$6.00");
      expect(sectionText).toContain("$12.00"); // 2 * $6
    });

    it("should display correct tax and total", () => {
      // Arrange
      const taxSection = fixture.debugElement.query(
        By.css(".tw-flex.tw-justify-between.tw-mb-3.tw-border-b:last-of-type"),
      );
      const expectedTotal = "$381.60"; // 250 + 20 + 90 + 12 + 9.6
      const topTotal = fixture.debugElement.query(By.css("h2"));
      const bottomTotal = fixture.debugElement.query(
        By.css(
          ".tw-flex.tw-justify-between.tw-items-center:last-child .tw-font-semibold:last-child",
        ),
      );

      // Act / Assert
      expect(taxSection.nativeElement.textContent).toContain("Estimated Tax");
      expect(taxSection.nativeElement.textContent).toContain("$9.60");

      expect(topTotal.nativeElement.textContent).toContain(expectedTotal);

      expect(bottomTotal.nativeElement.textContent).toContain(expectedTotal);
    });
  });
});
