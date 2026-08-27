import { CommonModule, DatePipe } from "@angular/common";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeModule,
  ButtonModule,
  CalloutModule,
  CardComponent,
  TypographyModule,
} from "@bitwarden/components";
import { CartSummaryComponent, DiscountTypes } from "@bitwarden/pricing";
import { I18nPipe } from "@bitwarden/ui-common";

import { BitwardenSubscription } from "../../types/bitwarden-subscription";
import { SubscriptionPreview } from "../../types/subscription-preview";

import { SubscriptionCardComponent } from "./subscription-card.component";

export default {
  title: "Billing/Subscription Card",
  component: SubscriptionCardComponent,
  description:
    "Displays subscription status, payment details, and action prompts based on subscription state.",
  decorators: [
    moduleMetadata({
      imports: [
        CommonModule,
        BadgeModule,
        ButtonModule,
        CalloutModule,
        CardComponent,
        CartSummaryComponent,
        TypographyModule,
        I18nPipe,
      ],
      providers: [
        DatePipe,
        {
          provide: I18nService,
          useValue: {
            t: (key: string, ...args: any[]) => {
              const translations: Record<string, string> = {
                pendingCancellation: "Pending cancellation",
                updatePayment: "Update payment",
                expired: "Expired",
                trial: "Trial",
                active: "Active",
                pastDue: "Past due",
                canceled: "Canceled",
                unpaid: "Unpaid",
                weCouldNotProcessYourPayment:
                  "We could not process your payment. Please update your payment method or contact the support team for assistance.",
                contactSupportShort: "Contact Support",
                yourSubscriptionIsExpired:
                  "Your subscription is expired. Please resubscribe to continue using premium features.",
                yourSubscriptionIsCanceled:
                  "Your subscription is canceled. Please resubscribe to continue using premium features.",
                yourSubscriptionIsScheduledToCancel: `Your subscription is scheduled to cancel on ${args[0]}. You can reinstate it anytime before then.`,
                reinstateSubscription: "Reinstate subscription",
                resubscribe: "Resubscribe",
                upgradeYourPlan: "Upgrade your plan",
                premiumShareEvenMore:
                  "Share even more with Families, or get powerful, trusted password security with Teams or Enterprise.",
                upgradeNow: "Upgrade now",
                youHaveAGracePeriod: `You have a grace period of ${args[0]} days from your subscription expiration date. Please resolve the past due invoices by ${args[1]}.`,
                manageInvoices: "Manage invoices",
                toReactivateYourSubscription:
                  "To reactivate your subscription, please resolve the past due invoices.",
                yourSubscriptionWillBeSuspendedOn: "Your subscription will be suspended on",
                yourSubscriptionWasSuspendedOn: "Your subscription was suspended on",
                yourSubscriptionWillBeCanceledOn: "Your subscription will be canceled on",
                yourNextChargeIsFor: "Your next charge is for",
                dueOn: "due on",
                yourSubscriptionWasCanceledOn: "Your subscription was canceled on",
                members: "Members",
                additionalStorageGB: "Additional storage GB",
                month: "month",
                year: "year",
                estimatedTax: "Estimated tax",
                total: "Total",
                expandPurchaseDetails: "Expand purchase details",
                collapsePurchaseDetails: "Collapse purchase details",
                passwordManager: "Password Manager",
                secretsManager: "Secrets Manager",
                additionalStorageGb: "Additional storage (GB)",
                additionalServiceAccountsV2: "Additional machine accounts",
                callout: "Callout",
              };
              return translations[key] || key;
            },
          },
        },
      ],
    }),
  ],
} as Meta<SubscriptionCardComponent>;

type Story = StoryObj<SubscriptionCardComponent>;

export const Active: Story = {
  args: {
    title: "Premium Subscription",
    subscription: {
      status: "active",
      nextCharge: new Date("2025-02-15"),
      cart: {
        passwordManager: {
          seats: {
            quantity: 1,
            translationKey: "members",
            cost: 10.0,
          },
        },
        cadence: "annually",
        estimatedTax: 2.71,
      },
      storage: {
        available: 1000,
        used: 234,
        readableUsed: "234 MB",
      },
    } satisfies BitwardenSubscription,
  },
};

export const ActiveWithUpgrade: Story = {
  name: "Active - With Upgrade Option",
  args: {
    title: "Premium Subscription",
    showUpgradeButton: true,
    subscription: {
      status: "active",
      nextCharge: new Date("2025-02-15"),
      cart: {
        passwordManager: {
          seats: {
            quantity: 1,
            translationKey: "members",
            cost: 10.0,
          },
        },
        cadence: "annually",
        estimatedTax: 2.71,
      },
      storage: {
        available: 1000,
        used: 234,
        readableUsed: "234 MB",
      },
    } satisfies BitwardenSubscription,
  },
};

export const Trial: Story = {
  args: {
    title: "Premium Subscription",
    subscription: {
      status: "trialing",
      nextCharge: new Date("2025-02-01"),
      cart: {
        passwordManager: {
          seats: {
            quantity: 1,
            translationKey: "members",
            cost: 10.0,
          },
        },
        cadence: "annually",
        estimatedTax: 2.71,
      },
      storage: {
        available: 1000,
        used: 50,
        readableUsed: "50 MB",
      },
    } satisfies BitwardenSubscription,
  },
};

export const TrialWithUpgrade: Story = {
  name: "Trial - With Upgrade Option",
  args: {
    title: "Premium Subscription",
    showUpgradeButton: true,
    subscription: {
      status: "trialing",
      nextCharge: new Date("2025-02-01"),
      cart: {
        passwordManager: {
          seats: {
            quantity: 1,
            translationKey: "members",
            cost: 10.0,
          },
        },
        cadence: "annually",
        estimatedTax: 2.71,
      },
      storage: {
        available: 1000,
        used: 50,
        readableUsed: "50 MB",
      },
    } satisfies BitwardenSubscription,
  },
};

export const Incomplete: Story = {
  args: {
    title: "Premium Subscription",
    subscription: {
      status: "incomplete",
      suspension: new Date("2025-02-15"),
      gracePeriod: 7,
      cart: {
        passwordManager: {
          seats: {
            quantity: 1,
            translationKey: "members",
            cost: 10.0,
          },
        },
        cadence: "annually",
        estimatedTax: 2.71,
      },
      storage: {
        available: 1000,
        used: 234,
        readableUsed: "234 MB",
      },
    } satisfies BitwardenSubscription,
  },
};

export const IncompleteExpired: Story = {
  args: {
    title: "Premium Subscription",
    subscription: {
      status: "incomplete_expired",
      suspension: new Date("2025-01-01"),
      gracePeriod: 0,
      cart: {
        passwordManager: {
          seats: {
            quantity: 1,
            translationKey: "members",
            cost: 10.0,
          },
        },
        cadence: "annually",
        estimatedTax: 2.71,
      },
      storage: {
        available: 1000,
        used: 234,
        readableUsed: "234 MB",
      },
    } satisfies BitwardenSubscription,
  },
};

export const PastDue: Story = {
  args: {
    title: "Premium Subscription",
    subscription: {
      status: "past_due",
      suspension: new Date("2025-02-05"),
      gracePeriod: 14,
      cart: {
        passwordManager: {
          seats: {
            quantity: 1,
            translationKey: "members",
            cost: 10.0,
          },
        },
        cadence: "annually",
        estimatedTax: 2.71,
      },
      storage: {
        available: 1000,
        used: 234,
        readableUsed: "234 MB",
      },
    } satisfies BitwardenSubscription,
  },
};

export const CalloutSuppressed: Story = {
  name: "Callout Suppressed (hideCallout)",
  args: {
    title: "Enterprise Subscription",
    // hideCallout suppresses the status callout entirely (e.g. reseller orgs exempt from billing
    // automation) — the badge still renders, but the past-due callout does not.
    hideCallout: true,
    subscription: {
      status: "past_due",
      suspension: new Date("2025-02-05"),
      gracePeriod: 14,
      cart: {
        passwordManager: {
          seats: {
            quantity: 20,
            translationKey: "members",
            cost: 6.0,
          },
        },
        cadence: "annually",
        estimatedTax: 0,
      },
      storage: {
        available: 1000,
        used: 234,
        readableUsed: "234 MB",
      },
    } satisfies BitwardenSubscription,
  },
};

export const PendingCancellation: Story = {
  args: {
    title: "Premium Subscription",
    subscription: {
      status: "active",
      nextCharge: new Date("2025-02-15"),
      cancelAt: new Date("2025-03-01"),
      cart: {
        passwordManager: {
          seats: {
            quantity: 1,
            translationKey: "members",
            cost: 10.0,
          },
        },
        cadence: "annually",
        estimatedTax: 2.71,
      },
      storage: {
        available: 1000,
        used: 234,
        readableUsed: "234 MB",
      },
    } satisfies BitwardenSubscription,
  },
};

export const Unpaid: Story = {
  args: {
    title: "Premium Subscription",
    subscription: {
      status: "unpaid",
      suspension: new Date("2025-01-20"),
      gracePeriod: 0,
      cart: {
        passwordManager: {
          seats: {
            quantity: 1,
            translationKey: "members",
            cost: 10.0,
          },
        },
        cadence: "annually",
        estimatedTax: 2.71,
      },
      storage: {
        available: 1000,
        used: 234,
        readableUsed: "234 MB",
      },
    } satisfies BitwardenSubscription,
  },
};

export const Canceled: Story = {
  args: {
    title: "Premium Subscription",
    subscription: {
      status: "canceled",
      canceled: new Date("2025-01-15"),
      cart: {
        passwordManager: {
          seats: {
            quantity: 1,
            translationKey: "members",
            cost: 10.0,
          },
        },
        cadence: "annually",
        estimatedTax: 2.71,
      },
      storage: {
        available: 1000,
        used: 234,
        readableUsed: "234 MB",
      },
    } satisfies BitwardenSubscription,
  },
};

export const Enterprise: Story = {
  args: {
    title: "Enterprise Subscription",
    subscription: {
      status: "active",
      nextCharge: new Date("2025-03-01"),
      cart: {
        passwordManager: {
          seats: {
            quantity: 5,
            translationKey: "members",
            cost: 7,
          },
          additionalStorage: {
            quantity: 2,
            translationKey: "additionalStorageGB",
            cost: 0.5,
          },
        },
        secretsManager: {
          seats: {
            quantity: 3,
            translationKey: "members",
            cost: 13,
          },
          additionalServiceAccounts: {
            quantity: 5,
            translationKey: "additionalServiceAccountsV2",
            cost: 1,
          },
        },
        discounts: [
          {
            type: DiscountTypes.PercentOff,
            value: 25,
          },
        ],
        cadence: "monthly",
        estimatedTax: 6.4,
      },
      storage: {
        available: 7,
        readableUsed: "7 GB",
        used: 0,
      },
    },
  },
};

export const ActiveFromPreview: Story = {
  name: "Preview-Driven - Active",
  args: {
    title: "Teams Subscription",
    subscription: {
      status: "active",
      nextCharge: new Date("2025-02-15"),
      cart: {
        passwordManager: {
          seats: {
            quantity: 5,
            translationKey: "members",
            cost: 4,
          },
        },
        cadence: "annually",
        estimatedTax: 1.5,
      },
      storage: {
        available: 1000,
        used: 234,
        readableUsed: "234 MB",
      },
    } satisfies SubscriptionPreview,
  },
};

export const PreviewWithoutStorage: Story = {
  name: "Preview-Driven - No Storage",
  args: {
    title: "Teams Subscription",
    // `storage` is optional on SubscriptionPreview (the server omits it when there is no maximum
    // storage allowance) — verifies the card renders without a storage section.
    subscription: {
      status: "active",
      nextCharge: new Date("2025-02-15"),
      cart: {
        passwordManager: {
          seats: {
            quantity: 5,
            translationKey: "members",
            cost: 4,
          },
        },
        cadence: "annually",
        estimatedTax: 1.5,
      },
    } satisfies SubscriptionPreview,
  },
};

export const WithProjectedContent: Story = {
  name: "Preview-Driven - With Projected Warning",
  args: {
    title: "Teams Subscription",
    subscription: {
      status: "active",
      nextCharge: new Date("2025-02-15"),
      cart: {
        passwordManager: {
          seats: {
            quantity: 5,
            translationKey: "members",
            cost: 4,
          },
        },
        cadence: "annually",
        estimatedTax: 1.5,
      },
      storage: {
        available: 1000,
        used: 234,
        readableUsed: "234 MB",
      },
    } satisfies SubscriptionPreview,
  },
  // Verifies the <ng-content> slot: pages project content (e.g. the scheduled price-increase
  // warning) into the bottom of the card.
  render: (args) => ({
    props: args,
    template: `
      <billing-subscription-card [title]="title" [subscription]="subscription">
        <bit-callout type="warning" title="Pricing details may be outdated">
          We're having trouble reaching our billing service, so your subscription details may be
          outdated. You're seeing the last known details.
        </bit-callout>
      </billing-subscription-card>
    `,
  }),
};
