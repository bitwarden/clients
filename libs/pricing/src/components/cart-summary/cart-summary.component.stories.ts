import { DatePipe } from "@angular/common";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconButtonModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CartSummaryComponent, DiscountTypes } from "../..";
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
                case "subtotal":
                  return "Subtotal";
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
                case "discount":
                  return "discount";
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
      discounts: [
        {
          type: DiscountTypes.PercentOff,
          value: 20,
        },
      ],
      estimatedTax: 10.4,
    } satisfies Cart,
    showDiscountBadges: true,
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
      discounts: [
        {
          type: DiscountTypes.AmountOff,
          value: 50.0,
        },
      ],
      estimatedTax: 95.0,
    } satisfies Cart,
    showDiscountBadges: true,
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
      discounts: [
        {
          type: DiscountTypes.PercentOff,
          value: 15,
        },
      ],
      credit: {
        translationKey: "premiumSubscriptionCredit",
        value: 50.0,
      },
      estimatedTax: 15.0,
    } satisfies Cart,
    showDiscountBadges: true,
  },
};

export const SinglePerLineDiscount: Story = {
  name: "With Single Per-Line Discount (Premium Renewal)",
  parameters: {
    docs: {
      description: {
        story:
          "A single per-line discount carrying the server's authoritative `amount`. " +
          "The renderer uses that amount verbatim rather than deriving it from `type` and `value`.",
      },
    },
  },
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 1,
          translationKey: "premiumMembership",
          cost: 10.0,
          discounts: [
            {
              type: DiscountTypes.PercentOff,
              value: 25,
              amount: 2.5,
            },
          ],
        },
      },
      cadence: "annually",
      estimatedTax: 2.03,
    } satisfies Cart,
  },
};

export const FlagOffRegression: Story = {
  name: "Flag-Off Regression (Legacy One-Element Shim)",
  parameters: {
    docs: {
      description: {
        story:
          "The shape the legacy `CartItemResponse` shim emits when the feature flag is off: a " +
          "one-element `discounts` array with no `amount` and no `label`. Proves the renderer " +
          "still derives both via `getAmount` / `getLabel`, so flag-off carts render unchanged.",
      },
    },
  },
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          translationKey: "members",
          cost: 50.0,
          discounts: [
            {
              type: DiscountTypes.PercentOff,
              value: 25,
            },
          ],
        },
      },
      cadence: "monthly",
      estimatedTax: 9.6,
    } satisfies Cart,
  },
};

export const MultiplePerLineDiscounts: Story = {
  name: "With Multiple Per-Line Discounts",
  parameters: {
    docs: {
      description: {
        story:
          "Two discounts on a single line: a percent-off coupon with no `amount` (derived) and a " +
          "labeled amount-off promotion with an authoritative `amount`. Both rows render beneath " +
          "the line. Per-line discounts do not cascade — each is measured against the same " +
          "extended price, unlike the cart-wide loop.",
      },
    },
  },
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          translationKey: "members",
          cost: 50.0,
          discounts: [
            {
              type: DiscountTypes.PercentOff,
              value: 20,
            },
            {
              type: DiscountTypes.AmountOff,
              value: 15,
              amount: 15,
              label: "Loyalty promotion",
            },
          ],
        },
      },
      cadence: "monthly",
      estimatedTax: 8.55,
    } satisfies Cart,
  },
};

export const PerLineAndCartWideStacked: Story = {
  name: "With Per-Line and Cart-Wide Discounts Stacked",
  parameters: {
    docs: {
      description: {
        story:
          "Represents the **membership card (post-purchase)** view. " +
          "The item-level discount renders inline under its line item. " +
          "The cart-level discount badge is intentionally hidden (`showDiscountBadges` defaults to `false`) " +
          "because post-purchase the user's concern is billing amount and date, not promotional persuasion.",
      },
    },
  },
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          translationKey: "members",
          cost: 50.0,
          discounts: [
            {
              type: DiscountTypes.PercentOff,
              value: 25,
            },
          ],
        },
        additionalStorage: {
          quantity: 2,
          translationKey: "additionalStorageGB",
          cost: 10.0,
        },
      },
      cadence: "monthly",
      discounts: [
        {
          type: DiscountTypes.PercentOff,
          value: 10,
        },
      ],
      estimatedTax: 8.55,
    } satisfies Cart,
  },
};

export const CartLevelDiscountSummaryBlock: Story = {
  name: "With Cart-Level Discount Summary Block (Design Mockup)",
  parameters: {
    docs: {
      description: {
        story:
          "The approved design-review layout for carts mixing item-level and cart-level " +
          "discounts: item-level discounts render indented beneath their line, while the " +
          "cart-level discount renders in a grouped summary block — divider, Subtotal, " +
          "discount, Estimated tax, divider, Total. The Subtotal row appears only when a " +
          "cart-level discount is present. Labels here are server-supplied (`label` " +
          "pass-through) with authoritative `amount`s.",
      },
    },
  },
  args: {
    cart: {
      passwordManager: {
        seats: {
          quantity: 5,
          translationKey: "members",
          cost: 50.0,
          discounts: [
            {
              type: DiscountTypes.PercentOff,
              value: 25,
              amount: 62.5,
              label: "Team plan discount (25% off members)",
            },
          ],
        },
        additionalStorage: {
          quantity: 2,
          translationKey: "additionalStorageGB",
          cost: 10.0,
        },
      },
      cadence: "monthly",
      discounts: [
        {
          type: DiscountTypes.PercentOff,
          value: 10,
          amount: 27.0,
          label: "Promo: SAVE10 (10% off subtotal)",
        },
      ],
      estimatedTax: 8.55,
    } satisfies Cart,
  },
};

export const WithMultipleDiscounts: Story = {
  name: "With Multiple Stacked Discounts",
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
      discounts: [
        {
          type: DiscountTypes.PercentOff,
          value: 20,
        },
        {
          type: DiscountTypes.PercentOff,
          value: 10,
        },
      ],
      estimatedTax: 8.64,
    } satisfies Cart,
    showDiscountBadges: true,
  },
};

export const HiddenPricingTerm: Story = {
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
