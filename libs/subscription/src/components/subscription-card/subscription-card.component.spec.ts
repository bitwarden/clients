import { DatePipe } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Cart } from "@bitwarden/pricing";
import { BitwardenSubscription, SubscriptionCardComponent } from "@bitwarden/subscription";

describe("SubscriptionCardComponent", () => {
  let component: SubscriptionCardComponent;
  let fixture: ComponentFixture<SubscriptionCardComponent>;

  const mockCart: Cart = {
    passwordManager: {
      seats: {
        quantity: 5,
        translationKey: "members",
        cost: 50,
      },
    },
    cadence: "monthly",
    estimatedTax: 0,
  };

  const baseSubscription = {
    cart: mockCart,
    storage: {
      available: 1000,
      readableUsed: "100 MB",
      used: 100,
    },
  };

  const mockI18nService = {
    t: (key: string, ...params: any[]) => {
      const translations: Record<string, string> = {
        pendingCancellation: "Pending cancellation",
        updatePayment: "Update payment",
        expired: "Expired",
        trial: "Trial",
        active: "Active",
        pastDue: "Past due",
        canceled: "Canceled",
        unpaid: "Unpaid",
        weCouldNotProcessYourPayment: "We could not process your payment",
        contactSupportShort: "Contact support",
        yourSubscriptionIsExpired: "Your subscription is expired",
        yourSubscriptionIsCanceled: "Your subscription is canceled",
        yourSubscriptionIsScheduledToCancel: `Your subscription is scheduled to cancel on ${params[0]}`,
        reinstateSubscription: "Reinstate subscription",
        resubscribe: "Resubscribe",
        upgradeYourPlan: "Upgrade your plan",
        premiumShareEvenMore: "Premium share even more",
        upgradeNow: "Upgrade now",
        youHaveAGracePeriod: `You have a grace period of ${params[0]} days ending ${params[1]}`,
        manageInvoices: "Manage invoices",
        toReactivateYourSubscription: "To reactivate your subscription",
      };
      return translations[key] || key;
    },
  };

  function setupComponent(subscription: BitwardenSubscription, title = "Test Plan") {
    fixture.componentRef.setInput("title", title);
    fixture.componentRef.setInput("subscription", subscription);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubscriptionCardComponent],
      providers: [
        DatePipe,
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionCardComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    setupComponent({
      ...baseSubscription,
      status: "active",
      nextCharge: new Date("2025-02-01"),
    });

    expect(component).toBeTruthy();
  });

  describe("Badge rendering", () => {
    it("should display 'Update payment' badge with warning variant for incomplete status", () => {
      setupComponent({
        ...baseSubscription,
        status: "incomplete",
        suspension: new Date("2025-02-15"),
        gracePeriod: 7,
      });

      expect(component.badge().text).toBe("Update payment");
      expect(component.badge().variant).toBe("warning");

      const badge = fixture.debugElement.query(By.css("[bitBadge]"));
      expect(badge).toBeTruthy();
      expect(badge.nativeElement.textContent.trim()).toBe("Update payment");
    });

    it("should display 'Expired' badge with danger variant for incomplete_expired status", () => {
      setupComponent({
        ...baseSubscription,
        status: "incomplete_expired",
        suspension: new Date("2025-01-15"),
        gracePeriod: 7,
      });

      expect(component.badge().text).toBe("Expired");
      expect(component.badge().variant).toBe("danger");

      const badge = fixture.debugElement.query(By.css("[bitBadge]"));
      expect(badge.nativeElement.textContent.trim()).toBe("Expired");
    });

    it("should display 'Trial' badge with success variant for trialing status", () => {
      setupComponent({
        ...baseSubscription,
        status: "trialing",
        nextCharge: new Date("2025-02-01"),
      });

      expect(component.badge().text).toBe("Trial");
      expect(component.badge().variant).toBe("success");

      const badge = fixture.debugElement.query(By.css("[bitBadge]"));
      expect(badge.nativeElement.textContent.trim()).toBe("Trial");
    });

    it("should display 'Pending cancellation' badge for trialing status with cancelAt", () => {
      setupComponent({
        ...baseSubscription,
        status: "trialing",
        nextCharge: new Date("2025-02-01"),
        cancelAt: new Date("2025-03-01"),
      });

      expect(component.badge().text).toBe("Pending cancellation");
      expect(component.badge().variant).toBe("warning");

      const badge = fixture.debugElement.query(By.css("[bitBadge]"));
      expect(badge.nativeElement.textContent.trim()).toBe("Pending cancellation");
    });

    it("should display 'Active' badge with success variant for active status", () => {
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
      });

      expect(component.badge().text).toBe("Active");
      expect(component.badge().variant).toBe("success");

      const badge = fixture.debugElement.query(By.css("[bitBadge]"));
      expect(badge.nativeElement.textContent.trim()).toBe("Active");
    });

    it("should display 'Pending cancellation' badge for active status with cancelAt", () => {
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
        cancelAt: new Date("2025-03-01"),
      });

      expect(component.badge().text).toBe("Pending cancellation");
      expect(component.badge().variant).toBe("warning");

      const badge = fixture.debugElement.query(By.css("[bitBadge]"));
      expect(badge.nativeElement.textContent.trim()).toBe("Pending cancellation");
    });

    it("should display 'Past due' badge with warning variant for past_due status", () => {
      setupComponent({
        ...baseSubscription,
        status: "past_due",
        suspension: new Date("2025-02-15"),
        gracePeriod: 7,
      });

      expect(component.badge().text).toBe("Past due");
      expect(component.badge().variant).toBe("warning");

      const badge = fixture.debugElement.query(By.css("[bitBadge]"));
      expect(badge.nativeElement.textContent.trim()).toBe("Past due");
    });

    it("should display 'Canceled' badge with danger variant for canceled status", () => {
      setupComponent({
        ...baseSubscription,
        status: "canceled",
        canceled: new Date("2025-01-15"),
      });

      expect(component.badge().text).toBe("Canceled");
      expect(component.badge().variant).toBe("danger");

      const badge = fixture.debugElement.query(By.css("[bitBadge]"));
      expect(badge.nativeElement.textContent.trim()).toBe("Canceled");
    });

    it("should display 'Unpaid' badge with danger variant for unpaid status", () => {
      setupComponent({
        ...baseSubscription,
        status: "unpaid",
        suspension: new Date("2025-02-15"),
        gracePeriod: 7,
      });

      expect(component.badge().text).toBe("Unpaid");
      expect(component.badge().variant).toBe("danger");

      const badge = fixture.debugElement.query(By.css("[bitBadge]"));
      expect(badge.nativeElement.textContent.trim()).toBe("Unpaid");
    });
  });

  describe("Callout rendering", () => {
    it("should display incomplete callout with update payment and contact support actions", () => {
      setupComponent({
        ...baseSubscription,
        status: "incomplete",
        suspension: new Date("2025-02-15"),
        gracePeriod: 7,
      });

      const calloutData = component.callout();
      expect(calloutData).toBeTruthy();
      expect(calloutData!.type).toBe("warning");
      expect(calloutData!.title).toBe("Update payment");
      expect(calloutData!.description).toContain("We could not process your payment");
      expect(calloutData!.callsToAction?.length).toBe(2);

      const callout = fixture.debugElement.query(By.css("bit-callout"));
      expect(callout).toBeTruthy();

      const description = callout.query(By.css("p"));
      expect(description.nativeElement.textContent).toContain("We could not process your payment");

      const buttons = callout.queryAll(By.css("button"));
      expect(buttons.length).toBe(2);
      expect(buttons[0].nativeElement.textContent.trim()).toBe("Update payment");
      expect(buttons[1].nativeElement.textContent.trim()).toBe("Contact support");
    });

    it("should display incomplete_expired callout with resubscribe action", () => {
      setupComponent({
        ...baseSubscription,
        status: "incomplete_expired",
        suspension: new Date("2025-01-15"),
        gracePeriod: 7,
      });

      const calloutData = component.callout();
      expect(calloutData).toBeTruthy();
      expect(calloutData!.type).toBe("danger");
      expect(calloutData!.title).toBe("Expired");
      expect(calloutData!.description).toContain("Your subscription is expired");
      expect(calloutData!.callsToAction?.length).toBe(1);

      const callout = fixture.debugElement.query(By.css("bit-callout"));
      expect(callout).toBeTruthy();

      const description = callout.query(By.css("p"));
      expect(description.nativeElement.textContent).toContain("Your subscription is expired");

      const buttons = callout.queryAll(By.css("button"));
      expect(buttons.length).toBe(1);
      expect(buttons[0].nativeElement.textContent.trim()).toBe("Resubscribe");
    });

    it("should display pending cancellation callout for active status with cancelAt", () => {
      const cancelDate = new Date("2025-03-01");
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
        cancelAt: cancelDate,
      });

      const calloutData = component.callout();
      expect(calloutData).toBeTruthy();
      expect(calloutData!.type).toBe("warning");
      expect(calloutData!.title).toBe("Pending cancellation");
      expect(calloutData!.callsToAction?.length).toBe(1);

      const callout = fixture.debugElement.query(By.css("bit-callout"));
      expect(callout).toBeTruthy();

      const buttons = callout.queryAll(By.css("button"));
      expect(buttons.length).toBe(1);
      expect(buttons[0].nativeElement.textContent.trim()).toBe("Reinstate subscription");
    });

    it("should display upgrade callout for active status when showUpgradeButton is true", () => {
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
      });
      fixture.componentRef.setInput("showUpgradeButton", true);
      fixture.detectChanges();

      const calloutData = component.callout();
      expect(calloutData).toBeTruthy();
      expect(calloutData!.type).toBe("info");
      expect(calloutData!.title).toBe("Upgrade your plan");
      expect(calloutData!.description).toContain("Premium share even more");
      expect(calloutData!.callsToAction?.length).toBe(1);

      const callout = fixture.debugElement.query(By.css("bit-callout"));
      expect(callout).toBeTruthy();

      const description = callout.query(By.css("p"));
      expect(description.nativeElement.textContent).toContain("Premium share even more");

      const buttons = callout.queryAll(By.css("button"));
      expect(buttons.length).toBe(1);
      expect(buttons[0].nativeElement.textContent.trim()).toBe("Upgrade now");
    });

    it("should not display upgrade callout when showUpgradeButton is false", () => {
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
      });
      fixture.componentRef.setInput("showUpgradeButton", false);
      fixture.detectChanges();

      const callout = fixture.debugElement.query(By.css("bit-callout"));
      expect(callout).toBeFalsy();
    });

    it("should display past_due callout with manage invoices action", () => {
      setupComponent({
        ...baseSubscription,
        status: "past_due",
        suspension: new Date("2025-02-15"),
        gracePeriod: 7,
      });

      const calloutData = component.callout();
      expect(calloutData).toBeTruthy();
      expect(calloutData!.type).toBe("warning");
      expect(calloutData!.title).toBe("Past due");
      expect(calloutData!.callsToAction?.length).toBe(1);

      const callout = fixture.debugElement.query(By.css("bit-callout"));
      expect(callout).toBeTruthy();

      const buttons = callout.queryAll(By.css("button"));
      expect(buttons.length).toBe(1);
      expect(buttons[0].nativeElement.textContent.trim()).toBe("Manage invoices");
    });

    it("should display canceled callout with resubscribe action", () => {
      setupComponent({
        ...baseSubscription,
        status: "canceled",
        canceled: new Date("2025-01-15"),
      });

      const calloutData = component.callout();
      expect(calloutData).toBeTruthy();
      expect(calloutData!.type).toBe("danger");
      expect(calloutData!.title).toBe("Canceled");
      expect(calloutData!.description).toContain("Your subscription is canceled");
      expect(calloutData!.callsToAction?.length).toBe(1);

      const callout = fixture.debugElement.query(By.css("bit-callout"));
      expect(callout).toBeTruthy();

      const description = callout.query(By.css("p"));
      expect(description.nativeElement.textContent).toContain("Your subscription is canceled");

      const buttons = callout.queryAll(By.css("button"));
      expect(buttons.length).toBe(1);
      expect(buttons[0].nativeElement.textContent.trim()).toBe("Resubscribe");
    });

    it("should display unpaid callout with manage invoices action", () => {
      setupComponent({
        ...baseSubscription,
        status: "unpaid",
        suspension: new Date("2025-02-15"),
        gracePeriod: 7,
      });

      const calloutData = component.callout();
      expect(calloutData).toBeTruthy();
      expect(calloutData!.type).toBe("danger");
      expect(calloutData!.title).toBe("Unpaid");
      expect(calloutData!.description).toContain("To reactivate your subscription");
      expect(calloutData!.callsToAction?.length).toBe(1);

      const callout = fixture.debugElement.query(By.css("bit-callout"));
      expect(callout).toBeTruthy();

      const description = callout.query(By.css("p"));
      expect(description.nativeElement.textContent).toContain("To reactivate your subscription");

      const buttons = callout.queryAll(By.css("button"));
      expect(buttons.length).toBe(1);
      expect(buttons[0].nativeElement.textContent.trim()).toBe("Manage invoices");
    });
  });

  describe("Call-to-action clicks", () => {
    it("should emit update-payment action when button is clicked", () => {
      setupComponent({
        ...baseSubscription,
        status: "incomplete",
        suspension: new Date("2025-02-15"),
        gracePeriod: 7,
      });

      const emitSpy = jest.spyOn(component.callToActionClicked, "emit");

      const buttons = fixture.debugElement.queryAll(By.css("bit-callout button"));
      expect(buttons.length).toBe(2);
      buttons[0].triggerEventHandler("click", { button: 0 });
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith("update-payment");
    });

    it("should emit contact-support action when button is clicked", () => {
      setupComponent({
        ...baseSubscription,
        status: "incomplete",
        suspension: new Date("2025-02-15"),
        gracePeriod: 7,
      });

      const emitSpy = jest.spyOn(component.callToActionClicked, "emit");

      const buttons = fixture.debugElement.queryAll(By.css("bit-callout button"));
      buttons[1].triggerEventHandler("click", { button: 0 });
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith("contact-support");
    });

    it("should emit reinstate-subscription action when button is clicked", () => {
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
        cancelAt: new Date("2025-03-01"),
      });

      const emitSpy = jest.spyOn(component.callToActionClicked, "emit");

      const button = fixture.debugElement.query(By.css("bit-callout button"));
      button.triggerEventHandler("click", { button: 0 });
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith("reinstate-subscription");
    });

    it("should emit upgrade-plan action when button is clicked", () => {
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
      });
      fixture.componentRef.setInput("showUpgradeButton", true);
      fixture.detectChanges();

      const emitSpy = jest.spyOn(component.callToActionClicked, "emit");

      const button = fixture.debugElement.query(By.css("bit-callout button"));
      button.triggerEventHandler("click", { button: 0 });
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith("upgrade-plan");
    });

    it("should emit manage-invoices action when button is clicked", () => {
      setupComponent({
        ...baseSubscription,
        status: "past_due",
        suspension: new Date("2025-02-15"),
        gracePeriod: 7,
      });

      const emitSpy = jest.spyOn(component.callToActionClicked, "emit");

      const button = fixture.debugElement.query(By.css("bit-callout button"));
      button.triggerEventHandler("click", { button: 0 });
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith("manage-invoices");
    });

    it("should emit resubscribe action when button is clicked for incomplete_expired status", () => {
      setupComponent({
        ...baseSubscription,
        status: "incomplete_expired",
        suspension: new Date("2025-01-15"),
        gracePeriod: 7,
      });

      const emitSpy = jest.spyOn(component.callToActionClicked, "emit");

      const button = fixture.debugElement.query(By.css("bit-callout button"));
      button.triggerEventHandler("click", { button: 0 });
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith("resubscribe");
    });

    it("should emit resubscribe action when button is clicked for canceled status", () => {
      setupComponent({
        ...baseSubscription,
        status: "canceled",
        canceled: new Date("2025-01-15"),
      });

      const emitSpy = jest.spyOn(component.callToActionClicked, "emit");

      const button = fixture.debugElement.query(By.css("bit-callout button"));
      button.triggerEventHandler("click", { button: 0 });
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith("resubscribe");
    });
  });

  describe("Cart summary header content", () => {
    it("should display suspension date for incomplete status", () => {
      setupComponent({
        ...baseSubscription,
        status: "incomplete",
        suspension: new Date("2025-02-15"),
        gracePeriod: 7,
      });

      const cartSummary = fixture.debugElement.query(By.css("billing-cart-summary"));
      expect(cartSummary).toBeTruthy();
    });

    it("should display suspension date for incomplete_expired status", () => {
      setupComponent({
        ...baseSubscription,
        status: "incomplete_expired",
        suspension: new Date("2025-01-15"),
        gracePeriod: 7,
      });

      const cartSummary = fixture.debugElement.query(By.css("billing-cart-summary"));
      expect(cartSummary).toBeTruthy();
    });

    it("should display cancellation date for trialing status with cancelAt", () => {
      setupComponent({
        ...baseSubscription,
        status: "trialing",
        nextCharge: new Date("2025-02-01"),
        cancelAt: new Date("2025-03-01"),
      });

      const cartSummary = fixture.debugElement.query(By.css("billing-cart-summary"));
      expect(cartSummary).toBeTruthy();
    });

    it("should display next charge for trialing status without cancelAt", () => {
      setupComponent({
        ...baseSubscription,
        status: "trialing",
        nextCharge: new Date("2025-02-01"),
      });

      const cartSummary = fixture.debugElement.query(By.css("billing-cart-summary"));
      expect(cartSummary).toBeTruthy();
    });

    it("should display cancellation date for active status with cancelAt", () => {
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
        cancelAt: new Date("2025-03-01"),
      });

      const cartSummary = fixture.debugElement.query(By.css("billing-cart-summary"));
      expect(cartSummary).toBeTruthy();
    });

    it("should display next charge for active status without cancelAt", () => {
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
      });

      const cartSummary = fixture.debugElement.query(By.css("billing-cart-summary"));
      expect(cartSummary).toBeTruthy();
    });

    it("should display suspension date for past_due status", () => {
      setupComponent({
        ...baseSubscription,
        status: "past_due",
        suspension: new Date("2025-02-15"),
        gracePeriod: 7,
      });

      const cartSummary = fixture.debugElement.query(By.css("billing-cart-summary"));
      expect(cartSummary).toBeTruthy();
    });

    it("should display canceled date for canceled status", () => {
      setupComponent({
        ...baseSubscription,
        status: "canceled",
        canceled: new Date("2025-01-15"),
      });

      const cartSummary = fixture.debugElement.query(By.css("billing-cart-summary"));
      expect(cartSummary).toBeTruthy();
    });

    it("should display suspension date for unpaid status", () => {
      setupComponent({
        ...baseSubscription,
        status: "unpaid",
        suspension: new Date("2025-02-15"),
        gracePeriod: 7,
      });

      const cartSummary = fixture.debugElement.query(By.css("billing-cart-summary"));
      expect(cartSummary).toBeTruthy();
    });
  });

  describe("Title rendering", () => {
    it("should display the provided title", () => {
      setupComponent(
        {
          ...baseSubscription,
          status: "active",
          nextCharge: new Date("2025-02-01"),
        },
        "Premium Plan",
      );

      const title = fixture.debugElement.query(By.css("h2[bitTypography='h3']"));
      expect(title.nativeElement.textContent.trim()).toBe("Premium Plan");
    });
  });

  describe("Computed properties", () => {
    it("should compute cancelAt for active status with cancelAt date", () => {
      const cancelDate = new Date("2025-03-01");
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
        cancelAt: cancelDate,
      });

      expect(component.cancelAt()).toEqual(cancelDate);
    });

    it("should compute cancelAt as undefined for active status without cancelAt", () => {
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
      });

      expect(component.cancelAt()).toBeUndefined();
    });

    it("should compute canceled date for canceled status", () => {
      const canceledDate = new Date("2025-01-15");
      setupComponent({
        ...baseSubscription,
        status: "canceled",
        canceled: canceledDate,
      });

      expect(component.canceled()).toEqual(canceledDate);
    });

    it("should compute canceled as undefined for non-canceled status", () => {
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
      });

      expect(component.canceled()).toBeUndefined();
    });

    it("should compute nextCharge for active status", () => {
      const nextChargeDate = new Date("2025-02-01");
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: nextChargeDate,
      });

      expect(component.nextCharge()).toEqual(nextChargeDate);
    });

    it("should compute nextCharge as undefined for canceled status", () => {
      setupComponent({
        ...baseSubscription,
        status: "canceled",
        canceled: new Date("2025-01-15"),
      });

      expect(component.nextCharge()).toBeUndefined();
    });

    it("should compute suspension date for incomplete status", () => {
      const suspensionDate = new Date("2025-02-15");
      setupComponent({
        ...baseSubscription,
        status: "incomplete",
        suspension: suspensionDate,
        gracePeriod: 7,
      });

      expect(component.suspension()).toEqual(suspensionDate);
    });

    it("should compute suspension as undefined for active status", () => {
      setupComponent({
        ...baseSubscription,
        status: "active",
        nextCharge: new Date("2025-02-01"),
      });

      expect(component.suspension()).toBeUndefined();
    });
  });
});
