import { importProvidersFrom } from "@angular/core";
import { Router } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { Vfo1TerminologyService } from "@bitwarden/vault";
import {
  PreviewInvoiceClient,
  SubscriberBillingClient,
} from "@bitwarden/web-vault/app/billing/clients";

import { PreloadedEnglishI18nModule } from "../../core/tests";
import { PremiumOrgUpgradeService } from "../individual/upgrade/premium-org-upgrade-payment/services/premium-org-upgrade.service";
import { SubscriptionDiscountService } from "../services/subscription-discount.service";

import { OrganizationPlansComponent } from "./organization-plans.component";

const createMockPlans = (): PlanResponse[] =>
  [
    {
      type: PlanType.Free,
      productTier: ProductTierType.Free,
      name: "Free",
      isAnnual: true,
      nameLocalizationKey: "planNameFree",
      descriptionLocalizationKey: "planDescFree",
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
      nameLocalizationKey: "planNameFamilies",
      descriptionLocalizationKey: "planDescFamilies",
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
      nameLocalizationKey: "planNameTeams",
      descriptionLocalizationKey: "planDescTeams",
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
      nameLocalizationKey: "planNameEnterprise",
      descriptionLocalizationKey: "planDescEnterprise",
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

const mockAccountService = {
  activeAccount$: of({ id: "user-1", email: "user@example.com" }),
};
const mockOrganizationService = { organizations$: () => of([]) };
const mockPolicyService = { policyAppliesToUser$: () => of(false) };
const mockPlatformUtilsService = { isSelfHost: () => false };
const mockKeyService = { orgKeys$: () => of({}), providerKeys$: () => of({}) };
const mockLegacyCompatKeyService = {
  makeKeyPair: () => Promise.resolve(["publicKey", { encryptedString: "encryptedPrivateKey" }]),
};
const mockEncryptService: Partial<EncryptService> = {};
const mockRouter = { navigate: () => Promise.resolve(true) };
const mockSyncService: Partial<SyncService> = { fullSync: () => Promise.resolve(true) };
const mockMessagingService = { send: () => {} };
const mockOrganizationApiService: Partial<OrganizationApiServiceAbstraction> = {};
const mockProviderApiService: Partial<ProviderApiServiceAbstraction> = {};
const mockToastService = { showToast: () => {} };
const mockApiService: Partial<ApiService> = {
  getPlans: () => Promise.resolve({ data: createMockPlans() } as any),
};
const mockSubscriberBillingClient: Partial<SubscriberBillingClient> = {
  getBillingAddress: () => Promise.resolve(null),
  getPaymentMethod: () => Promise.resolve(null),
};
const mockPreviewInvoiceClient: Partial<PreviewInvoiceClient> = {
  previewTaxForOrganizationSubscriptionPurchase: () => Promise.resolve({ tax: 0, total: 0 } as any),
};
const mockBillingAccountProfileStateService = {
  hasPremiumPersonally$: () => of(false),
  hasPremiumFromAnySource$: () => of(false),
};
const mockPremiumOrgUpgradeService = {
  SubscriptionTierIdFromProductTier: () => "families",
  isBankAccountNotSupportedError: () => false,
};
const mockSubscriptionDiscountService = {
  getEligibleDiscountsForTier$: () => of([]),
  mapToCartDiscount: (): any => null,
  isDiscountExpiredError: () => false,
  refresh: () => {},
};
const mockConfigService = { getFeatureFlag$: () => of(false) } as unknown as ConfigService;

export default {
  title: "Billing/Organizations/Organization Plans",
  component: OrganizationPlansComponent,
  decorators: [
    moduleMetadata({
      imports: [OrganizationPlansComponent],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: LegacyCompatKeyService, useValue: mockLegacyCompatKeyService },
        { provide: EncryptService, useValue: mockEncryptService },
        { provide: Router, useValue: mockRouter },
        { provide: SyncService, useValue: mockSyncService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: MessagingService, useValue: mockMessagingService },
        { provide: OrganizationApiServiceAbstraction, useValue: mockOrganizationApiService },
        { provide: ProviderApiServiceAbstraction, useValue: mockProviderApiService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: SubscriberBillingClient, useValue: mockSubscriberBillingClient },
        { provide: PreviewInvoiceClient, useValue: mockPreviewInvoiceClient },
        {
          provide: BillingAccountProfileStateService,
          useValue: mockBillingAccountProfileStateService,
        },
        { provide: PremiumOrgUpgradeService, useValue: mockPremiumOrgUpgradeService },
        { provide: SubscriptionDiscountService, useValue: mockSubscriptionDiscountService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<OrganizationPlansComponent>;

/**
 * Organization plan selection (create-organization flow) — the feature list includes
 * "Create unlimited collections" and "X collections" limit copy per plan.
 */
export const Default: Story = {
  render: () => ({
    template: `<app-organization-plans></app-organization-plans>`,
  }),
};

/**
 * With the VFO1 terminology flag on — the feature list and limit copy render "shared folders"
 * instead of "collections".
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
    template: `<app-organization-plans></app-organization-plans>`,
  }),
};
