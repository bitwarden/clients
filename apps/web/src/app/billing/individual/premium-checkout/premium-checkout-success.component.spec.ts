import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { BitwardenSubscription, SubscriptionStatuses } from "@bitwarden/subscription";

import { RouterService } from "../../../core/router.service";
import { AccountBillingClient } from "../../clients";

import { PremiumCheckoutSuccessComponent } from "./premium-checkout-success.component";

describe("PremiumCheckoutSuccessComponent", () => {
  let fixture: ComponentFixture<PremiumCheckoutSuccessComponent>;
  let component: PremiumCheckoutSuccessComponent;

  let accountBillingClient: MockProxy<AccountBillingClient>;
  let authService: MockProxy<AuthService>;
  let i18nService: MockProxy<I18nService>;
  let logService: MockProxy<LogService>;
  let router: MockProxy<Router>;
  let routerService: MockProxy<RouterService>;
  let activeAccountStatus$: BehaviorSubject<AuthenticationStatus>;
  let queryParamMap$: BehaviorSubject<ParamMap>;

  const billableSubscription: BitwardenSubscription = {
    status: SubscriptionStatuses.Active,
    nextCharge: new Date("2026-06-01"),
    cart: {
      cadence: "annually",
      estimatedTax: 0,
      passwordManager: {
        seats: {
          translationKey: "premiumMembership",
          quantity: 1,
          cost: 10,
        },
      },
    },
    storage: {
      available: 1,
      readableUsed: "0 MB",
      used: 0,
    },
  };

  const trialingSubscription: BitwardenSubscription = {
    ...billableSubscription,
    status: SubscriptionStatuses.Trialing,
    nextCharge: new Date("2026-07-01"),
  };

  const suspensionWith = (
    status:
      | typeof SubscriptionStatuses.Incomplete
      | typeof SubscriptionStatuses.IncompleteExpired
      | typeof SubscriptionStatuses.PastDue
      | typeof SubscriptionStatuses.Unpaid,
  ): BitwardenSubscription => ({
    status,
    suspension: new Date("2026-06-15"),
    gracePeriod: 7,
    cart: billableSubscription.cart,
    storage: billableSubscription.storage,
  });

  const canceledSubscription: BitwardenSubscription = {
    status: SubscriptionStatuses.Canceled,
    canceled: new Date("2026-06-15"),
    cart: billableSubscription.cart,
    storage: billableSubscription.storage,
  };

  async function setup(status: AuthenticationStatus) {
    activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(status);
    authService.activeAccountStatus$ = activeAccountStatus$;

    fixture = TestBed.createComponent(PremiumCheckoutSuccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    accountBillingClient = mock<AccountBillingClient>();
    authService = mock<AuthService>();
    i18nService = mock<I18nService>();
    logService = mock<LogService>();
    router = mock<Router>();
    routerService = mock<RouterService>();

    i18nService.t.mockImplementation((key) => key);

    queryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    TestBed.configureTestingModule({
      imports: [PremiumCheckoutSuccessComponent],
      providers: [
        { provide: AccountBillingClient, useValue: accountBillingClient },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMap$ } },
        { provide: AuthService, useValue: authService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: logService },
        { provide: Router, useValue: router },
        { provide: RouterService, useValue: routerService },
      ],
    });
  });

  describe("when the user is logged out", () => {
    beforeEach(async () => {
      accountBillingClient.getSubscription.mockResolvedValue(null);
      await setup(AuthenticationStatus.LoggedOut);
    });

    it("does not fetch the subscription", () => {
      expect(accountBillingClient.getSubscription).not.toHaveBeenCalled();
    });

    it("does not render the detail card", () => {
      const dl = fixture.nativeElement.querySelector("dl");
      expect(dl).toBeNull();
    });

    it("does not render the manage-plan CTA", () => {
      const button = fixture.nativeElement.querySelector("[data-testid='manage-plan-button']");
      expect(button).toBeNull();
    });

    it("renders the static success copy immediately without a spinner", () => {
      const heading = fixture.nativeElement.querySelector("h1");
      expect(heading).not.toBeNull();
      const spinner = fixture.nativeElement.querySelector("bit-icon[name='bwi-spinner']");
      expect(spinner).toBeNull();
    });
  });

  describe("when the user is locked", () => {
    beforeEach(async () => {
      accountBillingClient.getSubscription.mockResolvedValue(null);
      await setup(AuthenticationStatus.Locked);
    });

    it("does not fetch the subscription", () => {
      expect(accountBillingClient.getSubscription).not.toHaveBeenCalled();
    });

    it("does not render the manage-plan CTA", () => {
      const button = fixture.nativeElement.querySelector("[data-testid='manage-plan-button']");
      expect(button).toBeNull();
    });
  });

  describe("when the user is authenticated and the subscription is billable", () => {
    beforeEach(async () => {
      accountBillingClient.getSubscription.mockResolvedValue(billableSubscription);
      await setup(AuthenticationStatus.Unlocked);
    });

    it("fetches the subscription", () => {
      expect(accountBillingClient.getSubscription).toHaveBeenCalledTimes(1);
    });

    it("renders the detail rows", () => {
      const dl = fixture.nativeElement.querySelector("dl");
      expect(dl).not.toBeNull();
      const labels = Array.from(dl.querySelectorAll("dt")).map((dt) =>
        (dt as HTMLElement).textContent?.trim(),
      );
      expect(labels).toEqual(["planPurchased", "startDate", "renewalDate", "upgradeStatus"]);
    });

    it("renders the plan name from the cart in the detail card", () => {
      const planRow = fixture.nativeElement.querySelector("dl dd");
      expect((planRow as HTMLElement).textContent).toContain("premiumMembership");
    });

    it("renders the manage-plan CTA", () => {
      const button = fixture.nativeElement.querySelector("[data-testid='manage-plan-button']");
      expect(button).not.toBeNull();
    });

    it("navigates directly to the subscription page when the CTA is clicked", async () => {
      const button = fixture.nativeElement.querySelector(
        "[data-testid='manage-plan-button']",
      ) as HTMLButtonElement;
      button.click();
      await fixture.whenStable();

      expect(router.navigateByUrl).toHaveBeenCalledWith("/settings/subscription/user-subscription");
      expect(routerService.persistLoginRedirectUrl).not.toHaveBeenCalled();
    });

    it("only fetches the subscription once even if the auth status re-emits Unlocked", async () => {
      activeAccountStatus$.next(AuthenticationStatus.Unlocked);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(accountBillingClient.getSubscription).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the subscription is Trialing", () => {
    beforeEach(async () => {
      accountBillingClient.getSubscription.mockResolvedValue(trialingSubscription);
      await setup(AuthenticationStatus.Unlocked);
    });

    it("renders the renewal date from nextCharge", () => {
      const dl = fixture.nativeElement.querySelector("dl");
      expect(dl).not.toBeNull();
      const labels = Array.from(dl.querySelectorAll("dt")).map((dt) =>
        (dt as HTMLElement).textContent?.trim(),
      );
      expect(labels).toContain("renewalDate");
    });
  });

  describe.each([
    ["incomplete", SubscriptionStatuses.Incomplete],
    ["incomplete_expired", SubscriptionStatuses.IncompleteExpired],
    ["past_due", SubscriptionStatuses.PastDue],
    ["unpaid", SubscriptionStatuses.Unpaid],
  ] as const)("when the subscription is %s (suspended)", (_label, status) => {
    beforeEach(async () => {
      accountBillingClient.getSubscription.mockResolvedValue(
        suspensionWith(
          status as
            | typeof SubscriptionStatuses.Incomplete
            | typeof SubscriptionStatuses.IncompleteExpired
            | typeof SubscriptionStatuses.PastDue
            | typeof SubscriptionStatuses.Unpaid,
        ),
      );
      await setup(AuthenticationStatus.Unlocked);
    });

    it("renders the detail card without a renewal date row", () => {
      const dl = fixture.nativeElement.querySelector("dl");
      expect(dl).not.toBeNull();
      const labels = Array.from(dl.querySelectorAll("dt")).map((dt) =>
        (dt as HTMLElement).textContent?.trim(),
      );
      expect(labels).not.toContain("renewalDate");
    });
  });

  // The CTA navigation is independent of the subscription fetch result —
  // an unlocked user always gets the button, even if the API returned null
  // (e.g., post-checkout webhook race). The detail card hides itself.
  describe("when the subscription call returns null", () => {
    beforeEach(async () => {
      accountBillingClient.getSubscription.mockResolvedValue(null);
      await setup(AuthenticationStatus.Unlocked);
    });

    it("does not render the detail card", () => {
      const dl = fixture.nativeElement.querySelector("dl");
      expect(dl).toBeNull();
    });

    it("still navigates to the subscription page when the CTA is clicked", async () => {
      const button = fixture.nativeElement.querySelector(
        "[data-testid='manage-plan-button']",
      ) as HTMLButtonElement;
      button.click();
      await fixture.whenStable();

      expect(router.navigateByUrl).toHaveBeenCalledWith("/settings/subscription/user-subscription");
    });
  });

  describe("when the subscription call returns a Canceled subscription (stale webhook)", () => {
    beforeEach(async () => {
      accountBillingClient.getSubscription.mockResolvedValue(canceledSubscription);
      await setup(AuthenticationStatus.Unlocked);
    });

    it("treats the response as no subscription and does not render the detail card", () => {
      expect(component["subscription"]()).toBeNull();
      const dl = fixture.nativeElement.querySelector("dl");
      expect(dl).toBeNull();
    });

    it("calls getSubscription exactly once (no retry)", () => {
      expect(accountBillingClient.getSubscription).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the subscription call throws", () => {
    beforeEach(async () => {
      accountBillingClient.getSubscription.mockRejectedValue(new Error("boom"));
      queryParamMap$.next(convertToParamMap({ session_id: "cs_test_123" }));
      await setup(AuthenticationStatus.Unlocked);
    });

    it("logs the error with the Stripe session id and the error", () => {
      expect(logService.error).toHaveBeenCalledTimes(1);
      const [message, context, error] = logService.error.mock.calls[0];
      expect(message).toContain("PremiumCheckoutSuccess");
      expect(context).toEqual({ sessionId: "cs_test_123" });
      expect(error).toBeInstanceOf(Error);
    });

    it("does not render the detail card", () => {
      const dl = fixture.nativeElement.querySelector("dl");
      expect(dl).toBeNull();
    });

    it("still renders the CTA", () => {
      expect(
        fixture.nativeElement.querySelector("[data-testid='manage-plan-button']"),
      ).not.toBeNull();
    });
  });

  describe("while the subscription fetch is in-flight for an unlocked user", () => {
    it("renders a spinner and hides the detail card until the fetch resolves", async () => {
      let resolveFetch: (value: BitwardenSubscription | null) => void = () => {};
      accountBillingClient.getSubscription.mockReturnValue(
        new Promise<BitwardenSubscription | null>((resolve) => {
          resolveFetch = resolve;
        }),
      );

      activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(
        AuthenticationStatus.Unlocked,
      );
      authService.activeAccountStatus$ = activeAccountStatus$;

      fixture = TestBed.createComponent(PremiumCheckoutSuccessComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("bit-icon[name='bwi-spinner']")).not.toBeNull();
      expect(fixture.nativeElement.querySelector("dl")).toBeNull();
      expect(fixture.nativeElement.querySelector("h1")).toBeNull();

      resolveFetch(billableSubscription);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("bit-icon[name='bwi-spinner']")).toBeNull();
      expect(fixture.nativeElement.querySelector("dl")).not.toBeNull();
    });
  });

  describe("status badge", () => {
    const cases: Array<[string, () => BitwardenSubscription | null]> = [
      ["Active", () => billableSubscription],
      ["Trialing", () => trialingSubscription],
      ["incomplete", () => suspensionWith(SubscriptionStatuses.Incomplete)],
      ["incomplete_expired", () => suspensionWith(SubscriptionStatuses.IncompleteExpired)],
      ["past_due", () => suspensionWith(SubscriptionStatuses.PastDue)],
      ["unpaid", () => suspensionWith(SubscriptionStatuses.Unpaid)],
      ["no subscription", () => null],
    ];

    it.each(cases)(
      "always shows 'Processing' (info variant) regardless of subscription status (%s)",
      async (_label: string, getSubscription: () => BitwardenSubscription | null) => {
        accountBillingClient.getSubscription.mockResolvedValue(getSubscription());
        await setup(AuthenticationStatus.Unlocked);

        expect(component["statusBadge"].variant).toBe("info");
        expect(component["statusBadge"].textKey).toBe("subscriptionStatusProcessing");
      },
    );
  });
});
