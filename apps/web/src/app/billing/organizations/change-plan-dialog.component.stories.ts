import { importProvidersFrom } from "@angular/core";
import { Router } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { Vfo1TerminologyService } from "@bitwarden/vault";
import {
  PreviewInvoiceClient,
  SubscriberBillingClient,
} from "@bitwarden/web-vault/app/billing/clients";

import { PreloadedEnglishI18nModule } from "../../core/tests";
import { BillingNotificationService } from "../services/billing-notification.service";

// NOTE: ChangePlanDialogComponent must be imported before OrganizationWarningsService.
// The component injects OrganizationWarningsService, which in turn imports
// `openChangePlanDialog` from this component (used lazily, inside a method body). Importing
// OrganizationWarningsService first here would force that circular pair to initialize in the
// opposite order from how the real app loads them, leaving OrganizationWarningsService
// undefined when the component's decorator metadata is evaluated.
import { ChangePlanDialogComponent } from "./change-plan-dialog.component";

// eslint-disable-next-line import/order
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

const ORG_ID = "org-1" as OrganizationId;

const createMockPlans = (): PlanResponse[] =>
  [
    {
      type: PlanType.Free,
      productTier: ProductTierType.Free,
      name: "Free",
      isAnnual: true,
      upgradeSortOrder: 1,
      displaySortOrder: 1,
      PasswordManager: {
        basePrice: 0,
        seatPrice: 0,
        maxSeats: 2,
        baseSeats: 2,
        hasAdditionalSeatsOption: false,
        hasAdditionalStorageOption: false,
        hasPremiumAccessOption: false,
        baseStorageGb: 0,
      },
      SecretsManager: null,
    },
    {
      type: PlanType.FamiliesAnnually,
      productTier: ProductTierType.Families,
      name: "Families",
      isAnnual: true,
      upgradeSortOrder: 2,
      displaySortOrder: 2,
      PasswordManager: {
        basePrice: 40,
        seatPrice: 0,
        maxSeats: 6,
        baseSeats: 6,
        hasAdditionalSeatsOption: false,
        hasAdditionalStorageOption: true,
        hasPremiumAccessOption: false,
        baseStorageGb: 1,
        additionalStoragePricePerGb: 4,
      },
      SecretsManager: null,
    },
    {
      type: PlanType.TeamsAnnually,
      productTier: ProductTierType.Teams,
      name: "Teams",
      isAnnual: true,
      canBeUsedByBusiness: true,
      upgradeSortOrder: 3,
      displaySortOrder: 3,
      PasswordManager: {
        basePrice: 0,
        seatPrice: 48,
        hasAdditionalSeatsOption: true,
        hasAdditionalStorageOption: true,
        hasPremiumAccessOption: true,
        baseStorageGb: 1,
        additionalStoragePricePerGb: 4,
        premiumAccessOptionPrice: 40,
      },
      SecretsManager: {
        basePrice: 0,
        seatPrice: 72,
        hasAdditionalSeatsOption: true,
        hasAdditionalServiceAccountOption: true,
        baseServiceAccount: 50,
        additionalPricePerServiceAccount: 6,
      },
    },
    {
      type: PlanType.EnterpriseAnnually,
      productTier: ProductTierType.Enterprise,
      name: "Enterprise",
      isAnnual: true,
      canBeUsedByBusiness: true,
      trialPeriodDays: 7,
      upgradeSortOrder: 4,
      displaySortOrder: 4,
      PasswordManager: {
        basePrice: 0,
        seatPrice: 72,
        hasAdditionalSeatsOption: true,
        hasAdditionalStorageOption: true,
        hasPremiumAccessOption: true,
        baseStorageGb: 1,
        additionalStoragePricePerGb: 4,
        premiumAccessOptionPrice: 40,
      },
      SecretsManager: {
        basePrice: 0,
        seatPrice: 144,
        hasAdditionalSeatsOption: true,
        hasAdditionalServiceAccountOption: true,
        baseServiceAccount: 200,
        additionalPricePerServiceAccount: 6,
      },
    },
  ] as unknown as PlanResponse[];

const mockPlans = createMockPlans();
const mockFreePlan = mockPlans[0];

const mockOrganization = Object.assign(new Organization(), {
  id: ORG_ID,
  name: "Acme Corp",
  productTierType: ProductTierType.Free,
  useSecretsManager: false,
  hasPublicAndPrivateKeys: true,
  seats: 2,
});

const mockSubscription = {
  plan: mockFreePlan,
  subscription: null,
  customerDiscount: null,
} as unknown as OrganizationSubscriptionResponse;

const mockDialogData = {
  organizationId: ORG_ID,
  subscription: mockSubscription,
  productTierType: ProductTierType.Free,
};

const mockDialogRef: Partial<DialogRef> = { close: () => Promise.resolve(undefined as any) };
const mockAccountService = { activeAccount$: of({ id: "user-1", email: "user@example.com" }) };
const mockOrganizationService = { organizations$: () => of([mockOrganization]) };
const mockOrganizationApiService: Partial<OrganizationApiServiceAbstraction> = {};
const mockPolicyService = { policiesByType$: () => of([]), policyAppliesToUser$: () => of(false) };
const mockKeyService = { orgKeys$: () => of({}) };
const mockLegacyCompatKeyService = {
  makeKeyPair: () => Promise.resolve(["publicKey", { encryptedString: "encryptedPrivateKey" }]),
};
const mockSyncService: Partial<SyncService> = { fullSync: () => Promise.resolve(true) };
const mockMessagingService = { send: () => {} };
const mockApiService: Partial<ApiService> = {
  getPlans: () => Promise.resolve({ data: mockPlans } as any),
};
const mockToastService = { showToast: () => {} };
const mockRouter = { navigate: () => Promise.resolve(true) };
const mockSubscriberBillingClient: Partial<SubscriberBillingClient> = {
  getBillingAddress: () => Promise.resolve({ country: "US", postalCode: "12345" } as any),
  getPaymentMethod: () => Promise.resolve(null),
};
const mockPreviewInvoiceClient: Partial<PreviewInvoiceClient> = {
  previewTaxForOrganizationSubscriptionPlanChange: () =>
    Promise.resolve({ tax: 0, total: mockPlans[3].PasswordManager.basePrice } as any),
};
const mockBillingNotificationService: Partial<BillingNotificationService> = {
  handleError: () => {},
};
const mockOrganizationWarningsService: Partial<OrganizationWarningsService> = {
  refreshInactiveSubscriptionWarning: () => {},
};
const mockConfigService = { getFeatureFlag$: () => of(false) } as unknown as ConfigService;

export default {
  title: "Billing/Organizations/Change Plan Dialog",
  component: ChangePlanDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [ChangePlanDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: mockDialogData },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: ToastService, useValue: mockToastService },
        { provide: ApiService, useValue: mockApiService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: LegacyCompatKeyService, useValue: mockLegacyCompatKeyService },
        { provide: Router, useValue: mockRouter },
        { provide: SyncService, useValue: mockSyncService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: MessagingService, useValue: mockMessagingService },
        { provide: OrganizationApiServiceAbstraction, useValue: mockOrganizationApiService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: BillingNotificationService, useValue: mockBillingNotificationService },
        { provide: SubscriberBillingClient, useValue: mockSubscriberBillingClient },
        { provide: PreviewInvoiceClient, useValue: mockPreviewInvoiceClient },
        { provide: OrganizationWarningsService, useValue: mockOrganizationWarningsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<ChangePlanDialogComponent>;

/**
 * Free organization upgrading — the Families plan card's feature list includes
 * "Unlimited collections".
 */
export const Default: Story = {};

/**
 * With the VFO1 terminology flag on — the Families plan card renders "Unlimited shared
 * folders" instead.
 */
export const Vfo1Enabled: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: Vfo1TerminologyService,
          useValue: { enabled: () => true, iconClass: (icon: string) => icon },
        },
      ],
    }),
  ],
};
