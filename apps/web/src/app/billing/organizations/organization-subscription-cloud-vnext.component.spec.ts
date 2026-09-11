import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, Observable, of, Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { SubscriptionCardActions, SubscriptionPreview } from "@bitwarden/subscription";

import { HeaderModule } from "../../layouts/header/header.module";
import { OrganizationBillingClient } from "../clients";

import { AdjustSubscription } from "./adjust-subscription.component";
import { OrganizationSubscriptionCloudVNextComponent } from "./organization-subscription-cloud-vnext.component";
import { OrganizationSubscriptionDataService } from "./organization-subscription-data.service";
import { SecretsManagerAdjustSubscriptionComponent } from "./sm-adjust-subscription.component";
import { SecretsManagerSubscribeStandaloneComponent } from "./sm-subscribe-standalone.component";
import { OrganizationScheduledPriceIncreaseWarningComponent } from "./warnings/components";

// Stub for <app-header> (WebHeaderComponent) so tests don't pull in its route/DI tree.
@Component({
  selector: "app-header",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockWebHeaderComponent {
  readonly title = input<string>();
  readonly icon = input<string>();
}

// Stubs for the management-section child components, which otherwise pull heavy DI (e.g.
// PlatformUtilsService) into detectChanges. They let the management block render harmlessly.
@Component({
  selector: "app-adjust-subscription",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockAdjustSubscriptionComponent {
  readonly seatPrice = input<unknown>();
  readonly organizationId = input<unknown>();
  readonly interval = input<unknown>();
  readonly currentSeatCount = input<unknown>();
  readonly maxAutoscaleSeats = input<unknown>();
  readonly onAdjusted = output<void>();
}

@Component({
  selector: "sm-subscribe-standalone",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockSmSubscribeStandaloneComponent {
  readonly plan = input<unknown>();
  readonly organization = input<unknown>();
  readonly customerDiscount = input<unknown>();
  readonly onSubscribe = output<void>();
}

@Component({
  selector: "app-sm-adjust-subscription",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockSmAdjustSubscriptionComponent {
  readonly organizationId = input<unknown>();
  readonly options = input<unknown>();
  readonly onAdjusted = output<void>();
}

@Component({
  selector: "app-organization-scheduled-price-increase-warning",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockScheduledPriceIncreaseWarningComponent {
  readonly organization = input<unknown>();
}

describe("OrganizationSubscriptionCloudVNextComponent", () => {
  let component: OrganizationSubscriptionCloudVNextComponent;
  let fixture: ComponentFixture<OrganizationSubscriptionCloudVNextComponent>;
  let dataService: jest.Mocked<OrganizationSubscriptionDataService>;
  let i18nService: jest.Mocked<I18nService>;
  let activatedRoute: {
    snapshot: { params: Record<string, string> };
    queryParamMap: Observable<ParamMap>;
  };
  let router: jest.Mocked<Router>;
  let platformUtilsService: jest.Mocked<PlatformUtilsService>;

  const buildOrganization = (overrides: Partial<Organization> = {}): Organization =>
    ({
      id: "org-123",
      name: "Test Org",
      // The default fixture is an independent owner; the resolver reads the isOwner getter in
      // production, so the fixture must carry it for showSubscription to resolve.
      isOwner: true,
      canViewSubscription: true,
      canEditSubscription: false,
      selfHost: false,
      hasProvider: false,
      useSecretsManager: false,
      productTierType: ProductTierType.Teams,
      ...overrides,
    }) as Organization;

  const buildSubscriptionResponse = (
    overrides: Partial<OrganizationSubscriptionResponse> = {},
  ): OrganizationSubscriptionResponse =>
    ({
      id: "org-123",
      planType: PlanType.TeamsAnnually,
      seats: 10,
      maxAutoscaleSeats: 20,
      maxStorageGb: 10,
      storageGb: 5,
      storageName: "5 GB",
      smSeats: 3,
      maxAutoscaleSmSeats: 5,
      maxAutoscaleSmServiceAccounts: 10,
      smServiceAccounts: 60,
      smServiceAccountsGrace: 0,
      customerDiscount: null,
      plan: {
        nameLocalizationKey: "teams",
        name: "Teams",
        isAnnual: true,
        productTier: ProductTierType.Teams,
        PasswordManager: {
          hasAdditionalSeatsOption: true,
          seatPrice: 4,
          additionalStoragePricePerGb: 0.5,
        },
        SecretsManager: {
          hasAdditionalSeatsOption: true,
          seatPrice: 6,
          baseServiceAccount: 50,
          additionalPricePerServiceAccount: 0.5,
        },
      },
      subscription: {
        cancelled: false,
        cancelAtEndDate: false,
        status: "active",
        cancelledDate: null,
        periodEndDate: "2026-01-01",
        items: [],
      },
      ...overrides,
    }) as OrganizationSubscriptionResponse;

  const mockSubscriptionPreview: SubscriptionPreview = {
    status: "active",
    cart: {
      passwordManager: { seats: { translationKey: "pm-seat", quantity: 5, cost: 1000 } },
      cadence: "annually",
      estimatedTax: 0,
    },
  } as SubscriptionPreview;

  /** Sets the data-service returns then constructs the component. Skips change detection by default
   * so the retained-section child components are not instantiated (they have their own DI). */
  const createComponent = (options?: {
    organization?: Organization;
    subscription?: OrganizationSubscriptionResponse | null;
    hasBillingSyncToken?: boolean;
    resellerSeatsRemaining?: number | null;
    detectChanges?: boolean;
  }) => {
    dataService.organization$.mockReturnValue(of(options?.organization ?? buildOrganization()));
    dataService.organizationSubscription$.mockReturnValue(
      of(options?.subscription === undefined ? buildSubscriptionResponse() : options.subscription),
    );
    dataService.hasBillingSyncToken$.mockReturnValue(of(options?.hasBillingSyncToken ?? false));
    dataService.resellerSeatsRemaining$.mockReturnValue(
      of(options?.resellerSeatsRemaining ?? null),
    );

    fixture = TestBed.createComponent(OrganizationSubscriptionCloudVNextComponent);
    component = fixture.componentInstance;
    if (options?.detectChanges) {
      fixture.detectChanges();
    }
    return component;
  };

  beforeEach(async () => {
    dataService = mock<OrganizationSubscriptionDataService>();
    dataService.getSubscriptionPreview.mockResolvedValue(mockSubscriptionPreview);

    i18nService = mock<I18nService>();
    i18nService.t = jest.fn((key: string) => key);

    activatedRoute = {
      snapshot: { params: { organizationId: "org-123" } },
      queryParamMap: of(convertToParamMap({})),
    };
    router = mock<Router>();
    // RouterLink's reactive router state subscribes to router events; the bare mock leaves it
    // undefined, which crashes any template that renders an <a [routerLink]>.
    router.events = new Subject();
    platformUtilsService = mock<PlatformUtilsService>();

    await TestBed.configureTestingModule({
      imports: [OrganizationSubscriptionCloudVNextComponent],
      providers: [
        { provide: OrganizationSubscriptionDataService, useValue: dataService },
        { provide: I18nService, useValue: i18nService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ApiService, useValue: mock<ApiService>() },
        {
          provide: OrganizationApiServiceAbstraction,
          useValue: mock<OrganizationApiServiceAbstraction>(),
        },
        { provide: OrganizationBillingClient, useValue: mock<OrganizationBillingClient>() },
        { provide: ActivatedRoute, useValue: activatedRoute },
        { provide: Router, useValue: router },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        DatePipe,
        { provide: AccountService, useValue: mock<AccountService>() },
      ],
    });

    TestBed.overrideComponent(OrganizationSubscriptionCloudVNextComponent, {
      remove: {
        imports: [
          HeaderModule,
          AdjustSubscription,
          SecretsManagerSubscribeStandaloneComponent,
          SecretsManagerAdjustSubscriptionComponent,
          OrganizationScheduledPriceIncreaseWarningComponent,
        ],
      },
      add: {
        imports: [
          MockWebHeaderComponent,
          MockAdjustSubscriptionComponent,
          MockSmSubscribeStandaloneComponent,
          MockSmAdjustSubscriptionComponent,
          MockScheduledPriceIncreaseWarningComponent,
        ],
      },
    });

    await TestBed.compileComponents();
  });

  it("should create", () => {
    createComponent({ detectChanges: true });
    expect(component).toBeTruthy();
  });

  it("should initialize data services with the organization id", () => {
    createComponent();
    expect(dataService.organization$).toHaveBeenCalledWith("org-123");
    expect(dataService.organizationSubscription$).toHaveBeenCalledWith("org-123");
    expect(dataService.hasBillingSyncToken$).toHaveBeenCalledWith("org-123");
    expect(dataService.resellerSeatsRemaining$).toHaveBeenCalledWith("org-123");
  });

  it("should populate the organization and subscription signals", () => {
    createComponent();
    expect(component.organization()?.id).toBe("org-123");
    expect(component.organizationSubscription()?.id).toBe("org-123");
  });

  it("should load the subscription preview via resource", async () => {
    createComponent({ detectChanges: true });
    await fixture.whenStable();
    expect(dataService.getSubscriptionPreview).toHaveBeenCalledWith("org-123");
    expect(component.subscriptionPreview.status()).toBe("resolved");
  });

  it("should compose the card title from plan name and cadence", () => {
    createComponent();
    expect(component.cardTitle()).toBe("organizationSubscriptionCardTitle");
    expect(i18nService.t).toHaveBeenCalledWith(
      "organizationSubscriptionCardTitle",
      "teams",
      "annualLower",
    );
  });

  it("should return a null card title when the subscription is absent", () => {
    createComponent({ subscription: null });
    expect(component.cardTitle()).toBeNull();
  });

  describe("pending annual upgrade", () => {
    it("overlays the pending annual plan's cadence and effective date on the card subscription", async () => {
      const effectiveDate = new Date("2026-09-17T00:00:00.000Z");
      // The invoice preview describes the current monthly renewal, not the upcoming annual plan.
      dataService.getSubscriptionPreview.mockResolvedValue({
        status: "active",
        nextCharge: new Date("2026-10-10T00:00:00.000Z"),
        cart: {
          passwordManager: { seats: { translationKey: "pm-seat", quantity: 5, cost: 1000 } },
          cadence: "monthly",
          estimatedTax: 0,
        },
      } as SubscriptionPreview);
      createComponent({
        detectChanges: true,
        subscription: buildSubscriptionResponse({
          pendingAnnualUpgrade: {
            plan: { isAnnual: true },
            lineItems: [],
            effectiveDate,
          },
        } as any),
      });
      await fixture.whenStable();

      expect(component.cardSubscription()).toEqual({
        status: "active",
        nextCharge: effectiveDate,
        cart: {
          passwordManager: { seats: { translationKey: "pm-seat", quantity: 5, cost: 1000 } },
          cadence: "annually",
          estimatedTax: 0,
        },
      });
    });

    it("leaves the card subscription untouched when no annual upgrade is pending", async () => {
      createComponent({ detectChanges: true });
      await fixture.whenStable();

      expect(component.cardSubscription()).toEqual(component.subscriptionPreview.value());
    });
  });

  describe("access visibility", () => {
    it("shows the subscription section when the org can view it", () => {
      createComponent({ organization: buildOrganization({ canViewSubscription: true }) });
      expect(component.access()?.showSubscription).toBe(true);
    });

    it("shows self-host when the plan allows self-hosting", () => {
      createComponent({
        organization: buildOrganization({ selfHost: true }),
      });
      expect(component.access()?.showSelfHost).toBe(true);
    });

    it("shows the provider-managed section for billable-provider-managed orgs", () => {
      createComponent({
        organization: buildOrganization({ hasProvider: true, hasBillableProvider: true }),
      });
      expect(component.access()?.showProviderManagedBilling).toBe(true);
    });

    it("shows the plan and status details for a resold organization owner", () => {
      createComponent({
        organization: buildOrganization({
          canViewSubscription: false,
          hasProvider: true,
          hasReseller: true,
          isOwner: true,
        }),
        detectChanges: true,
      });

      const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
      expect(text).toContain("Teams");
      expect(text).toContain("active");
      expect(text).toContain("Jan 1, 2026");
    });

    it("shows the plan and status details for a resold organization provider user", () => {
      createComponent({
        organization: buildOrganization({
          canViewSubscription: false,
          hasProvider: true,
          hasReseller: true,
          isProviderUser: true,
          isOwner: true,
        }),
        detectChanges: true,
      });

      const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
      expect(text).toContain("Teams");
      expect(text).toContain("active");
      expect(text).toContain("Jan 1, 2026");
    });

    it("enables billing sync only for enterprise", () => {
      createComponent({
        organization: buildOrganization({ productTierType: ProductTierType.Enterprise }),
      });
      expect(component.access()?.canUseBillingSync).toBe(true);
    });
  });

  describe("cancellation state", () => {
    it("treats a subscription that cancels at period end as cancelled or pending cancellation", () => {
      createComponent({
        subscription: buildSubscriptionResponse({
          subscription: { cancelAtEndDate: true, cancelled: false, status: "active" } as any,
        }),
      });
      expect(component.isSubscriptionCanceledOrPendingCancellation()).toBe(true);
    });

    it("treats an already cancelled subscription as cancelled or pending cancellation", () => {
      createComponent({
        subscription: buildSubscriptionResponse({
          subscription: { cancelled: true, cancelAtEndDate: true } as any,
        }),
      });
      expect(component.isSubscriptionCanceledOrPendingCancellation()).toBe(true);
    });

    it("does not treat an active subscription as cancelled", () => {
      createComponent();
      expect(component.isSubscriptionCanceledOrPendingCancellation()).toBe(false);
    });

    it("hides the storage and cancellation buttons for a cancelled subscription", async () => {
      createComponent({
        organization: buildOrganization({ canEditSubscription: true }),
        subscription: buildSubscriptionResponse({
          subscription: {
            cancelled: true,
            status: "active",
            cancelAtEndDate: false,
            cancelledDate: null,
            periodEndDate: "2026-01-01",
            items: [],
          } as any,
        }),
        detectChanges: true,
      });
      await fixture.whenStable();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent ?? "";
      // The storage section remains (usage is informational), but its action buttons are gated.
      expect(text).toContain("storage");
      expect(text).not.toContain("addStorage");
      expect(text).not.toContain("removeStorage");
      expect(text).not.toContain("cancelSubscription");
      expect(text).toContain("additionalOptions");
    });
  });

  describe("sponsored subscription", () => {
    it("detects a sponsored subscription from its items", () => {
      createComponent({
        subscription: buildSubscriptionResponse({
          subscription: { items: [{ sponsoredSubscriptionItem: true }], cancelled: false } as any,
        }),
      });
      expect(component.isSponsoredSubscription()).toBe(true);
    });
  });

  describe("change plan gating", () => {
    it("hides the change-plan button for enterprise plans", () => {
      createComponent({
        subscription: buildSubscriptionResponse({
          plan: { productTier: ProductTierType.Enterprise } as any,
        }),
      });
      expect(component.showChangePlanButton()).toBe(false);
    });

    it("shows the change-plan button for non-enterprise active plans", () => {
      createComponent();
      expect(component.showChangePlanButton()).toBe(true);
    });

    it("hides the change-plan button when the subscription is cancelled", () => {
      createComponent({
        subscription: buildSubscriptionResponse({ subscription: { cancelled: true } as any }),
      });
      expect(component.showChangePlanButton()).toBe(false);
    });

    it("still shows the change-plan button for a cancelled free plan", () => {
      createComponent({
        subscription: buildSubscriptionResponse({
          plan: { productTier: ProductTierType.Free } as any,
          subscription: { cancelled: true } as any,
        }),
      });
      expect(component.showChangePlanButton()).toBe(true);
    });
  });

  describe("secrets manager sections", () => {
    it("shows Secrets Manager subscribe when editable and SM is not yet in use", () => {
      createComponent({
        organization: buildOrganization({ canEditSubscription: true, useSecretsManager: false }),
      });
      expect(component.showSecretsManagerSubscribe()).toBe(true);
    });

    it("shows Secrets Manager adjust when SM is in use and editable", () => {
      createComponent({
        organization: buildOrganization({ canEditSubscription: true, useSecretsManager: true }),
      });
      expect(component.showAdjustSecretsManager()).toBe(true);
    });

    it("hides Secrets Manager subscribe when the subscription is cancelled", () => {
      createComponent({
        organization: buildOrganization({ canEditSubscription: true, useSecretsManager: false }),
        subscription: buildSubscriptionResponse({ subscription: { cancelled: true } as any }),
      });
      expect(component.showSecretsManagerSubscribe()).toBe(false);
    });

    it("hides Secrets Manager adjust when the subscription is cancelled", () => {
      createComponent({
        organization: buildOrganization({ canEditSubscription: true, useSecretsManager: true }),
        subscription: buildSubscriptionResponse({ subscription: { cancelled: true } as any }),
      });
      expect(component.showAdjustSecretsManager()).toBe(false);
    });
  });

  describe("seat adjustment gating", () => {
    it("blocks seat adjustment for an sm-standalone discount", () => {
      createComponent({
        organization: buildOrganization({ canEditSubscription: true }),
        subscription: buildSubscriptionResponse({
          customerDiscount: { id: "sm-standalone" } as any,
        }),
      });
      expect(component.canAdjustPasswordManagerSeats()).toBe(false);
    });

    it("allows seat adjustment for an editable active subscription", () => {
      createComponent({ organization: buildOrganization({ canEditSubscription: true }) });
      expect(component.canAdjustPasswordManagerSeats()).toBe(true);
    });

    it("blocks seat adjustment when the subscription is cancelled", () => {
      createComponent({
        organization: buildOrganization({ canEditSubscription: true }),
        subscription: buildSubscriptionResponse({ subscription: { cancelled: true } as any }),
      });
      expect(component.canAdjustPasswordManagerSeats()).toBe(false);
    });
  });

  describe("derived view state", () => {
    it("applies a percentage discount to the seat price", () => {
      createComponent({
        subscription: buildSubscriptionResponse({ customerDiscount: { percentOff: 25 } as any }),
      });
      expect(component.seatPrice()).toBe(3); // 4 - 25%
    });

    it("computes storage usage percentage", () => {
      createComponent(); // 5 of 10 GB
      expect(component.storagePercentage()).toBe(50);
    });

    it("builds Secrets Manager options from the subscription", () => {
      createComponent();
      const options = component.smOptions();
      expect(options?.seatCount).toBe(3);
      expect(options?.additionalServiceAccounts).toBe(10); // 60 - 50 base - 0 grace
      expect(options?.interval).toBe("year");
    });

    it("subtracts grace service accounts from the billable additional count", () => {
      createComponent({
        subscription: buildSubscriptionResponse({ smServiceAccountsGrace: 7 }),
      });
      const options = component.smOptions();
      expect(options?.additionalServiceAccounts).toBe(3); // 60 - 50 base - 7 grace
      expect(options?.graceServiceAccounts).toBe(7);
    });

    it("titles the card from the current plan when no annual upgrade is pending", () => {
      createComponent();
      component.cardTitle();

      expect(i18nService.t).toHaveBeenCalledWith(
        "organizationSubscriptionCardTitle",
        "teams",
        "annualLower",
      );
    });

    it("titles the card from the pending annual upgrade's plan", () => {
      createComponent({
        subscription: buildSubscriptionResponse({
          pendingAnnualUpgrade: {
            plan: { nameLocalizationKey: "enterprise", isAnnual: true },
            lineItems: [],
            effectiveDate: "2026-10-01",
          },
        } as any),
      });
      component.cardTitle();

      expect(i18nService.t).toHaveBeenCalledWith(
        "organizationSubscriptionCardTitle",
        "enterprise",
        "annualLower",
      );
    });
  });

  describe("card action handling", () => {
    it("reinstates on the reinstate action", () => {
      createComponent();
      const reinstate = jest.spyOn(component, "reinstate").mockResolvedValue();
      component.handleCardAction(SubscriptionCardActions.ReinstateSubscription);
      expect(reinstate).toHaveBeenCalled();
    });

    it("opens change plan on the upgrade and resubscribe actions", () => {
      createComponent();
      const changePlan = jest.spyOn(component, "changePlan").mockResolvedValue();
      component.handleCardAction(SubscriptionCardActions.UpgradePlan);
      component.handleCardAction(SubscriptionCardActions.Resubscribe);
      expect(changePlan).toHaveBeenCalledTimes(2);
    });

    it("navigates to billing history on the manage-invoices action", () => {
      createComponent();
      component.handleCardAction(SubscriptionCardActions.ManageInvoices);
      expect(router.navigate).toHaveBeenCalledWith(["../history"], { relativeTo: activatedRoute });
    });

    it("navigates to payment details on the update-payment action", () => {
      createComponent();
      component.handleCardAction(SubscriptionCardActions.UpdatePayment);
      expect(router.navigate).toHaveBeenCalledWith(["../payment-details"], {
        relativeTo: activatedRoute,
      });
    });

    it("opens the contact page on the contact-support action", () => {
      createComponent();
      component.handleCardAction(SubscriptionCardActions.ContactSupport);
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith("https://bitwarden.com/contact/");
    });
  });

  describe("preview failure", () => {
    it("shows the error card when the preview cannot be loaded", async () => {
      dataService.getSubscriptionPreview.mockRejectedValue(new Error("billing unavailable"));

      createComponent({
        organization: buildOrganization({ canEditSubscription: true }),
        detectChanges: true,
      });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.subscriptionPreview.status()).toBe("error");
      expect(fixture.nativeElement.textContent).toContain("subscriptionDetailsNotLoading");
      expect(fixture.nativeElement.querySelector("billing-subscription-card")).toBeNull();
    });

    it("reloads the preview when Refresh is clicked", async () => {
      dataService.getSubscriptionPreview.mockRejectedValue(new Error("billing unavailable"));

      createComponent({
        organization: buildOrganization({ canEditSubscription: true }),
        detectChanges: true,
      });
      await fixture.whenStable();
      fixture.detectChanges();

      const reload = jest.spyOn(component.subscriptionPreview, "reload");
      fixture.nativeElement.querySelector("button").click();

      expect(reload).toHaveBeenCalled();
    });

    it("keeps rendering the management section when the preview fails", async () => {
      dataService.getSubscriptionPreview.mockRejectedValue(new Error("billing unavailable"));

      createComponent({
        organization: buildOrganization({ canViewSubscription: true, canEditSubscription: true }),
        detectChanges: true,
      });
      await fixture.whenStable();
      fixture.detectChanges();

      // The preview drives only the card; the management block is an independent `@if` fed by the
      // organization subscription API, so a failed preview shows the error card AND the block.
      expect(component.subscriptionPreview.status()).toBe("error");
      expect(fixture.nativeElement.textContent).toContain("subscriptionDetailsNotLoading");
      expect(fixture.nativeElement.textContent).toContain("manageSubscription");
    });
  });

  describe("subscription preview gating", () => {
    it("fetches the preview when the user can view the subscription", async () => {
      createComponent({ detectChanges: true });
      await fixture.whenStable();

      expect(dataService.getSubscriptionPreview).toHaveBeenCalledWith("org-123");
    });

    it("does not fetch the preview for a resold organization owner", async () => {
      createComponent({
        organization: buildOrganization({
          canViewSubscription: false,
          hasProvider: true,
          hasReseller: true,
          isOwner: true,
        }),
        detectChanges: true,
      });
      await fixture.whenStable();

      expect(dataService.getSubscriptionPreview).not.toHaveBeenCalled();
    });

    it("does not fetch the preview for a provider user", async () => {
      createComponent({
        organization: buildOrganization({
          canViewSubscription: false,
          hasProvider: true,
          hasBillableProvider: true,
          isProviderUser: true,
        }),
        detectChanges: true,
      });
      await fixture.whenStable();

      expect(dataService.getSubscriptionPreview).not.toHaveBeenCalled();
    });
  });

  describe("free organization", () => {
    it("shows the free-plan details table instead of the preview card", async () => {
      // A free org has no Stripe subscription, so the preview is never the source of truth.
      dataService.getSubscriptionPreview.mockRejectedValue(new Error("no subscription"));

      createComponent({
        organization: buildOrganization({
          isFreeOrg: true,
          canEditSubscription: true,
          usePasswordManager: true,
          useSecretsManager: true,
        }),
        detectChanges: true,
      });
      await fixture.whenStable();
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll("tr");
      expect(rows).toHaveLength(2);
      expect(fixture.nativeElement.textContent).toContain("passwordManager");
      expect(fixture.nativeElement.textContent).toContain("secretsManager");
      expect(fixture.nativeElement.textContent).toContain("freeOrganization");
      expect(fixture.nativeElement.querySelector("billing-subscription-card")).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain("subscriptionDetailsNotLoading");
    });

    it("shows storage usage but no add/remove buttons for a free organization", async () => {
      // Matches the legacy page: free orgs see the usage bar, but have no subscription to modify.
      createComponent({
        organization: buildOrganization({ isFreeOrg: true, canEditSubscription: true }),
        subscription: buildSubscriptionResponse({ subscription: null, planType: PlanType.Free }),
        detectChanges: true,
      });
      await fixture.whenStable();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent ?? "";
      expect(text).toContain("storage");
      expect(text).not.toContain("addStorage");
      expect(text).not.toContain("removeStorage");
      // No subscription to cancel, so the cancellation button is hidden.
      expect(text).not.toContain("cancelSubscription");
      // Free orgs still get the upgrade path and the management sections.
      expect(text).toContain("changeBillingPlan");
      expect(text).toContain("manageSubscription");
      expect(text).toContain("subscriptionFreePlan");
      expect(text).toContain("additionalOptions");
      expect(text).toContain("additionalOptionsDesc");
    });
  });

  describe("upgrade deep link", () => {
    it("does not auto-open change plan without the upgrade query param", async () => {
      createComponent();
      const changePlan = jest.spyOn(component, "changePlan").mockResolvedValue();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(changePlan).not.toHaveBeenCalled();
    });

    it("auto-opens change plan once the subscription loads when ?upgrade is present", async () => {
      const queryParamMap = new BehaviorSubject(convertToParamMap({}));
      activatedRoute.queryParamMap = queryParamMap;

      createComponent();
      const changePlan = jest.spyOn(component, "changePlan").mockResolvedValue();
      queryParamMap.next(convertToParamMap({ upgrade: "true" }));
      await fixture.whenStable();

      expect(changePlan).toHaveBeenCalledWith(undefined);
    });

    it("passes the deep-link productTierType to change plan", async () => {
      const queryParamMap = new BehaviorSubject(convertToParamMap({}));
      activatedRoute.queryParamMap = queryParamMap;

      createComponent();
      const changePlan = jest.spyOn(component, "changePlan").mockResolvedValue();
      queryParamMap.next(
        convertToParamMap({
          upgrade: "true",
          productTierType: ProductTierType.Enterprise.toString(),
        }),
      );
      await fixture.whenStable();

      expect(changePlan).toHaveBeenCalledWith(ProductTierType.Enterprise);
    });

    it("ignores an invalid productTierType and falls back to the current tier", async () => {
      const queryParamMap = new BehaviorSubject(convertToParamMap({}));
      activatedRoute.queryParamMap = queryParamMap;

      createComponent();
      const changePlan = jest.spyOn(component, "changePlan").mockResolvedValue();
      queryParamMap.next(
        convertToParamMap({
          upgrade: "true",
          productTierType: "not-a-tier",
        }),
      );
      await fixture.whenStable();

      expect(changePlan).toHaveBeenCalledWith(undefined);
    });

    it("treats an empty productTierType as absent and falls back to the current tier", async () => {
      const queryParamMap = new BehaviorSubject(convertToParamMap({}));
      activatedRoute.queryParamMap = queryParamMap;

      createComponent();
      const changePlan = jest.spyOn(component, "changePlan").mockResolvedValue();
      queryParamMap.next(
        convertToParamMap({
          upgrade: "true",
          productTierType: "",
        }),
      );
      await fixture.whenStable();

      expect(changePlan).toHaveBeenCalledWith(undefined);
    });
  });

  describe("provider-managed messaging", () => {
    it("shows the provider-managed billing message for a non-provider user", async () => {
      createComponent({
        organization: buildOrganization({
          canViewSubscription: false,
          hasProvider: true,
          hasBillableProvider: true,
          isProviderUser: false,
        }),
        detectChanges: true,
      });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("billingManagedByProvider");
      expect(fixture.nativeElement.textContent).toContain("billingContactProviderForAssistance");
    });

    it("shows the provider portal link for a provider user", async () => {
      createComponent({
        organization: buildOrganization({
          canViewSubscription: false,
          hasProvider: true,
          hasBillableProvider: true,
          isProviderUser: true,
        }),
        detectChanges: true,
      });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("manageSubscriptionFromThe");
      expect(fixture.nativeElement.textContent).toContain("providerPortal");
    });
  });
});
