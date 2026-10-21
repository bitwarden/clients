import { ChangeDetectionStrategy, Component, forwardRef, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, EMPTY, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { CartSummaryComponent } from "@bitwarden/pricing";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";
import { BillingAddress } from "@bitwarden/web-vault/app/billing/payment/types";

import { BillingNotificationService } from "../services/billing-notification.service";
import { InvoicePreviewService } from "../services/invoice-preview.service";

import { RestartSubscriptionDialogComponent } from "./restart-subscription-dialog.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-enter-payment-method",
  template: "",
  providers: [
    {
      provide: EnterPaymentMethodComponent,
      useExisting: forwardRef(() => StubEnterPaymentMethodComponent),
    },
  ],
})
class StubEnterPaymentMethodComponent {
  readonly group = input<unknown>();
  tokenize = jest.fn();
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-enter-billing-address",
  template: "",
})
class StubEnterBillingAddressComponent {
  readonly group = input<unknown>();
  readonly scenario = input<unknown>();
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "billing-cart-summary",
  template: "",
})
class StubCartSummaryComponent {
  readonly cart = input<unknown>();
}

type DialogHarness = {
  fixture: ComponentFixture<RestartSubscriptionDialogComponent>;
  component: RestartSubscriptionDialogComponent;
};

const plan = (overrides: Partial<PlanResponse>): PlanResponse =>
  ({
    type: PlanType.TeamsAnnually,
    productTier: ProductTierType.Teams,
    isAnnual: true,
    disabled: false,
    nameLocalizationKey: "planNameTeams",
    PasswordManager: {},
    ...overrides,
  }) as PlanResponse;

const savedAddress: BillingAddress = {
  country: "DE",
  postalCode: "10115",
  line1: "Unter den Linden 1",
  line2: null,
  city: "Berlin",
  state: null,
  taxId: { code: "eu_vat", value: "DE123456789" },
};

describe("RestartSubscriptionDialogComponent", () => {
  const organization = { id: "org-id" } as Organization;

  let apiService: ReturnType<typeof mock<ApiService>>;
  let subscriberBillingClient: ReturnType<typeof mock<SubscriberBillingClient>>;
  let billingNotificationService: ReturnType<typeof mock<BillingNotificationService>>;
  let subscriptionPlan: PlanResponse;
  let availablePlans: PlanResponse[];

  const setup = async (): Promise<DialogHarness> => {
    const subscription = {
      plan: subscriptionPlan,
      subscription: { status: "canceled" },
    } as OrganizationSubscriptionResponse;

    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([organization]));
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = new BehaviorSubject({ id: "user-id" } as never);
    const i18nService = mock<I18nService>();
    const router = mock<Router>({ url: "/", events: EMPTY });
    i18nService.t.mockImplementation((key: string) => key);

    apiService.getPlans.mockResolvedValue({ data: availablePlans } as ListResponse<PlanResponse>);

    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: { organizationId: "org-id", subscription } },
        { provide: DialogRef, useValue: mock<DialogRef>() },
        { provide: ApiService, useValue: apiService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: accountService },
        { provide: SubscriberBillingClient, useValue: subscriberBillingClient },
        { provide: BillingNotificationService, useValue: billingNotificationService },
        { provide: InvoicePreviewService, useValue: mock<InvoicePreviewService>() },
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: SyncService, useValue: mock<SyncService>() },
        { provide: Router, useValue: router },
        { provide: OrganizationWarningsService, useValue: mock<OrganizationWarningsService>() },
      ],
    });
    TestBed.overrideComponent(RestartSubscriptionDialogComponent, {
      remove: {
        imports: [EnterPaymentMethodComponent, EnterBillingAddressComponent, CartSummaryComponent],
      },
      add: {
        imports: [
          StubEnterPaymentMethodComponent,
          StubEnterBillingAddressComponent,
          StubCartSummaryComponent,
        ],
      },
    });

    const fixture = TestBed.createComponent(RestartSubscriptionDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance };
  };

  const internals = (harness: DialogHarness) =>
    harness.component as unknown as {
      formGroup: RestartSubscriptionDialogComponent["formGroup"];
      restartPlan: () => PlanResponse | undefined;
      addressLoadFailed: () => boolean;
      addressReady: () => boolean;
      supportsTaxId: () => boolean;
    };

  beforeAll(() => {
    // jsdom does not implement IntersectionObserver, which bit-dialog uses internally.
    global.IntersectionObserver = class {
      disconnect() {}
      observe() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      unobserve() {}
    } as unknown as typeof IntersectionObserver;
  });

  beforeEach(() => {
    apiService = mock<ApiService>();
    subscriberBillingClient = mock<SubscriberBillingClient>();
    subscriberBillingClient.getBillingAddress.mockResolvedValue(savedAddress);
    billingNotificationService = mock<BillingNotificationService>();
    subscriptionPlan = plan({});
    availablePlans = [subscriptionPlan];
  });

  describe("billing address prefill", () => {
    it("prefills the billing address, including the tax ID, from the saved address", async () => {
      const dialog = internals(await setup());

      const address = dialog.formGroup.controls.billingAddress.getRawValue();
      expect(address.country).toBe("DE");
      expect(address.postalCode).toBe("10115");
      expect(address.taxId).toBe("DE123456789");
      expect(dialog.addressReady()).toBe(true);
    });

    it("leaves the address blank when no address is saved", async () => {
      subscriberBillingClient.getBillingAddress.mockResolvedValue(null);

      const dialog = internals(await setup());

      const address = dialog.formGroup.controls.billingAddress.getRawValue();
      expect(address.country).toBe("");
      expect(address.postalCode).toBe("");
      expect(dialog.addressLoadFailed()).toBe(false);
      expect(dialog.addressReady()).toBe(true);
    });

    it("flags an address load failure and reports it", async () => {
      const error = new Error("boom");
      subscriberBillingClient.getBillingAddress.mockRejectedValue(error);

      const dialog = internals(await setup());

      expect(dialog.addressLoadFailed()).toBe(true);
      expect(billingNotificationService.handleError).toHaveBeenCalledWith(error);
      expect(dialog.addressReady()).toBe(false);
    });
  });

  describe("restart plan", () => {
    it("resolves the restart plan to the subscription's plan when it is enabled", async () => {
      const dialog = internals(await setup());

      expect(dialog.restartPlan()?.type).toBe(PlanType.TeamsAnnually);
    });

    it("resolves the restart plan to the enabled same-tier, same-cadence plan when the subscription's plan is disabled", async () => {
      subscriptionPlan = plan({ type: PlanType.TeamsAnnually2020, disabled: true });
      availablePlans = [
        subscriptionPlan,
        plan({ type: PlanType.TeamsMonthly, isAnnual: false }),
        plan({ type: PlanType.TeamsAnnually }),
      ];

      const dialog = internals(await setup());

      expect(dialog.restartPlan()?.type).toBe(PlanType.TeamsAnnually);
    });

    it("falls back to the subscription's plan when the disabled plan has no enabled replacement", async () => {
      subscriptionPlan = plan({ type: PlanType.TeamsAnnually2020, disabled: true });
      availablePlans = [subscriptionPlan, plan({ type: PlanType.TeamsMonthly, isAnnual: false })];

      const dialog = internals(await setup());

      expect(dialog.restartPlan()).toBe(subscriptionPlan);
    });

    it("does not support a tax ID for a Families restart plan", async () => {
      subscriptionPlan = plan({
        type: PlanType.FamiliesAnnually,
        productTier: ProductTierType.Families,
      });
      availablePlans = [subscriptionPlan];

      const dialog = internals(await setup());

      expect(dialog.supportsTaxId()).toBe(false);
    });

    it("supports a tax ID for a Teams restart plan", async () => {
      const dialog = internals(await setup());

      expect(dialog.supportsTaxId()).toBe(true);
    });
  });
});
