import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import {
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadenceIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
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
          },
        },
        {
          provide: PlatformUtilsService,
          useValue: {
            launchUri: (uri: string) => {},
          },
        },
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => {
              switch (key) {
                case "upgradeNow":
                  return "Upgrade Now";
                case "month":
                  return "month";
                case "upgradeToPremium":
                  return "Upgrade To Premium";
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
