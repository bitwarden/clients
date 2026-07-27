import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PremiumCheckoutPendingService } from "@bitwarden/common/billing/abstractions/account/premium-checkout-pending.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadenceIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  ToastOptions,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { PremiumUpgradeDialogComponent } from "./premium-upgrade-dialog.component";

const mockPremiumTier: PersonalSubscriptionPricingTier = {
  id: PersonalSubscriptionPricingTierIds.Premium,
  name: "Premium",
  description: "Complete online security",
  availableCadences: [SubscriptionCadenceIds.Annually],
  passwordManager: {
    type: "standalone",
    annualPrice: 10,
    annualPricePerAdditionalStorageGB: 4,
    providedStorageGB: 1,
    features: [
      { key: "builtInAuthenticator", value: "Built-in authenticator" },
      { key: "secureFileStorage", value: "Secure file storage" },
      { key: "emergencyAccess", value: "Emergency access" },
      { key: "breachMonitoring", value: "Breach monitoring" },
      { key: "andMoreFeatures", value: "And more!" },
    ],
  },
};

const mockPremiumTierNoPricingData: PersonalSubscriptionPricingTier = {
  id: PersonalSubscriptionPricingTierIds.Premium,
  name: "Premium",
  description: "Complete online security",
  availableCadences: [SubscriptionCadenceIds.Annually],
  passwordManager: {
    type: "standalone",
    features: [
      { key: "builtInAuthenticator", value: "Built-in authenticator" },
      { key: "secureFileStorage", value: "Secure file storage" },
      { key: "emergencyAccess", value: "Emergency access" },
      { key: "breachMonitoring", value: "Breach monitoring" },
      { key: "andMoreFeatures", value: "And more!" },
    ],
  },
};

export default {
  title: "Billing/Premium Upgrade Dialog",
  component: PremiumUpgradeDialogComponent,
  description: "A dialog for upgrading to Premium subscription",
  decorators: [
    moduleMetadata({
      imports: [DialogModule, ButtonModule, TypographyModule],
      providers: [
        {
          provide: DialogRef,
          useValue: {
            close: () => {},
          },
        },
        {
          provide: SubscriptionPricingServiceAbstraction,
          useValue: {
            getPersonalSubscriptionPricingTiers$: () => of([mockPremiumTier]),
          },
        },
        {
          provide: ToastService,
          useValue: {
            showToast: (options: ToastOptions) => {},
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            cloudWebVaultUrl$: of("https://vault.bitwarden.com"),
            environment$: of({
              getWebVaultUrl: () => "https://vault.bitwarden.com",
              isCloud: () => true,
            }),
          },
        },
        {
          provide: PlatformUtilsService,
          useValue: {
            launchUri: (uri: string) => {},
            getClientType: (): undefined => undefined,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag: () => Promise.resolve(false),
          },
        },
        {
          provide: BillingApiServiceAbstraction,
          useValue: {
            createPremiumCheckoutSession: () =>
              Promise.resolve({ checkoutSessionUrl: "https://checkout.stripe.com/session" }),
          },
        },
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => {
              switch (key) {
                case "upgradeNow":
                  return "Upgrade now";
                case "month":
                  return "month";
                case "upgradeToPremium":
                  return "Upgrade to Premium";
                default:
                  return key;
              }
            },
          },
        },
        {
          provide: LogService,
          useValue: {
            error: {},
          },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({ id: "test-user-id" }),
          },
        },
        {
          provide: PremiumCheckoutPendingService,
          useValue: {
            markCheckoutLaunched: () => Promise.resolve(),
            consumeCheckoutPending: () => Promise.resolve(false),
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/nuFrzHsgEoEk2Sm8fWOGuS/Premium---business-upgrade-flows?node-id=931-17785&t=xOhvwjYLpjoMPgND-1",
    },
  },
} as Meta<PremiumUpgradeDialogComponent>;

type Story = StoryObj<PremiumUpgradeDialogComponent>;
export const Default: Story = {};

export const NoPricingData: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: SubscriptionPricingServiceAbstraction,
          useValue: {
            getPersonalSubscriptionPricingTiers$: () => of([mockPremiumTierNoPricingData]),
          },
        },
      ],
    }),
  ],
};
