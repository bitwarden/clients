import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { SubscriptionCardActions, SubscriptionPreview } from "@bitwarden/subscription";

import { OrganizationBillingClient } from "../clients";

import { OrganizationSubscriptionCloudVNextComponent } from "./organization-subscription-cloud-vnext.component";
import { OrganizationSubscriptionDataService } from "./organization-subscription-data.service";

describe("OrganizationSubscriptionCloudVNextComponent", () => {
  let component: OrganizationSubscriptionCloudVNextComponent;
  let fixture: ComponentFixture<OrganizationSubscriptionCloudVNextComponent>;
  let dataService: jest.Mocked<OrganizationSubscriptionDataService>;
  let i18nService: jest.Mocked<I18nService>;

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
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { organizationId: "org-123" } } },
        },
      ],
    }).compileComponents();
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
    expect(component.subscription.status()).toBe("resolved");
  });

  it("should compose the card title from plan name and cadence", () => {
    createComponent();
    expect(component.cardTitle()).toBe("teams annual");
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

    it("shows self-host only when the org can edit and self-hosts", () => {
      createComponent({
        organization: buildOrganization({ canEditSubscription: true, selfHost: true }),
      });
      expect(component.showSelfHost()).toBe(true);
    });

    it("shows the consolidated-billing MSP section only for provider-managed orgs", () => {
      createComponent({ organization: buildOrganization({ hasProvider: true }) });
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

    it("does nothing for actions the page does not handle", () => {
      createComponent();
      const reinstate = jest.spyOn(component, "reinstate").mockResolvedValue();
      const changePlan = jest.spyOn(component, "changePlan").mockResolvedValue();
      component.handleCardAction(SubscriptionCardActions.ContactSupport);
      component.handleCardAction(SubscriptionCardActions.ManageInvoices);
      component.handleCardAction(SubscriptionCardActions.UpdatePayment);
      expect(reinstate).not.toHaveBeenCalled();
      expect(changePlan).not.toHaveBeenCalled();
    });
  });
});
