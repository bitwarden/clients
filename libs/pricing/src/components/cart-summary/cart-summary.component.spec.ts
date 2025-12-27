import { CurrencyPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CartSummaryComponent, Discount, LineItem } from "@bitwarden/pricing";

describe("CartSummaryComponent", () => {
  let component: CartSummaryComponent;
  let fixture: ComponentFixture<CartSummaryComponent>;

  const mockPasswordManager: LineItem = {
    quantity: 5,
    name: "members",
    cost: 50,
    cadence: "month",
  };

  const mockAdditionalStorage: LineItem = {
    quantity: 2,
    name: "additionalStorageGB",
    cost: 10,
    cadence: "month",
  };

  const mockSecretsManager: { seats: LineItem; additionalServiceAccounts?: LineItem } = {
    seats: {
      quantity: 3,
      name: "secretsManagerSeats",
      cost: 30,
      cadence: "month",
    },
    additionalServiceAccounts: {
      quantity: 2,
      name: "additionalServiceAccountsV2",
      cost: 6,
      cadence: "month",
    },
  };

  const mockEstimatedTax = 9.6;

  function setupComponent() {
    // Set input values
    fixture.componentRef.setInput("passwordManager", mockPasswordManager);
    fixture.componentRef.setInput("additionalStorage", mockAdditionalStorage);
    fixture.componentRef.setInput("secretsManager", mockSecretsManager);
    fixture.componentRef.setInput("estimatedTax", mockEstimatedTax);

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
                  return "Discount";
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
      const pmLineItem = pmSection.query(By.css(".tw-flex-1 .tw-text-muted"));
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

  describe("Discount Functionality", () => {
    it("should not display discount when not provided", () => {
      // Act
      const discountElement = fixture.debugElement.query(By.css('[id="discount"]'));

      // Assert
      expect(discountElement).toBeFalsy();
    });

    it("should not display discount when inactive", () => {
      // Arrange
      const inactiveDiscount: Discount = {
        _tag: "percent-off",
        value: 30,
        active: false,
      };
      fixture.componentRef.setInput("discount", inactiveDiscount);
      fixture.detectChanges();

      // Act
      const discountElement = fixture.debugElement.query(By.css('[id="discount"]'));

      // Assert
      expect(discountElement).toBeFalsy();
    });

    it("should not display discount when value is 0", () => {
      // Arrange
      const zeroDiscount: Discount = {
        _tag: "percent-off",
        value: 0,
        active: true,
      };
      fixture.componentRef.setInput("discount", zeroDiscount);
      fixture.detectChanges();

      // Act
      const discountElement = fixture.debugElement.query(By.css('[id="discount"]'));

      // Assert
      expect(discountElement).toBeFalsy();
    });

    it("should display percent-off discount correctly", () => {
      // Arrange
      const percentDiscount: Discount = {
        _tag: "percent-off",
        value: 30,
        active: true,
      };
      fixture.componentRef.setInput("discount", percentDiscount);
      fixture.detectChanges();

      // Act
      const discountElement = fixture.debugElement.query(By.css('[id="discount"]'));
      const discountText = discountElement.nativeElement.textContent;

      // Assert
      expect(discountElement).toBeTruthy();
      expect(discountText).toContain("30% Discount");
      expect(discountText).toContain("-$111.60"); // 30% of 372 (250 + 20 + 90 + 12)
    });

    it("should display amount-off discount correctly", () => {
      // Arrange
      const amountDiscount: Discount = {
        _tag: "amount-off",
        value: 50,
        active: true,
      };
      fixture.componentRef.setInput("discount", amountDiscount);
      fixture.detectChanges();

      // Act
      const discountElement = fixture.debugElement.query(By.css('[id="discount"]'));
      const discountText = discountElement.nativeElement.textContent;

      // Assert
      expect(discountElement).toBeTruthy();
      expect(discountText).toContain("$50.00 Discount");
      expect(discountText).toContain("-$50.00");
    });

    it("should calculate total with percent-off discount", () => {
      // Arrange
      const percentDiscount: Discount = {
        _tag: "percent-off",
        value: 30,
        active: true,
      };
      fixture.componentRef.setInput("discount", percentDiscount);
      fixture.detectChanges();

      // Act
      const topTotal = fixture.debugElement.query(By.css("h2"));
      const bottomTotal = fixture.debugElement.query(By.css("[data-testid='final-total']"));
      const expectedTotal = "$270.00"; // 372 - 111.60 + 9.6

      // Assert
      expect(topTotal.nativeElement.textContent).toContain(expectedTotal);
      expect(bottomTotal.nativeElement.textContent).toContain(expectedTotal);
    });

    it("should calculate total with amount-off discount", () => {
      // Arrange
      const amountDiscount: Discount = {
        _tag: "amount-off",
        value: 50,
        active: true,
      };
      fixture.componentRef.setInput("discount", amountDiscount);
      fixture.detectChanges();

      // Act
      const topTotal = fixture.debugElement.query(By.css("h2"));
      const bottomTotal = fixture.debugElement.query(By.css("[data-testid='final-total']"));
      const expectedTotal = "$331.60"; // 372 - 50 + 9.6

      // Assert
      expect(topTotal.nativeElement.textContent).toContain(expectedTotal);
      expect(bottomTotal.nativeElement.textContent).toContain(expectedTotal);
    });

    it("should handle decimal percent-off discount (value < 1)", () => {
      // Arrange
      const decimalPercentDiscount: Discount = {
        _tag: "percent-off",
        value: 0.3, // 30% as decimal
        active: true,
      };
      fixture.componentRef.setInput("discount", decimalPercentDiscount);
      fixture.detectChanges();

      // Act
      const discountElement = fixture.debugElement.query(By.css('[id="discount"]'));
      const discountText = discountElement.nativeElement.textContent;

      // Assert
      expect(discountElement).toBeTruthy();
      expect(discountText).toContain("30% Discount");
      expect(discountText).toContain("-$111.60"); // 30% of 372
    });
  });

  describe("Header Template Functionality", () => {
    it("should display default header when no headerTemplate is provided", () => {
      // Act
      const heading = fixture.debugElement.query(
        By.css('[data-testid="purchase-summary-heading-total"]'),
      );
      const headingText = heading.nativeElement.textContent;
      const cadenceText = fixture.debugElement.query(
        By.css("span.tw-text-main[bittypography='body1']"),
      );

      // Assert
      expect(heading).toBeTruthy();
      expect(heading.nativeElement.id).toBe("purchase-summary-heading-total");
      expect(headingText).toContain("Total:");
      expect(headingText).toContain("$381.60");
      expect(headingText).toContain("USD");
      expect(cadenceText).toBeTruthy();
      expect(cadenceText.nativeElement.textContent).toContain("/ month");
    });

    it("should calculate correct total for headerTemplate context", () => {
      // This test verifies the total calculation that would be passed to headerTemplate
      // The template receives { total: computed_total_value }
      const totalValue = component.total();
      expect(totalValue).toBe(381.6); // 250 + 20 + 90 + 12 + 9.6
    });

    it("should render custom headerTemplate when provided", () => {
      // Arrange - Create a test component with a custom template
      @Component({
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: `
          <ng-template #customHeader let-total="total">
            <div data-testid="custom-header" class="tw-text-main">
              Custom Total: {{ total | currency: "USD" }}
            </div>
          </ng-template>
          <billing-cart-summary
            [passwordManager]="passwordManager"
            [estimatedTax]="estimatedTax"
            [headerTemplate]="customHeader"
          />
        `,
        imports: [CartSummaryComponent, CurrencyPipe],
      })
      class TestHostComponent {
        passwordManager = mockPasswordManager;
        estimatedTax = mockEstimatedTax;
      }

      const hostFixture = TestBed.createComponent(TestHostComponent);
      hostFixture.detectChanges();

      // Act
      const customHeader = hostFixture.debugElement.query(By.css('[data-testid="custom-header"]'));
      const defaultHeader = hostFixture.debugElement.query(
        By.css('[data-testid="purchase-summary-heading-total"]'),
      );

      // Assert - Custom header should be rendered
      expect(customHeader).toBeTruthy();
      expect(customHeader.nativeElement.textContent).toContain("Custom Total:");
      expect(customHeader.nativeElement.textContent).toContain("$259.60"); // 250 + 9.6
      expect(customHeader.nativeElement.classList.contains("tw-text-main")).toBe(true);

      // Assert - Default header should NOT be rendered
      expect(defaultHeader).toBeFalsy();
    });

    it("should pass correct total value to custom headerTemplate context", () => {
      // Arrange - Create a test component that captures the context value
      let capturedTotal: number | undefined;

      @Component({
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: `
          <ng-template #customHeader let-total="total">
            <div data-testid="custom-header">{{ captureTotal(total) }}</div>
          </ng-template>
          <billing-cart-summary
            [passwordManager]="passwordManager"
            [additionalStorage]="additionalStorage"
            [secretsManager]="secretsManager"
            [estimatedTax]="estimatedTax"
            [headerTemplate]="customHeader"
          />
        `,
        imports: [CartSummaryComponent],
      })
      class TestHostComponent {
        passwordManager = mockPasswordManager;
        additionalStorage = mockAdditionalStorage;
        secretsManager = mockSecretsManager;
        estimatedTax = mockEstimatedTax;

        captureTotal(total: number): number {
          capturedTotal = total;
          return total;
        }
      }

      const hostFixture = TestBed.createComponent(TestHostComponent);
      hostFixture.detectChanges();

      // Assert - Context should contain the correct total value
      expect(capturedTotal).toBeDefined();
      expect(capturedTotal).toBe(381.6); // 250 + 20 + 90 + 12 + 9.6
    });

    it("should update custom headerTemplate when total changes", () => {
      // Arrange - Create a test component with a custom template using signals
      @Component({
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: `
          <ng-template #customHeader let-total="total">
            <div data-testid="custom-header">{{ total }}</div>
          </ng-template>
          <billing-cart-summary
            [passwordManager]="passwordManager"
            [estimatedTax]="estimatedTax()"
            [headerTemplate]="customHeader"
          />
        `,
        imports: [CartSummaryComponent],
      })
      class TestHostComponent {
        passwordManager = mockPasswordManager;
        readonly estimatedTax = signal(mockEstimatedTax);
      }

      const hostFixture = TestBed.createComponent(TestHostComponent);
      hostFixture.detectChanges();

      // Act - Verify initial total
      let customHeader = hostFixture.debugElement.query(By.css('[data-testid="custom-header"]'));
      expect(customHeader.nativeElement.textContent.trim()).toBe("259.6"); // 250 + 9.6

      // Act - Update the estimated tax signal
      hostFixture.componentInstance.estimatedTax.set(20);
      hostFixture.detectChanges();

      // Assert - Custom header should reflect the updated total
      customHeader = hostFixture.debugElement.query(By.css('[data-testid="custom-header"]'));
      expect(customHeader.nativeElement.textContent.trim()).toBe("270"); // 250 + 20
    });

    it("should render custom headerTemplate with discount applied", () => {
      // Arrange - Create a test component with a discount
      @Component({
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: `
          <ng-template #customHeader let-total="total">
            <div data-testid="custom-header">Discounted Total: {{ total }}</div>
          </ng-template>
          <billing-cart-summary
            [passwordManager]="passwordManager"
            [estimatedTax]="estimatedTax"
            [discount]="discount"
            [headerTemplate]="customHeader"
          />
        `,
        imports: [CartSummaryComponent],
      })
      class TestHostComponent {
        passwordManager = mockPasswordManager;
        estimatedTax = mockEstimatedTax;
        discount: Discount = {
          _tag: "amount-off",
          value: 50,
          active: true,
        };
      }

      const hostFixture = TestBed.createComponent(TestHostComponent);
      hostFixture.detectChanges();

      // Act
      const customHeader = hostFixture.debugElement.query(By.css('[data-testid="custom-header"]'));

      // Assert - Custom header should show total with discount applied
      expect(customHeader).toBeTruthy();
      expect(customHeader.nativeElement.textContent).toContain("Discounted Total:");
      expect(customHeader.nativeElement.textContent).toContain("209.6"); // 250 - 50 + 9.6
    });
  });
});
