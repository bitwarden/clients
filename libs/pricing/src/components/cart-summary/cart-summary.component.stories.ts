import { Meta, StoryObj } from "@storybook/angular";

import { CartSummaryComponent } from "./cart-summary.component";

export default {
  title: "Billing/Cart Summary",
  component: CartSummaryComponent,
  args: {
    passwordManager: {
      quantity: 5,
      name: "Password Manager",
      cost: 50.0,
      cadence: "month",
    },
    estimatedTax: 9.6,
  },
} as Meta<CartSummaryComponent>;

type Story = StoryObj<CartSummaryComponent>;
export const Default: Story = {};

export const WithAdditionalStorage: Story = {
  args: {
    passwordManager: {
      quantity: 5,
      name: "Password Manager",
      cost: 50.0,
      cadence: "month",
    },
    additionalStorage: {
      quantity: 2,
      name: "Additional Storage (1GB)",
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
      name: "Password Manager Annual",
      cost: 500.0,
      cadence: "year",
    },
    estimatedTax: 120.0,
  },
};

export const SecretsManagerSeatsOnly: Story = {
  args: {
    passwordManager: {
      quantity: 5,
      name: "Password Manager",
      cost: 50.0,
      cadence: "month",
    },
    secretsManager: {
      seats: {
        quantity: 3,
        name: "Secrets Manager Seats",
        cost: 30.0,
        cadence: "month",
      },
    },
    estimatedTax: 16.0,
  },
};

export const SecretsManagerSeatsAndServiceAccounts: Story = {
  args: {
    passwordManager: {
      quantity: 5,
      name: "Password Manager",
      cost: 50.0,
      cadence: "month",
    },
    secretsManager: {
      seats: {
        quantity: 3,
        name: "Secrets Manager Seats",
        cost: 30.0,
        cadence: "month",
      },
      additionalServiceAccounts: {
        quantity: 2,
        name: "Additional Service Accounts",
        cost: 6.0,
        cadence: "month",
      },
    },
    estimatedTax: 16.0,
  },
};

export const AllProducts: Story = {
  args: {
    passwordManager: {
      quantity: 5,
      name: "Password Manager",
      cost: 50.0,
      cadence: "month",
    },
    additionalStorage: {
      quantity: 2,
      name: "Additional Storage (1GB)",
      cost: 10.0,
      cadence: "month",
    },
    secretsManager: {
      seats: {
        quantity: 3,
        name: "Secrets Manager Seats",
        cost: 30.0,
        cadence: "month",
      },
      additionalServiceAccounts: {
        quantity: 2,
        name: "Additional Service Accounts",
        cost: 6.0,
        cadence: "month",
      },
    },
    estimatedTax: 19.2,
  },
};
