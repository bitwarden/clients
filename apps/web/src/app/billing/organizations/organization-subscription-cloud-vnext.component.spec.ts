import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, Observable, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
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
      ],
    });

    TestBed.overrideComponent(OrganizationSubscriptionCloudVNextComponent, {
      remove: {
        imports: [
          HeaderModule,
          AdjustSubscription,
          SecretsManagerSubscribeStandaloneComponent,
          SecretsManagerAdjustSubscriptionComponent,
        ],
      },
      add: {
        imports: [
          MockWebHeaderComponent,
          MockAdjustSubscriptionComponent,
          MockSmSubscribeStandaloneComponent,
          MockSmAdjustSubscriptionComponent,
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

  describe("access visibility", () => {
    it("shows the subscription section when the org can view it", () => {
      createComponent({ organization: buildOrganization({ canViewSubscription: true }) });
      expect(component.showSubscription()).toBe(true);
    });

    it("shows self-host when the plan allows self-hosting", () => {
      createComponent({
        organization: buildOrganization({ selfHost: true }),
      });
      expect(component.showSelfHost()).toBe(true);
    });

    it("shows the consolidated-billing MSP section only for billable-provider-managed orgs", () => {
      createComponent({
        organization: buildOrganization({ hasProvider: true, hasBillableProvider: true }),
      });
      expect(component.showConsolidatedBillingMsp()).toBe(true);
    });
  });

  describe("management section gating", () => {
    it("marks the subscription for cancellation when it cancels at period end", () => {
      createComponent({
        subscription: buildSubscriptionResponse({
          subscription: { cancelAtEndDate: true, cancelled: false, status: "active" } as any,
        }),
      });
      expect(component.subscriptionMarkedForCancel()).toBe(true);
    });

    it("is not marked for cancellation once already cancelled", () => {
      createComponent({
        subscription: buildSubscriptionResponse({
          subscription: { cancelled: true, cancelAtEndDate: true } as any,
        }),
      });
      expect(component.subscriptionMarkedForCancel()).toBe(false);
    });

    it("detects a sponsored subscription from its items", () => {
      createComponent({
        subscription: buildSubscriptionResponse({
          subscription: { items: [{ sponsoredSubscriptionItem: true }], cancelled: false } as any,
        }),
      });
      expect(component.isSponsoredSubscription()).toBe(true);
    });

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

    it("blocks seat adjustment for an sm-standalone discount", () => {
      createComponent({
        organization: buildOrganization({ canEditSubscription: true }),
        subscription: buildSubscriptionResponse({
          customerDiscount: { id: "sm-standalone" } as any,
        }),
      });
      expect(component.canAdjustSubscription()).toBe(false);
    });

    it("allows seat adjustment for an editable active subscription", () => {
      createComponent({ organization: buildOrganization({ canEditSubscription: true }) });
      expect(component.canAdjustSubscription()).toBe(true);
    });

    it("enables billing sync only for enterprise", () => {
      createComponent({
        organization: buildOrganization({ productTierType: ProductTierType.Enterprise }),
      });
      expect(component.canUseBillingSync()).toBe(true);
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
        organization: buildOrganization({ canViewSubscription: true, canEditSubscription: false }),
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
        organization: buildOrganization({ canViewSubscription: true, canEditSubscription: false }),
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

  describe("callout suppression", () => {
    it("hides the card callout for a reseller org exempt from billing automation", () => {
      createComponent({
        organization: buildOrganization({ hasReseller: true, canEditSubscription: true }),
        subscription: buildSubscriptionResponse({ exemptFromBillingAutomation: true }),
      });

      expect(component.hideSubscriptionCallout()).toBe(true);
    });

    it("does not hide the callout when the org is not a reseller", () => {
      createComponent({
        organization: buildOrganization({ hasReseller: false, canEditSubscription: true }),
        subscription: buildSubscriptionResponse({ exemptFromBillingAutomation: true }),
      });

      expect(component.hideSubscriptionCallout()).toBe(false);
    });

    it("does not hide the callout when the reseller org is not exempt", () => {
      createComponent({
        organization: buildOrganization({ hasReseller: true, canEditSubscription: true }),
        subscription: buildSubscriptionResponse({ exemptFromBillingAutomation: false }),
      });

      expect(component.hideSubscriptionCallout()).toBe(false);
    });

    it("hides the callout when the owner cannot edit the subscription", () => {
      createComponent({
        organization: buildOrganization({ hasReseller: false, canEditSubscription: false }),
        subscription: buildSubscriptionResponse({ exemptFromBillingAutomation: false }),
      });

      expect(component.hideSubscriptionCallout()).toBe(true);
    });
  });

  describe("provider-managed messaging", () => {
    it("shows the provider-managed fallback message for a non-provider user", async () => {
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
  });
});
