import { CurrencyPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, TemplateRef, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CartSummaryComponent, DiscountTypes } from "@bitwarden/pricing";

import { Cart } from "../../types/cart";

describe("CartSummaryComponent", () => {
  let component: CartSummaryComponent;
  let fixture: ComponentFixture<CartSummaryComponent>;

  const mockCart: Cart = {
    passwordManager: {
      seats: {
        quantity: 5,
        translationKey: "members",
        cost: 50,
      },
      additionalStorage: {
        quantity: 2,
        translationKey: "additionalStorageGB",
        cost: 10,
      },
    },
    secretsManager: {
      seats: {
        quantity: 3,
        translationKey: "secretsManagerSeats",
        cost: 30,
      },
      additionalServiceAccounts: {
        quantity: 2,
        translationKey: "additionalServiceAccountsV2",
        cost: 6,
      },
    },
    cadence: "monthly",
    estimatedTax: 9.6,
  };

  function setupComponent() {
    // Set input values
    fixture.componentRef.setInput("cart", mockCart);

    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartSummaryComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => {
              switch (key) {
                case "month":
                  return "month";
                case "year":
                  return "year";
                case "members":
                  return "Members";
                case "additionalStorageGB":
                  return "Additional storage GB";
                case "additionalServiceAccountsV2":
                  return "Additional machine accounts";
                case "secretsManagerSeats":
                  return "Secrets Manager seats";
                case "passwordManager":
                  return "Password Manager";
                case "secretsManager":
                  return "Secrets Manager";
                case "additionalStorage":
                  return "Additional Storage";
                case "estimatedTax":
                  return "Estimated tax";
                case "total":
                  return "Total";
                case "expandPurchaseDetails":
                  return "Expand purchase details";
                case "collapsePurchaseDetails":
                  return "Collapse purchase details";
                case "familiesMembership":
                  return "Families membership";
                case "premiumMembership":
                  return "Premium membership";
                case "discount":
                  return "discount";
                default:
                  return key;
              }
            },
          },
        },
      ],
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
      const detailsSection = fixture.debugElement.query(By.css('[id="purchase-summary-details"]'));
      expect(detailsSection).toBeFalsy();
    });

    it("should show details when expanded", () => {
      // Arrange
      component.isExpanded.set(true);
      fixture.detectChanges();

      // Act / Assert
      const detailsSection = fixture.debugElement.query(By.css('[id="purchase-summary-details"]'));
      expect(detailsSection).toBeTruthy();
    });
  });

  describe("Content Rendering", () => {
    it("should display correct password manager information", () => {
      // Arrange
      const pmSection = fixture.debugElement.query(By.css('[id="password-manager"]'));
      const pmHeading = pmSection.query(By.css("h3"));
      const pmLineItem = pmSection.query(
        By.css('[id="password-manager-members"] .tw-flex-1 .tw-text-muted'),
      );
      const pmTotal = pmSection.query(By.css("[data-testid='password-manager-total']"));

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
      const storageItem = fixture.debugElement.query(By.css("[id='additional-storage']"));
      const storageText = storageItem.nativeElement.textContent;
      // Act/Assert

      expect(storageItem).toBeTruthy();
      expect(storageText).toContain("2 Additional storage GB");
      expect(storageText).toContain("$10.00");
      expect(storageText).toContain("$20.00");
    });

    it("should display correct secrets manager information", () => {
      // Arrange
      const smSection = fixture.debugElement.query(By.css('[id="secrets-manager"]'));
      const smHeading = smSection.query(By.css("h3"));
      const sectionText = fixture.debugElement.query(By.css('[id="secrets-manager-members"]'))
        .nativeElement.textContent;
      const additionalSA = fixture.debugElement.query(By.css('[id="additional-service-accounts"]'))
        .nativeElement.textContent;

      // Act/ Assert
      expect(smSection).toBeTruthy();
      expect(smHeading.nativeElement.textContent.trim()).toBe("Secrets Manager");

      // Check seats line item
      expect(sectionText).toContain("3 Secrets Manager seats");
      expect(sectionText).toContain("$30.00");
      expect(sectionText).toContain("$90.00"); // 3 * $30

      // Check additional service accounts
      expect(additionalSA).toContain("2 Additional machine accounts");
      expect(additionalSA).toContain("$6.00");
      expect(additionalSA).toContain("$12.00"); // 2 * $6
    });

    it("should display correct tax and total", () => {
      // Arrange
      const taxSection = fixture.debugElement.query(By.css('[id="estimated-tax-section"]'));
      const expectedTotal = "$381.60"; // 250 + 20 + 90 + 12 + 9.6
      const topTotal = fixture.debugElement.query(By.css("h2"));
      const bottomTotal = fixture.debugElement.query(By.css("[data-testid='final-total']"));

      // Act / Assert
      expect(taxSection.nativeElement.textContent).toContain("Estimated tax");
      expect(taxSection.nativeElement.textContent).toContain("$9.60");

      expect(topTotal.nativeElement.textContent).toContain(expectedTotal);

      expect(bottomTotal.nativeElement.textContent).toContain(expectedTotal);
    });
  });

  describe("Default Header (without custom template)", () => {
    it("should render default header when no custom template is provided", () => {
      // Arrange / Act
      const defaultHeader = fixture.debugElement.query(
        By.css('[data-testid="purchase-summary-heading-total"]'),
      );

      // Assert
      expect(defaultHeader).toBeTruthy();
      expect(defaultHeader.nativeElement.textContent).toContain("Total:");
      expect(defaultHeader.nativeElement.textContent).toContain("$381.60");
    });

    it("should display term (month/year) in default header", () => {
      // Arrange / Act
      const allSpans = fixture.debugElement.queryAll(By.css("span.tw-text-main"));
      // Find the span that contains the term
      const termElement = allSpans.find((span) => span.nativeElement.textContent.includes("/"));

      // Assert
      expect(termElement).toBeTruthy();
      expect(termElement!.nativeElement.textContent.trim()).toBe("/ month");
    });
  });

  describe("Discount Display", () => {
    it("should not display discount section when no discount is present", () => {
      // Arrange / Act
      const discountSection = fixture.debugElement.query(
        By.css('[data-testid="discount-section"]'),
      );

      // Assert
      expect(discountSection).toBeFalsy();
    });

    it("should display percent-off discount correctly", () => {
      // Arrange
      const cartWithDiscount: Cart = {
        ...mockCart,
        discount: {
          type: DiscountTypes.PercentOff,
          value: 20,
        },
      };
      fixture.componentRef.setInput("cart", cartWithDiscount);
      fixture.detectChanges();

      const discountSection = fixture.debugElement.query(
        By.css('[data-testid="discount-section"]'),
      );
      const discountLabel = discountSection.query(By.css("h3"));
      const discountAmount = discountSection.query(By.css('[data-testid="discount-amount"]'));

      // Act / Assert
      expect(discountSection).toBeTruthy();
      expect(discountLabel.nativeElement.textContent.trim()).toBe("20% discount");
      // Subtotal = 250 + 20 + 90 + 12 = 372, 20% of 372 = 74.4
      expect(discountAmount.nativeElement.textContent).toContain("-$74.40");
    });

    it("should display amount-off discount correctly", () => {
      // Arrange
      const cartWithDiscount: Cart = {
        ...mockCart,
        discount: {
          type: DiscountTypes.AmountOff,
          value: 50.0,
        },
      };
      fixture.componentRef.setInput("cart", cartWithDiscount);
      fixture.detectChanges();

      const discountSection = fixture.debugElement.query(
        By.css('[data-testid="discount-section"]'),
      );
      const discountLabel = discountSection.query(By.css("h3"));
      const discountAmount = discountSection.query(By.css('[data-testid="discount-amount"]'));

      // Act / Assert
      expect(discountSection).toBeTruthy();
      expect(discountLabel.nativeElement.textContent.trim()).toBe("$50.00 discount");
      expect(discountAmount.nativeElement.textContent).toContain("-$50.00");
    });

    it("should apply discount to total calculation", () => {
      // Arrange
      const cartWithDiscount: Cart = {
        ...mockCart,
        discount: {
          type: DiscountTypes.PercentOff,
          value: 20,
        },
      };
      fixture.componentRef.setInput("cart", cartWithDiscount);
      fixture.detectChanges();

      // Subtotal = 372, discount = 74.4, tax = 9.6
      // Total = 372 - 74.4 + 9.6 = 307.2
      const expectedTotal = "$307.20";
      const topTotal = fixture.debugElement.query(By.css("h2"));
      const bottomTotal = fixture.debugElement.query(By.css("[data-testid='final-total']"));

      // Act / Assert
      expect(topTotal.nativeElement.textContent).toContain(expectedTotal);
      expect(bottomTotal.nativeElement.textContent).toContain(expectedTotal);
    });
  });
});

describe("CartSummaryComponent - Custom Header Template", () => {
  @Component({
    template: `
      <billing-cart-summary [cart]="cart" [header]="customHeader">
        <ng-template #customHeader let-total="total">
          <div data-testid="custom-header">
            <h2>Custom Total: {{ total | currency: "USD" : "symbol" }}</h2>
          </div>
        </ng-template>
      </billing-cart-summary>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CartSummaryComponent, CurrencyPipe],
  })
  class TestHostComponent {
    readonly customHeaderTemplate =
      viewChild.required<TemplateRef<{ total: number }>>("customHeader");
    cart: Cart = {
      passwordManager: {
        seats: {
          quantity: 5,
          translationKey: "members",
          cost: 50,
        },
        additionalStorage: {
          quantity: 2,
          translationKey: "additionalStorageGB",
          cost: 10,
        },
      },
      secretsManager: {
        seats: {
          quantity: 3,
          translationKey: "secretsManagerSeats",
          cost: 30,
        },
        additionalServiceAccounts: {
          quantity: 2,
          translationKey: "additionalServiceAccountsV2",
          cost: 6,
        },
      },
      cadence: "monthly",
      estimatedTax: 9.6,
    };
  }

  let hostFixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => {
              switch (key) {
                case "month":
                  return "month";
                case "year":
                  return "year";
                case "members":
                  return "Members";
                case "additionalStorageGB":
                  return "Additional storage GB";
                case "additionalServiceAccountsV2":
                  return "Additional machine accounts";
                case "secretsManagerSeats":
                  return "Secrets Manager seats";
                case "passwordManager":
                  return "Password Manager";
                case "secretsManager":
                  return "Secrets Manager";
                case "additionalStorage":
                  return "Additional Storage";
                case "estimatedTax":
                  return "Estimated tax";
                case "total":
                  return "Total";
                case "expandPurchaseDetails":
                  return "Expand purchase details";
                case "collapsePurchaseDetails":
                  return "Collapse purchase details";
                case "discount":
                  return "discount";
                default:
                  return key;
              }
            },
          },
        },
      ],
    }).compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    hostFixture.detectChanges();
  });

  it("should render custom header template when provided", () => {
    // Arrange / Act
    const customHeader = hostFixture.debugElement.query(By.css('[data-testid="custom-header"]'));
    const defaultHeader = hostFixture.debugElement.query(
      By.css('[data-testid="purchase-summary-heading-total"]'),
    );

    // Assert
    expect(customHeader).toBeTruthy();
    expect(defaultHeader).toBeFalsy();
  });

  it("should pass correct total value to custom header template", () => {
    // Arrange
    const expectedTotal = "$381.60"; // 250 + 20 + 90 + 12 + 9.6
    const customHeader = hostFixture.debugElement.query(By.css('[data-testid="custom-header"]'));

    // Act / Assert
    expect(customHeader.nativeElement.textContent).toContain("Custom Total:");
    expect(customHeader.nativeElement.textContent).toContain(expectedTotal);
  });
});
