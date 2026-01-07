import { CommonModule, DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeModule,
  BadgeVariant,
  ButtonModule,
  CalloutModule,
  CardComponent,
  TypographyModule,
  CalloutTypes,
  ButtonType,
} from "@bitwarden/components";
import { CartSummaryComponent, Maybe } from "@bitwarden/pricing";
import { BitwardenSubscription, SubscriptionStatuses } from "@bitwarden/subscription";
import { I18nPipe } from "@bitwarden/ui-common";

export type PlanCardAction =
  | "contact-support"
  | "manage-invoices"
  | "reinstate-subscription"
  | "update-payment"
  | "upgrade-plan";

type Badge = { text: string; variant: BadgeVariant };

type Callout = Maybe<{
  title: string;
  type: CalloutTypes;
  icon?: string;
  description: string;
  callsToAction?: {
    text: string;
    buttonType: ButtonType;
    action: PlanCardAction;
  }[];
}>;

@Component({
  selector: "billing-subscription-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./subscription-card.component.html",
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
})
export class SubscriptionCardComponent {
  private datePipe = inject(DatePipe);
  private i18nService = inject(I18nService);

  protected readonly dateFormat = "MMM. d, y";

  readonly title = input.required<string>();

  readonly subscription = input.required<BitwardenSubscription>();

  readonly showUpgradeButton = input<boolean>(false);

  readonly callToActionClicked = output<PlanCardAction>();

  readonly badge = computed<Badge>(() => {
    const subscription = this.subscription();
    const pendingCancellation: Badge = {
      text: this.i18nService.t("pendingCancellation"),
      variant: "warning",
    };
    switch (subscription.status) {
      case SubscriptionStatuses.Incomplete: {
        return {
          text: this.i18nService.t("updatePayment"),
          variant: "warning",
        };
      }
      case SubscriptionStatuses.IncompleteExpired: {
        return {
          text: this.i18nService.t("expired"),
          variant: "danger",
        };
      }
      case SubscriptionStatuses.Trialing: {
        if (subscription.cancelAt) {
          return pendingCancellation;
        }
        return {
          text: this.i18nService.t("trial"),
          variant: "success",
        };
      }
      case SubscriptionStatuses.Active: {
        if (subscription.cancelAt) {
          return pendingCancellation;
        }
        return {
          text: this.i18nService.t("active"),
          variant: "success",
        };
      }
      case SubscriptionStatuses.PastDue: {
        return {
          text: this.i18nService.t("pastDue"),
          variant: "warning",
        };
      }
      case SubscriptionStatuses.Canceled: {
        return {
          text: this.i18nService.t("canceled"),
          variant: "danger",
        };
      }
      case SubscriptionStatuses.Unpaid: {
        return {
          text: this.i18nService.t("unpaid"),
          variant: "danger",
        };
      }
    }
  });

  readonly callout = computed<Callout>(() => {
    const subscription = this.subscription();
    switch (subscription.status) {
      case SubscriptionStatuses.Incomplete: {
        return {
          title: this.i18nService.t("updatePayment"),
          type: "warning",
          description: this.i18nService.t("weCouldNotProcessYourPayment"),
          callsToAction: [
            {
              text: this.i18nService.t("updatePayment"),
              buttonType: "unstyled",
              action: "update-payment",
            },
            {
              text: this.i18nService.t("contactSupportShort"),
              buttonType: "unstyled",
              action: "contact-support",
            },
          ],
        };
      }
      case SubscriptionStatuses.IncompleteExpired: {
        return {
          title: this.i18nService.t("expired"),
          type: "danger",
          description: this.i18nService.t("yourSubscriptionHasExpired"),
          callsToAction: [
            {
              text: this.i18nService.t("contactSupportShort"),
              buttonType: "unstyled",
              action: "contact-support",
            },
          ],
        };
      }
      case SubscriptionStatuses.Trialing:
      case SubscriptionStatuses.Active: {
        if (subscription.cancelAt) {
          const cancelAt = this.datePipe.transform(subscription.cancelAt, this.dateFormat);
          return {
            title: this.i18nService.t("pendingCancellation"),
            type: "warning",
            description: this.i18nService.t("yourSubscriptionIsScheduledToCancel", cancelAt!),
            callsToAction: [
              {
                text: this.i18nService.t("reinstateSubscription"),
                buttonType: "unstyled",
                action: "reinstate-subscription",
              },
            ],
          };
        }
        if (!this.showUpgradeButton()) {
          return null;
        }
        return {
          title: this.i18nService.t("upgradeYourPlan"),
          type: "info",
          icon: "bwi-gem",
          description: this.i18nService.t("premiumShareEvenMore"),
          callsToAction: [
            {
              text: this.i18nService.t("upgradeNow"),
              buttonType: "unstyled",
              action: "upgrade-plan",
            },
          ],
        };
      }
      case SubscriptionStatuses.PastDue: {
        const suspension = this.datePipe.transform(subscription.suspension, this.dateFormat);
        return {
          title: this.i18nService.t("pastDue"),
          type: "warning",
          description: this.i18nService.t(
            "youHaveAGracePeriod",
            subscription.gracePeriod,
            suspension!,
          ),
          callsToAction: [
            {
              text: this.i18nService.t("manageInvoices"),
              buttonType: "unstyled",
              action: "manage-invoices",
            },
          ],
        };
      }
      case SubscriptionStatuses.Canceled: {
        return null;
      }
      case SubscriptionStatuses.Unpaid: {
        return {
          title: this.i18nService.t("unpaid"),
          type: "danger",
          description: this.i18nService.t("toReactivateYourSubscription"),
          callsToAction: [
            {
              text: this.i18nService.t("manageInvoices"),
              buttonType: "unstyled",
              action: "manage-invoices",
            },
          ],
        };
      }
    }
  });

  readonly cancelAt = computed<Maybe<Date>>(() => {
    const subscription = this.subscription();
    if (
      subscription.status === SubscriptionStatuses.Trialing ||
      subscription.status === SubscriptionStatuses.Active
    ) {
      return subscription.cancelAt;
    }
  });

  readonly canceled = computed<Maybe<Date>>(() => {
    const subscription = this.subscription();
    if (subscription.status === SubscriptionStatuses.Canceled) {
      return subscription.canceled;
    }
  });

  readonly nextCharge = computed<Maybe<Date>>(() => {
    const subscription = this.subscription();
    if (
      subscription.status === SubscriptionStatuses.Trialing ||
      subscription.status === SubscriptionStatuses.Active
    ) {
      return subscription.nextCharge;
    }
  });

  readonly suspension = computed<Maybe<Date>>(() => {
    const subscription = this.subscription();
    if (
      subscription.status === SubscriptionStatuses.Incomplete ||
      subscription.status === SubscriptionStatuses.IncompleteExpired ||
      subscription.status === SubscriptionStatuses.PastDue ||
      subscription.status === SubscriptionStatuses.Unpaid
    ) {
      return subscription.suspension;
    }
  });
}
