import { CommonModule, DatePipe } from "@angular/common";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeModule,
  ButtonModule,
  CalloutModule,
  CardComponent,
  TypographyModule,
} from "@bitwarden/components";
import { CartSummaryComponent } from "@bitwarden/pricing";
import { SubscriptionCardComponent } from "@bitwarden/subscription";
import { I18nPipe } from "@bitwarden/ui-common";

// Mock ConfigService for feature flag
class MockConfigService {
  private featureFlags = new Map<string, BehaviorSubject<boolean>>([
    [FeatureFlag.PM29593_PremiumToOrganizationUpgrade, new BehaviorSubject<boolean>(false)],
  ]);

  getFeatureFlag$(flag: FeatureFlag) {
    return this.featureFlags.get(flag)?.asObservable() || new BehaviorSubject(false).asObservable();
  }
}

const mockConfigService = new MockConfigService();

export default {
  title: "Billing/Subscription Card",
  component: SubscriptionCardComponent,
  description:
    "A reusable UI-only component that displays a subscription card with status, billing info, and an optional upgrade callout.",
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
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        DatePipe,
        {
          provide: I18nService,
          useValue: {
            t: (key: string, ...args: any[]) => {
              const translations: Record<string, string> = {
                // Status badges
                incomplete: "Incomplete",
                expired: "Expired",
                trial: "Trial",
                active: "Active",
                pastDue: "Past due",
                canceled: "Canceled",
                unpaid: "Unpaid",
                pendingCancellation: "Pending cancellation",

                // Callout titles
                contactSupportShort: "Contact Support",
                upgradeYourPlan: "Upgrade your plan",
                updatePayment: "Update payment",

                // Callout descriptions
                premiumShareEvenMore:
                  "Share even more with Families, or get powerful, trusted password security with Teams or Enterprise.",
                pastDueWarningForChargeAutomatically: `You have a grace period of ${args[0]} days from your subscription expiration date to maintain your subscription. Please resolve the past due invoices by ${args[1]}.`,
                toReactivateYourSubscription:
                  "To reactivate your subscription, please resolve the past due invoices.",
                weCouldNotProcessYourPayment:
                  "We could not process your payment. Please update your payment method or contact customer support for assistance.",
                subscriptionExpiredNotice:
                  "Your subscription has expired. Please contact support for assistance.",
                yourSubscriptionIsScheduledToCancel: `Your subscription is scheduled to cancel on ${args[0]}. You can reinstate it anytime before then.`,
                youHaveAGracePeriod: `You have a grace period of ${args[0]} days from your expiration date. Please resolve the past due invoices by ${args[1]}.`,

                // Callout actions
                upgradeNow: "Upgrade now",
                reinstateSubscription: "Reinstate subscription",

                // Cart summary header
                yourSubscriptionWillBeSuspendedOn: "Your subscription will be suspended on",
                yourSubscriptionWasSuspendedOn: "Your subscription was suspended on",
                yourNextChargeIsFor: "Your next charge is for",
                dueOn: "due on",
                yourSubscriptionWasCanceledOn: "Your subscription was canceled on",
                yourSubscriptionWillBeCanceledOn: "Your subscription will be canceled on",

                // Cart summary items
                month: "month",
                year: "year",
                members: "Members",
                additionalStorageGB: "Additional storage GB",
                additionalServiceAccountsV2: "Additional machine accounts",
                secretsManagerSeats: "Secrets Manager seats",
                passwordManager: "Password Manager",
                secretsManager: "Secrets Manager",
                additionalStorage: "Additional Storage",
                estimatedTax: "Estimated tax",
                total: "Total",
                expandPurchaseDetails: "Expand purchase details",
                collapsePurchaseDetails: "Collapse purchase details",
                premiumMembership: "Premium membership",
                familiesMembership: "Families membership",
                discount: "discount",
              };

              return translations[key] || key;
            },
          },
        },
      ],
    }),
  ],
  args: {
    title: "Premium membership",
  },
} as Meta<SubscriptionCardComponent>;

type Story = StoryObj<SubscriptionCardComponent>;

const baseCart = {
  passwordManager: {
    quantity: 1,
    name: "premiumMembership" as const,
    cost: 10.0,
    cadence: "year" as const,
  },
  estimatedTax: 2.71,
};

export const PremiumActive: Story = {
  name: "Premium: Active",
  args: {
    title: "Premium membership",
    subscription: {
      subscriber: {
        type: "account",
        data: {
          id: "user-123" as any,
          email: "user@example.com",
        },
      },
      cart: baseCart,
      status: "active",
      nextCharge: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  },
};

export const PremiumActiveWithUpgrade: Story = {
  name: "Premium: Active (With Upgrade)",
  args: {
    ...PremiumActive.args,
  },
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: () => new BehaviorSubject(true).asObservable(),
          },
        },
      ],
    }),
  ],
};

export const PremiumActivePendingCancellation: Story = {
  name: "Premium: Active (Pending Cancellation)",
  args: {
    subscription: {
      subscriber: {
        type: "account",
        data: {
          id: "user-123" as any,
          email: "user@example.com",
        },
      },
      cart: baseCart,
      status: "active",
      nextCharge: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      cancelAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Subscription will be canceled at end of billing period
    },
  },
};

export const PremiumTrialing: Story = {
  name: "Premium: Trialing",
  args: {
    subscription: {
      subscriber: {
        type: "account",
        data: {
          id: "user-123" as any,
          email: "user@example.com",
        },
      },
      cart: baseCart,
      status: "trialing",
      nextCharge: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  },
};

export const PremiumTrialingWithUpgrade: Story = {
  name: "Premium: Trialing With Upgrade Callout",
  args: {
    ...PremiumTrialing.args,
  },
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: () => new BehaviorSubject(true).asObservable(),
          },
        },
      ],
    }),
  ],
};

export const PremiumTrialingPendingCancellation: Story = {
  name: "Premium: Trialing (Pending Cancellation)",
  args: {
    subscription: {
      subscriber: {
        type: "account",
        data: {
          id: "user-123" as any,
          email: "user@example.com",
        },
      },
      cart: baseCart,
      status: "trialing",
      nextCharge: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      cancelAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Subscription will be canceled at end of trial
    },
  },
};

export const PremiumIncomplete: Story = {
  name: "Premium: Incomplete",
  args: {
    subscription: {
      subscriber: {
        type: "account",
        data: {
          id: "user-123" as any,
          email: "user@example.com",
        },
      },
      cart: baseCart,
      status: "incomplete",
      created: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    },
  },
};

export const PremiumIncompleteExpired: Story = {
  name: "Premium: Incomplete Expired",
  args: {
    subscription: {
      subscriber: {
        type: "account",
        data: {
          id: "user-123" as any,
          email: "user@example.com",
        },
      },
      cart: baseCart,
      status: "incomplete_expired",
      created: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    },
  },
};

export const PremiumPastDue: Story = {
  name: "Premium: Past Due",
  args: {
    subscription: {
      subscriber: {
        type: "account",
        data: {
          id: "user-123" as any,
          email: "user@example.com",
        },
      },
      cart: baseCart,
      status: "past_due",
      expired: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      suspension: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      gracePeriod: 7,
    },
  },
};

export const PremiumCanceled: Story = {
  name: "Premium: Canceled",
  args: {
    subscription: {
      subscriber: {
        type: "account",
        data: {
          id: "user-123" as any,
          email: "user@example.com",
        },
      },
      cart: baseCart,
      status: "canceled",
      canceled: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    },
  },
};

export const PremiumUnpaid: Story = {
  name: "Premium: Unpaid",
  args: {
    subscription: {
      subscriber: {
        type: "account",
        data: {
          id: "user-123" as any,
          email: "user@example.com",
        },
      },
      cart: baseCart,
      status: "unpaid",
      suspension: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    },
  },
};

export const PremiumAdditionalStorage: Story = {
  name: "Premium: Additional Storage",
  args: {
    subscription: {
      subscriber: {
        type: "account",
        data: {
          id: "user-123" as any,
          email: "user@example.com",
        },
      },
      cart: {
        passwordManager: {
          quantity: 1,
          name: "premiumMembership" as const,
          cost: 10.0,
          cadence: "year" as const,
        },
        additionalStorage: {
          quantity: 2,
          name: "additionalStorageGB" as const,
          cost: 4.0,
          cadence: "year" as const,
        },
        estimatedTax: 3.28,
      },
      status: "active",
      nextCharge: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
};

export const PremiumDiscount: Story = {
  name: "Premium: Discount",
  args: {
    subscription: {
      subscriber: {
        type: "account",
        data: {
          id: "user-123" as any,
          email: "user@example.com",
        },
      },
      cart: {
        passwordManager: {
          quantity: 1,
          name: "premiumMembership" as const,
          cost: 10.0,
          cadence: "year" as const,
        },
        additionalStorage: {
          quantity: 2,
          name: "additionalStorageGB" as const,
          cost: 4.0,
          cadence: "year" as const,
        },
        discount: {
          _tag: "percent-off",
          value: 30,
          active: true,
        },
        estimatedTax: 0.0,
      },
      status: "active",
      nextCharge: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
};
