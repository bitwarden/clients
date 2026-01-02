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
import { BitwardenSubscription } from "@bitwarden/subscription";
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
      case "incomplete": {
        return {
          text: this.i18nService.t("updatePayment"),
          variant: "warning",
        };
      }
      case "incomplete_expired": {
        return {
          text: this.i18nService.t("expired"),
          variant: "danger",
        };
      }
      case "trialing": {
        if (subscription.cancelAt) {
          return pendingCancellation;
        }
        return {
          text: this.i18nService.t("trial"),
          variant: "success",
        };
      }
      case "active": {
        if (subscription.cancelAt) {
          return pendingCancellation;
        }
        return {
          text: this.i18nService.t("active"),
          variant: "success",
        };
      }
      case "past_due": {
        return {
          text: this.i18nService.t("pastDue"),
          variant: "warning",
        };
      }
      case "canceled": {
        return {
          text: this.i18nService.t("canceled"),
          variant: "danger",
        };
      }
      case "unpaid": {
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
      case "incomplete": {
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
      case "incomplete_expired": {
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
      case "trialing":
      case "active": {
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
      case "past_due": {
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
      case "canceled": {
        return null;
      }
      case "unpaid": {
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
    if (subscription.status === "trialing" || subscription.status === "active") {
      return subscription.cancelAt;
    }
  });

  readonly canceled = computed<Maybe<Date>>(() => {
    const subscription = this.subscription();
    if (subscription.status === "canceled") {
      return subscription.canceled;
    }
  });

  readonly nextCharge = computed<Maybe<Date>>(() => {
    const subscription = this.subscription();
    if (subscription.status === "active" || subscription.status === "trialing") {
      return subscription.nextCharge;
    }
  });

  readonly suspension = computed<Maybe<Date>>(() => {
    const subscription = this.subscription();
    if (
      subscription.status === "incomplete" ||
      subscription.status === "incomplete_expired" ||
      subscription.status === "past_due" ||
      subscription.status === "unpaid"
    ) {
      return subscription.suspension;
    }
  });
}
