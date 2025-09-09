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
          useValue: { t: (key: string) => key },
        },
      ],
    }),
  ],
  args: {
    passwordManager: {
      quantity: 5,
      name: "Members",
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
      name: "Additional storage GB",
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
      name: "Members",
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
        name: "Members",
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
        name: "Members",
        cost: 30.0,
        cadence: "month",
      },
      additionalServiceAccounts: {
        quantity: 2,
        name: "Additional machine accounts",
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
      name: "Additional storage GB",
      cost: 10.0,
      cadence: "month",
    },
    secretsManager: {
      seats: {
        quantity: 3,
        name: "Members",
        cost: 30.0,
        cadence: "month",
      },
      additionalServiceAccounts: {
        quantity: 2,
        name: "Additional machine accounts",
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
      name: "Families membership",
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
      name: "Premium membership",
      cost: 10.0,
      cadence: "year",
    },
    estimatedTax: 2.71,
  },
};
