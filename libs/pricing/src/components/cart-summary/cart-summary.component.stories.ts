import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconButtonModule, TypographyModule } from "@bitwarden/components";

import { CartSummaryComponent } from "./cart-summary.component";

export default {
  title: "Billing/Cart Summary",
  component: CartSummaryComponent,
  description: "A summary of the items in the cart, including pricing details.",
  decorators: [
    moduleMetadata({
      imports: [TypographyModule, IconButtonModule],
      // Return the same value for all keys for simplicity
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => {
              switch (key) {
                case "month":
                  return "month";
                case "year":
                  return "year";
                case "members":
                  return "Members";
                case "additionalStorageGB":
                  return "Additional storage GB";
                case "additionalServiceAccountsV2":
                  return "Additional machine accounts";
                case "secretsManagerSeats":
                  return "Secrets Manager seats";
                case "passwordManager":
                  return "Password Manager";
                case "secretsManager":
                  return "Secrets Manager";
                case "additionalStorage":
                  return "Additional Storage";
                case "estimatedTax":
                  return "Estimated tax";
                case "total":
                  return "Total";
                case "expandPurchaseDetails":
                  return "Expand purchase details";
                case "collapsePurchaseDetails":
                  return "Collapse purchase details";
                case "familiesMembership":
                  return "Families membership";
                case "premiumMembership":
                  return "Premium membership";
                default:
                  return key;
              }
            },
          },
        },
      ],
    }),
  ],
  args: {
    passwordManager: {
      quantity: 5,
      name: "members",
      cost: 50.0,
      cadence: "month",
    },
    estimatedTax: 9.6,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/nuFrzHsgEoEk2Sm8fWOGuS/Premium-Upgrade-flows--pricing-increase-?node-id=877-23653&t=OpDXkupIsvfbh4jT-4",
    },
  },
} as Meta<CartSummaryComponent>;

type Story = StoryObj<CartSummaryComponent>;
export const Default: Story = {};

export const WithAdditionalStorage: Story = {
  args: {
    ...Default.args,
    additionalStorage: {
      quantity: 2,
      name: "additionalStorageGB",
      cost: 10.0,
      cadence: "month",
    },
    estimatedTax: 12.0,
  },
};

export const PasswordManagerYearlyCadence: Story = {
  args: {
    passwordManager: {
      quantity: 5,
      name: "members",
      cost: 500.0,
      cadence: "year",
    },
    estimatedTax: 120.0,
  },
};

export const SecretsManagerSeatsOnly: Story = {
  args: {
    ...Default.args,
    secretsManager: {
      seats: {
        quantity: 3,
        name: "members",
        cost: 30.0,
        cadence: "month",
      },
    },
    estimatedTax: 16.0,
  },
};

export const SecretsManagerSeatsAndServiceAccounts: Story = {
  args: {
    ...Default.args,
    secretsManager: {
      seats: {
        quantity: 3,
        name: "members",
        cost: 30.0,
        cadence: "month",
      },
      additionalServiceAccounts: {
        quantity: 2,
        name: "additionalServiceAccountsV2",
        cost: 6.0,
        cadence: "month",
      },
    },
    estimatedTax: 16.0,
  },
};

export const AllProducts: Story = {
  args: {
    ...Default.args,
    additionalStorage: {
      quantity: 2,
      name: "additionalStorageGB",
      cost: 10.0,
      cadence: "month",
    },
    secretsManager: {
      seats: {
        quantity: 3,
        name: "members",
        cost: 30.0,
        cadence: "month",
      },
      additionalServiceAccounts: {
        quantity: 2,
        name: "additionalServiceAccountsV2",
        cost: 6.0,
        cadence: "month",
      },
    },
    estimatedTax: 19.2,
  },
};

export const FamiliesPlan: Story = {
  args: {
    passwordManager: {
      quantity: 1,
      name: "familiesMembership",
      cost: 40.0,
      cadence: "year",
    },
    estimatedTax: 4.67,
  },
};

export const PremiumPlan: Story = {
  args: {
    passwordManager: {
      quantity: 1,
      name: "premiumMembership",
      cost: 10.0,
      cadence: "year",
    },
    estimatedTax: 2.71,
  },
};
