import { DatePipe } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BitwardenSubscription,
  PlanCardAction,
  SubscriptionCardComponent,
} from "@bitwarden/subscription";

describe("SubscriptionCardComponent", () => {
  let component: SubscriptionCardComponent;
  let fixture: ComponentFixture<SubscriptionCardComponent>;
  let mockConfigService: {
    getFeatureFlag$: jest.Mock;
  };

  const baseCart = {
    passwordManager: {
      quantity: 1,
      name: "premiumMembership" as const,
      cost: 10.0,
      cadence: "year" as const,
    },
    estimatedTax: 2.71,
  };

  const mockSubscriber = {
    type: "account" as const,
    data: {
      id: "user-123" as any,
      email: "user@example.com",
    },
  };

  const mockActiveSubscription: BitwardenSubscription = {
    subscriber: mockSubscriber,
    cart: baseCart,
    status: "active",
    nextCharge: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };

  const mockTrialingSubscription: BitwardenSubscription = {
    subscriber: mockSubscriber,
    cart: baseCart,
    status: "trialing",
    nextCharge: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  const mockPastDueSubscription: BitwardenSubscription = {
    subscriber: mockSubscriber,
    cart: baseCart,
    status: "past_due",
    expired: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    suspension: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    gracePeriod: 7,
  };

  const mockCanceledSubscription: BitwardenSubscription = {
    subscriber: mockSubscriber,
    cart: baseCart,
    status: "canceled",
    canceled: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  };

  const mockUnpaidSubscription: BitwardenSubscription = {
    subscriber: mockSubscriber,
    cart: baseCart,
    status: "unpaid",
    suspension: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  };

  const mockIncompleteSubscription: BitwardenSubscription = {
    subscriber: mockSubscriber,
    cart: baseCart,
    status: "incomplete",
    created: new Date(Date.now() - 60 * 60 * 1000),
  };

  const mockIncompleteExpiredSubscription: BitwardenSubscription = {
    subscriber: mockSubscriber,
    cart: baseCart,
    status: "incomplete_expired",
    created: new Date(Date.now() - 25 * 60 * 60 * 1000),
  };

  beforeEach(async () => {
    mockConfigService = {
      getFeatureFlag$: jest.fn().mockReturnValue(new BehaviorSubject(false)),
    };

    await TestBed.configureTestingModule({
      imports: [SubscriptionCardComponent],
      providers: [
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        DatePipe,
        {
          provide: I18nService,
          useValue: {
            t: (key: string, ...args: any[]) => {
              const translations: Record<string, string> = {
                incomplete: "Incomplete",
                expired: "Expired",
                trial: "Trial",
                active: "Active",
                pastDue: "Past due",
                canceled: "Canceled",
                unpaid: "Unpaid",
                contactSupportShort: "Contact Support",
                upgradeYourPlan: "Upgrade your plan",
                somethingWentWrongSubscription:
                  "Something went wrong with your subscription. For assistance, please contact customer support.",
                premiumShareEvenMore:
                  "Share even more with Families, or get powerful, trusted password security with Teams or Enterprise",
                pastDueWarningForChargeAutomatically: `You have a grace period of ${args[0]} days from your subscription expiration date to maintain your subscription. Please resolve the past due invoices by ${args[1]}.`,
                toReactivateYourSubscription:
                  "To reactivate your subscription, please resolve the past due invoices.",
                upgradeNow: "Upgrade now",
                yourSubscriptionWillBeSuspendedOn: "Your subscription will be suspended on",
                yourSubscriptionWasSuspendedOn: "Your subscription was suspended on",
                yourNextChargeIsFor: "Your next charge is for",
                dueOn: "due on",
                yourSubscriptionWasCanceledOn: "Your subscription was canceled on",
              };
              return translations[key] || key;
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionCardComponent);
    component = fixture.componentInstance;

    // Set default inputs
    fixture.componentRef.setInput("title", "Premium membership");
    fixture.componentRef.setInput("subscription", mockActiveSubscription);
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("Badge Display", () => {
    it('should display "Active" badge with success variant for active status', () => {
      // Arrange
      const badge = component.badge();

      // Assert
      expect(badge.text).toBe("Active");
      expect(badge.variant).toBe("success");
    });

    it('should display "Trial" badge with success variant for trialing status', () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockTrialingSubscription);
      fixture.detectChanges();

      // Act
      const badge = component.badge();

      // Assert
      expect(badge.text).toBe("Trial");
      expect(badge.variant).toBe("success");
    });

    it('should display "Past due" badge with warning variant for past_due status', () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockPastDueSubscription);
      fixture.detectChanges();

      // Act
      const badge = component.badge();

      // Assert
      expect(badge.text).toBe("Past due");
      expect(badge.variant).toBe("warning");
    });

    it('should display "Canceled" badge with danger variant for canceled status', () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockCanceledSubscription);
      fixture.detectChanges();

      // Act
      const badge = component.badge();

      // Assert
      expect(badge.text).toBe("Canceled");
      expect(badge.variant).toBe("danger");
    });

    it('should display "Unpaid" badge with danger variant for unpaid status', () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockUnpaidSubscription);
      fixture.detectChanges();

      // Act
      const badge = component.badge();

      // Assert
      expect(badge.text).toBe("Unpaid");
      expect(badge.variant).toBe("danger");
    });

    it('should display "Incomplete" badge with warning variant for incomplete status', () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockIncompleteSubscription);
      fixture.detectChanges();

      // Act
      const badge = component.badge();

      // Assert
      expect(badge.text).toBe("Incomplete");
      expect(badge.variant).toBe("warning");
    });

    it('should display "Expired" badge with danger variant for incomplete_expired status', () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockIncompleteExpiredSubscription);
      fixture.detectChanges();

      // Act
      const badge = component.badge();

      // Assert
      expect(badge.text).toBe("Expired");
      expect(badge.variant).toBe("danger");
    });
  });

  describe("Callout Display", () => {
    it("should not display callout for active status without upgrade feature flag", () => {
      // Act
      const callout = component.callout();

      // Assert
      expect(callout).toBeNull();
    });

    it("should display upgrade callout for active status with feature flag enabled", () => {
      // Arrange - Recreate component with feature flag enabled
      mockConfigService.getFeatureFlag$.mockReturnValue(new BehaviorSubject(true));
      fixture = TestBed.createComponent(SubscriptionCardComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput("title", "Premium membership");
      fixture.componentRef.setInput("subscription", mockActiveSubscription);
      fixture.detectChanges();

      // Act
      const callout = component.callout();

      // Assert
      expect(callout).toBeTruthy();
      expect(callout?.title).toBe("Upgrade your plan");
      expect(callout?.type).toBe("info");
      expect(callout?.icon).toBe("bwi-gem");
      expect(callout?.callToAction?.text).toBe("Upgrade now");
      expect(callout?.callToAction?.action).toBe("upgrade-plan");
    });

    it("should display warning callout for incomplete status", () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockIncompleteSubscription);
      fixture.detectChanges();

      // Act
      const callout = component.callout();

      // Assert
      expect(callout).toBeTruthy();
      expect(callout?.title).toBe("Incomplete");
      expect(callout?.type).toBe("warning");
      expect(callout?.callToAction?.action).toBe("contact-support");
    });

    it("should display warning callout for past_due status with grace period", () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockPastDueSubscription);
      fixture.detectChanges();

      // Act
      const callout = component.callout();

      // Assert
      expect(callout).toBeTruthy();
      expect(callout?.title).toBe("Past due");
      expect(callout?.type).toBe("warning");
      expect(callout?.description).toContain("7 days");
    });

    it("should display danger callout for unpaid status", () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockUnpaidSubscription);
      fixture.detectChanges();

      // Act
      const callout = component.callout();

      // Assert
      expect(callout).toBeTruthy();
      expect(callout?.title).toBe("Unpaid");
      expect(callout?.type).toBe("danger");
      expect(callout?.description).toContain("resolve the past due invoices");
    });

    it("should not display callout for canceled status", () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockCanceledSubscription);
      fixture.detectChanges();

      // Act
      const callout = component.callout();

      // Assert
      expect(callout).toBeNull();
    });
  });

  describe("Date Computations", () => {
    it("should compute nextCharge for active status", () => {
      // Act
      const nextCharge = component.nextCharge();

      // Assert
      expect(nextCharge).toEqual(mockActiveSubscription.nextCharge);
    });

    it("should compute nextCharge for trialing status", () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockTrialingSubscription);
      fixture.detectChanges();

      // Act
      const nextCharge = component.nextCharge();

      // Assert
      expect(nextCharge).toEqual(mockTrialingSubscription.nextCharge);
    });

    it("should return undefined nextCharge for past_due status", () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockPastDueSubscription);
      fixture.detectChanges();

      // Act
      const nextCharge = component.nextCharge();

      // Assert
      expect(nextCharge).toBeUndefined();
    });

    it("should compute canceled date for canceled status", () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockCanceledSubscription);
      fixture.detectChanges();

      // Act
      const canceled = component.canceled();

      // Assert
      expect(canceled).toEqual(mockCanceledSubscription.canceled);
    });

    it("should return undefined canceled for active status", () => {
      // Act
      const canceled = component.canceled();

      // Assert
      expect(canceled).toBeUndefined();
    });

    it("should compute suspension date for past_due status", () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockPastDueSubscription);
      fixture.detectChanges();

      // Act
      const suspension = component.suspension();

      // Assert
      expect(suspension).toEqual(mockPastDueSubscription.suspension);
    });

    it("should compute suspension date for incomplete status (created + 23 hours)", () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockIncompleteSubscription);
      fixture.detectChanges();

      // Act
      const suspension = component.suspension();

      // Assert
      const expectedSuspension = new Date(
        mockIncompleteSubscription.created.getTime() + 23 * 60 * 60 * 1000,
      );
      expect(suspension).toEqual(expectedSuspension);
    });

    it("should compute suspension date for unpaid status", () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockUnpaidSubscription);
      fixture.detectChanges();

      // Act
      const suspension = component.suspension();

      // Assert
      expect(suspension).toEqual(mockUnpaidSubscription.suspension);
    });
  });

  describe("Call to Action Events", () => {
    it("should emit contact-support action when contact support button is clicked", () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockIncompleteSubscription);
      fixture.detectChanges();

      const emittedActions: PlanCardAction[] = [];
      component.callToActionClicked.subscribe((action: PlanCardAction) => {
        emittedActions.push(action);
      });

      // Act
      const button = fixture.debugElement.query(By.css("button[bitButton]"));
      expect(button).toBeTruthy();
      button.nativeElement.click();

      // Assert
      expect(emittedActions).toHaveLength(1);
      expect(emittedActions[0]).toBe("contact-support");
    });

    it("should emit upgrade-plan action when upgrade button is clicked", () => {
      // Arrange - Recreate component with feature flag enabled
      mockConfigService.getFeatureFlag$.mockReturnValue(new BehaviorSubject(true));
      fixture = TestBed.createComponent(SubscriptionCardComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput("title", "Premium membership");
      fixture.componentRef.setInput("subscription", mockActiveSubscription);
      fixture.detectChanges();

      const emittedActions: PlanCardAction[] = [];
      component.callToActionClicked.subscribe((action: PlanCardAction) => {
        emittedActions.push(action);
      });

      // Act
      const button = fixture.debugElement.query(By.css("button[bitButton]"));
      expect(button).toBeTruthy();
      button.nativeElement.click();

      // Assert
      expect(emittedActions).toHaveLength(1);
      expect(emittedActions[0]).toBe("upgrade-plan");
    });
  });

  describe("UI Rendering", () => {
    it("should display title", () => {
      // Act
      const title = fixture.debugElement.query(By.css("h2[bitTypography='h3']"));

      // Assert
      expect(title).toBeTruthy();
      expect(title.nativeElement.textContent.trim()).toBe("Premium membership");
    });

    it("should display cart summary component", () => {
      // Act
      const cartSummary = fixture.debugElement.query(By.css("billing-cart-summary"));

      // Assert
      expect(cartSummary).toBeTruthy();
    });

    it("should display status badge in header", () => {
      // Act
      const badge = fixture.debugElement.query(By.css("span[bitBadge]"));

      // Assert
      expect(badge).toBeTruthy();
      expect(badge.nativeElement.textContent.trim()).toBe("Active");
    });

    it("should display callout when present", () => {
      // Arrange
      fixture.componentRef.setInput("subscription", mockIncompleteSubscription);
      fixture.detectChanges();

      // Act
      const callout = fixture.debugElement.query(By.css("bit-callout"));

      // Assert
      expect(callout).toBeTruthy();
    });

    it("should not display callout when null", () => {
      // Act - Active status without feature flag should have null callout
      const callout = fixture.debugElement.query(By.css("bit-callout"));

      // Assert
      expect(callout).toBeFalsy();
    });

    it("should display callout with icon when icon is provided", () => {
      // Arrange - Recreate component with feature flag enabled
      mockConfigService.getFeatureFlag$.mockReturnValue(new BehaviorSubject(true));
      fixture = TestBed.createComponent(SubscriptionCardComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput("title", "Premium membership");
      fixture.componentRef.setInput("subscription", mockActiveSubscription);
      fixture.detectChanges();

      // Act
      const callout = fixture.debugElement.query(By.css("bit-callout"));

      // Assert
      expect(callout).toBeTruthy();
      expect(callout.componentInstance.icon()).toBe("bwi-gem");
    });
  });
});
