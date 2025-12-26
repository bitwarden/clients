import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconButtonModule, TypographyModule } from "@bitwarden/components";

import { Cart } from "../../types/cart";
import { CartSummaryComponent } from "@bitwarden/pricing";

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
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          name: "members",
          cost: 50.0,
        },
      },
      cadence: "monthly",
      estimatedTax: 9.6,
    } satisfies Cart,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/nuFrzHsgEoEk2Sm8fWOGuS/Premium-Upgrade-flows--pricing-increase-?node-id=877-23653&t=OpDXkupIsvfbh4jT-4",
    },
  },
} as Meta<CartSummaryComponent>;

type Story = StoryObj<CartSummaryComponent>;
export const Default: Story = {
  name: "Default (Password Manager Only)",
};

export const WithAdditionalStorage: Story = {
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          name: "members",
          cost: 50.0,
        },
        additionalStorage: {
          quantity: 2,
          name: "additionalStorageGB",
          cost: 10.0,
        },
      },
      cadence: "monthly",
      estimatedTax: 12.0,
    } satisfies Cart,
  },
};

export const PasswordManagerYearlyCadence: Story = {
  name: "Password Manager (Annual Billing)",
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          name: "members",
          cost: 500.0,
        },
      },
      cadence: "annually",
      estimatedTax: 120.0,
    } satisfies Cart,
  },
};

export const SecretsManagerSeatsOnly: Story = {
  name: "With Secrets Manager Seats",
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          name: "members",
          cost: 50.0,
        },
      },
      secretsManager: {
        seats: {
          quantity: 3,
          name: "members",
          cost: 30.0,
        },
      },
      cadence: "monthly",
      estimatedTax: 16.0,
    } satisfies Cart,
  },
};

export const SecretsManagerSeatsAndServiceAccounts: Story = {
  name: "With Secrets Manager + Service Accounts",
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          name: "members",
          cost: 50.0,
        },
      },
      secretsManager: {
        seats: {
          quantity: 3,
          name: "members",
          cost: 30.0,
        },
        additionalServiceAccounts: {
          quantity: 2,
          name: "additionalServiceAccountsV2",
          cost: 6.0,
        },
      },
      cadence: "monthly",
      estimatedTax: 16.0,
    } satisfies Cart,
  },
};

export const AllProducts: Story = {
  name: "All Products (Complete Cart)",
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          name: "members",
          cost: 50.0,
        },
        additionalStorage: {
          quantity: 2,
          name: "additionalStorageGB",
          cost: 10.0,
        },
      },
      secretsManager: {
        seats: {
          quantity: 3,
          name: "members",
          cost: 30.0,
        },
        additionalServiceAccounts: {
          quantity: 2,
          name: "additionalServiceAccountsV2",
          cost: 6.0,
        },
      },
      cadence: "monthly",
      estimatedTax: 19.2,
    } satisfies Cart,
  },
};

export const FamiliesPlan: Story = {
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 1,
          name: "familiesMembership",
          cost: 40.0,
        },
      },
      cadence: "annually",
      estimatedTax: 4.67,
    } satisfies Cart,
  },
};

export const PremiumPlan: Story = {
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 1,
          name: "premiumMembership",
          cost: 10.0,
        },
      },
      cadence: "annually",
      estimatedTax: 2.71,
    } satisfies Cart,
  },
};

export const CustomHeaderTemplate: Story = {
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          name: "members",
          cost: 50.0,
        },
        additionalStorage: {
          quantity: 2,
          name: "additionalStorageGB",
          cost: 10.0,
        },
      },
      secretsManager: {
        seats: {
          quantity: 3,
          name: "members",
          cost: 30.0,
        },
      },
      cadence: "monthly",
      estimatedTax: 19.2,
    } satisfies Cart,
  },
  render: (args) => ({
    props: args,
    template: `
      <billing-cart-summary [cart]="cart" [header]="customHeader">
        <ng-template #customHeader let-total="total">
          <div class="tw-flex tw-flex-col tw-gap-1">
            <h3 bitTypography="h3" class="!tw-m-0 tw-text-primary">
              Your Total: {{ total | currency: 'USD' : 'symbol' }}
            </h3>
            <p bitTypography="body2" class="!tw-m-0 tw-text-muted">
              Custom header with enhanced styling
            </p>
          </div>
        </ng-template>
      </billing-cart-summary>
    `,
  }),
};

export const WithPercentDiscount: Story = {
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          name: "members",
          cost: 50.0,
        },
        additionalStorage: {
          quantity: 2,
          name: "additionalStorageGB",
          cost: 10.0,
        },
      },
      cadence: "monthly",
      discount: {
        type: "percent-off",
        active: true,
        value: 20,
      },
      estimatedTax: 10.4,
    } satisfies Cart,
  },
};

export const WithAmountDiscount: Story = {
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          name: "members",
          cost: 50.0,
        },
      },
      secretsManager: {
        seats: {
          quantity: 3,
          name: "members",
          cost: 30.0,
        },
      },
      cadence: "annually",
      discount: {
        type: "amount-off",
        active: true,
        value: 50.0,
      },
      estimatedTax: 95.0,
    } satisfies Cart,
  },
};
