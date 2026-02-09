import { DatePipe } from "@angular/common";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconButtonModule, TypographyModule } from "@bitwarden/components";
import { CartSummaryComponent, DiscountTypes } from "@bitwarden/pricing";
import { I18nPipe } from "@bitwarden/ui-common";

import { Cart } from "../../types/cart";

export default {
  title: "Billing/Cart Summary",
  component: CartSummaryComponent,
  description: "A summary of the items in the cart, including pricing details.",
  decorators: [
    moduleMetadata({
      imports: [TypographyModule, IconButtonModule, I18nPipe],
      // Return the same value for all keys for simplicity
      providers: [
        DatePipe,
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
                case "yourNextChargeIsFor":
                  return "Your next charge is for";
                case "dueOn":
                  return "due on";
                case "premiumSubscriptionCredit":
                  return "Premium subscription credit";
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
          translationKey: "members",
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
          translationKey: "members",
          cost: 50.0,
        },
        additionalStorage: {
          quantity: 2,
          translationKey: "additionalStorageGB",
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
          translationKey: "members",
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
          translationKey: "members",
          cost: 50.0,
        },
      },
      secretsManager: {
        seats: {
          quantity: 3,
          translationKey: "members",
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
          translationKey: "members",
          cost: 50.0,
        },
      },
      secretsManager: {
        seats: {
          quantity: 3,
          translationKey: "members",
          cost: 30.0,
        },
        additionalServiceAccounts: {
          quantity: 2,
          translationKey: "additionalServiceAccountsV2",
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
          translationKey: "members",
          cost: 50.0,
        },
        additionalStorage: {
          quantity: 2,
          translationKey: "additionalStorageGB",
          cost: 10.0,
        },
      },
      secretsManager: {
        seats: {
          quantity: 3,
          translationKey: "members",
          cost: 30.0,
        },
        additionalServiceAccounts: {
          quantity: 2,
          translationKey: "additionalServiceAccountsV2",
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
          translationKey: "familiesMembership",
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
          translationKey: "premiumMembership",
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
          quantity: 1,
          translationKey: "premiumMembership",
          cost: 10.0,
        },
      },
      cadence: "annually",
      estimatedTax: 2.71,
    } satisfies Cart,
  },
  render: (args) => ({
    props: {
      ...args,
      nextChargeDate: new Date("2025-06-04"),
    },
    template: `
      <div>
        <ng-template #customHeader let-total="total">
          <h2
            bitTypography="h4"
            class="!tw-m-0"
            id="cart-summary-header-custom"
            data-test-id="cart-summary-header-custom"
          >
            {{ "yourNextChargeIsFor" | i18n }}
            <span class="tw-font-bold">{{ total | currency: "USD" : "symbol" }} USD</span>
            {{ "dueOn" | i18n }}
            <span class="tw-font-bold">{{ nextChargeDate | date: "MMM. d, y" }}</span>
          </h2>
        </ng-template>

        <billing-cart-summary [cart]="cart" [header]="customHeader" />
      </div>
    `,
  }),
};

export const WithPercentDiscount: Story = {
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          translationKey: "members",
          cost: 50.0,
        },
        additionalStorage: {
          quantity: 2,
          translationKey: "additionalStorageGB",
          cost: 10.0,
        },
      },
      cadence: "monthly",
      discount: {
        type: DiscountTypes.PercentOff,
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
          translationKey: "members",
          cost: 50.0,
        },
      },
      secretsManager: {
        seats: {
          quantity: 3,
          translationKey: "members",
          cost: 30.0,
        },
      },
      cadence: "annually",
      discount: {
        type: DiscountTypes.AmountOff,
        value: 50.0,
      },
      estimatedTax: 95.0,
    } satisfies Cart,
  },
};

export const WithHiddenBreakdown: Story = {
  name: "Hidden Cost Breakdown",
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          translationKey: "members",
          cost: 50.0,
          hideBreakdown: true,
        },
        additionalStorage: {
          quantity: 2,
          translationKey: "additionalStorageGB",
          cost: 10.0,
          hideBreakdown: true,
        },
      },
      secretsManager: {
        seats: {
          quantity: 3,
          translationKey: "members",
          cost: 30.0,
          hideBreakdown: true,
        },
        additionalServiceAccounts: {
          quantity: 2,
          translationKey: "additionalServiceAccountsV2",
          cost: 6.0,
          hideBreakdown: true,
        },
      },
      cadence: "monthly",
      estimatedTax: 19.2,
    } satisfies Cart,
  },
};

export const WithCredit: Story = {
  name: "With Account Credit",
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          translationKey: "members",
          cost: 50.0,
        },
      },
      cadence: "monthly",
      credit: {
        translationKey: "premiumSubscriptionCredit",
        value: 25.0,
      },
      estimatedTax: 10.0,
    } satisfies Cart,
  },
};

export const WithDiscountAndCredit: Story = {
  name: "With Both Discount and Credit",
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          translationKey: "members",
          cost: 50.0,
        },
        additionalStorage: {
          quantity: 2,
          translationKey: "additionalStorageGB",
          cost: 10.0,
        },
      },
      cadence: "annually",
      discount: {
        type: DiscountTypes.PercentOff,
        value: 15,
      },
      credit: {
        translationKey: "premiumSubscriptionCredit",
        value: 50.0,
      },
      estimatedTax: 15.0,
    } satisfies Cart,
  },
};

export const HiddenPricingTerm: Story = {
  name: "Hidden Pricing Term",
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          translationKey: "members",
          cost: 50.0,
        },
      },
      cadence: "monthly",
      estimatedTax: 9.6,
    } satisfies Cart,
    hidePricingTerm: true,
  },
};
