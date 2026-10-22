import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationBillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-billing-api.service.abstraction";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { BannerModule, DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { Vfo1I18nPipe, Vfo1TerminologyService } from "@bitwarden/vault";
import {
  SubscriberBillingClient,
  PreviewInvoiceClient,
} from "@bitwarden/web-vault/app/billing/clients";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";

import { PreloadedEnglishI18nModule } from "../../../core/tests";
import { SharedModule } from "../../../shared";
import { BraintreeService, StripeService } from "../../services";
import { PlanCardService } from "../../services/plan-card.service";
import { PricingSummaryService } from "../../services/pricing-summary.service";
import { PlanCardComponent } from "../plan-card/plan-card.component";
import { PricingSummaryComponent } from "../pricing-summary/pricing-summary.component";

import { TrialPaymentDialogComponent } from "./trial-payment-dialog.component";

const ORG_ID = "org-1" as OrganizationId;

const mockOrganization = Object.assign(new Organization(), {
  id: ORG_ID,
  name: "Acme Families",
  productTierType: ProductTierType.Families,
  useSecretsManager: false,
});

const mockPlan = {
  type: PlanType.FamiliesAnnually,
  productTier: ProductTierType.Families,
} as unknown as PlanResponse;

const mockSubscription = {
  plan: mockPlan,
  subscription: { items: [] },
  customerDiscount: null,
} as unknown as OrganizationSubscriptionResponse;

const mockDialogData = {
  organizationId: ORG_ID,
  subscription: mockSubscription,
  productTierType: ProductTierType.Families,
};

const mockDialogRef: Partial<DialogRef> = { close: () => Promise.resolve(undefined as any) };
const mockAccountService = { activeAccount$: of({ id: "user-1", email: "user@example.com" }) };
const mockOrganizationService = { organizations$: () => of([mockOrganization]) };
const mockOrganizationApiService: Partial<OrganizationApiServiceAbstraction> = {};
const mockPlanCardService: Partial<PlanCardService> = {
  getCadenceCards: () => Promise.resolve([]),
};
const mockPricingSummaryService: Partial<PricingSummaryService> = {
  getPricingSummaryData: () =>
    Promise.resolve({
      selectedPlanInterval: "year",
      passwordManagerSeats: 6,
      passwordManagerSeatTotal: 40,
      secretsManagerSeatTotal: 0,
      additionalStorageTotal: 0,
      additionalStoragePriceMonthly: 0,
      additionalServiceAccountTotal: 0,
      totalAppliedDiscount: 0,
      secretsManagerSubtotal: 0,
      passwordManagerSubtotal: 40,
      total: 40,
    }),
};
const mockApiService: Partial<ApiService> = {
  getPlans: () => Promise.resolve({ data: [] } as any),
};
const mockToastService = { showToast: () => {} };
const mockOrganizationBillingApiService: Partial<OrganizationBillingApiServiceAbstraction> = {};
const mockSubscriberBillingClient: Partial<SubscriberBillingClient> = {
  getBillingAddress: () => Promise.resolve(null),
};
const mockPreviewInvoiceClient: Partial<PreviewInvoiceClient> = {};
const mockLogService: Partial<LogService> = { warning: () => {}, error: () => {} };
// Mocked to avoid injecting real Stripe/Braintree scripts and DOM elements into the story preview.
const mockBraintreeService: Partial<BraintreeService> = {
  loadBraintree: () => {},
  createDropin: () => {},
  requestPaymentMethod: () => Promise.resolve("mock-braintree-nonce"),
  unloadBraintree: () => {},
};
const mockStripeService: Partial<StripeService> = {
  loadStripe: () => {},
  mountElements: () => {},
  unloadStripe: () => {},
  createSetupIntent: () => Promise.resolve("mock-client-secret"),
  setupCardPaymentMethod: () => Promise.resolve("mock-payment-method"),
  setupBankAccountPaymentMethod: () => Promise.resolve("mock-payment-method"),
};
const mockConfigService = { getFeatureFlag$: () => of(false) } as unknown as ConfigService;

export default {
  title: "Billing/Shared/Trial Payment Dialog",
  component: TrialPaymentDialogComponent,
  decorators: [
    moduleMetadata({
      declarations: [TrialPaymentDialogComponent, PlanCardComponent, PricingSummaryComponent],
      imports: [
        SharedModule,
        BannerModule,
        EnterPaymentMethodComponent,
        EnterBillingAddressComponent,
        Vfo1I18nPipe,
      ],
      providers: [
        { provide: DIALOG_DATA, useValue: mockDialogData },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: OrganizationApiServiceAbstraction, useValue: mockOrganizationApiService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: PlanCardService, useValue: mockPlanCardService },
        { provide: PricingSummaryService, useValue: mockPricingSummaryService },
        { provide: ApiService, useValue: mockApiService },
        { provide: ToastService, useValue: mockToastService },
        {
          provide: OrganizationBillingApiServiceAbstraction,
          useValue: mockOrganizationBillingApiService,
        },
        { provide: SubscriberBillingClient, useValue: mockSubscriberBillingClient },
        { provide: PreviewInvoiceClient, useValue: mockPreviewInvoiceClient },
        { provide: BraintreeService, useValue: mockBraintreeService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: LogService, useValue: mockLogService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<TrialPaymentDialogComponent>;

/**
 * Families trial payment dialog — the plan feature list includes "Create unlimited
 * collections".
 */
export const Default: Story = {
  render: () => ({
    template: `<app-trial-payment-dialog></app-trial-payment-dialog>`,
  }),
};

/**
 * With the VFO1 terminology flag on — the plan feature list renders "Create unlimited
 * shared folders" instead.
 */
export const Vfo1Enabled: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: Vfo1TerminologyService,
          useValue: { enabled: () => true, iconClass: (icon: string) => icon },
        },
      ],
    },
    template: `<app-trial-payment-dialog></app-trial-payment-dialog>`,
  }),
};
