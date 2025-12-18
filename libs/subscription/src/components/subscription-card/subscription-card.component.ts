import { CommonModule, DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
import { CartSummaryComponent } from "@bitwarden/pricing";
import { BitwardenSubscription, Maybe } from "@bitwarden/subscription";
import { I18nPipe } from "@bitwarden/ui-common";

export type PlanCardAction = "contact-support" | "reinstate-subscription" | "upgrade-plan";

type Badge = { text: string; variant: BadgeVariant };

type Callout = Maybe<{
  title: string;
  type: CalloutTypes;
  icon?: string;
  description: string;
  callToAction?: {
    text: string;
    buttonType: ButtonType;
    action: PlanCardAction;
  };
}>;

/**
 * A reusable UI-only component that displays a plan membership card with status, billing info,
 * and an optional upgrade callout. This component has no external dependencies and performs no
 * logic - it only displays data and emits events when buttons are clicked.
 */
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
  private configService = inject(ConfigService);
  private datePipe = inject(DatePipe);
  private i18nService = inject(I18nService);

  private readonly premiumToOrganizationUpgradeEnabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM29593_PremiumToOrganizationUpgrade),
    { initialValue: false },
  );

  /**
   * The title of the plan card (e.g., "Premium membership")
   */
  readonly title = input.required<string>();

  /**
   * The subscription being rendered by the card
   */
  readonly subscription = input.required<BitwardenSubscription>();

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
          text: this.i18nService.t("incomplete"),
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
    const pendingCancellation: Callout = {
      title: this.i18nService.t("pendingCancellation"),
      type: "warning",
      description: this.i18nService.t("subscriptionPendingCanceled"),
      callToAction: {
        text: this.i18nService.t("reinstateSubscription"),
        buttonType: "unstyled",
        action: "reinstate-subscription",
      },
    };
    switch (subscription.status) {
      case "incomplete": {
        return {
          title: this.i18nService.t("incomplete"),
          type: "warning",
          description: this.i18nService.t("subscriptionIncompleteNotice"),
          callToAction: {
            text: this.i18nService.t("contactSupportShort"),
            buttonType: "unstyled",
            action: "contact-support",
          },
        };
      }
      case "incomplete_expired": {
        return {
          title: this.i18nService.t("expired"),
          type: "danger",
          description: this.i18nService.t("subscriptionExpiredNotice"),
          callToAction: {
            text: this.i18nService.t("contactSupportShort"),
            buttonType: "dangerPrimary",
            action: "contact-support",
          },
        };
      }
      case "trialing":
      case "active": {
        if (subscription.cancelAt) {
          return pendingCancellation;
        }
        const canUpgrade =
          subscription.subscriber.type === "account" && this.premiumToOrganizationUpgradeEnabled();
        if (!canUpgrade) {
          return null;
        }
        return {
          title: this.i18nService.t("upgradeYourPlan"),
          type: "info",
          icon: "bwi-gem",
          description: this.i18nService.t("premiumShareEvenMore"),
          callToAction: {
            text: this.i18nService.t("upgradeNow"),
            buttonType: "primary",
            action: "upgrade-plan",
          },
        };
      }
      case "past_due": {
        const suspension = this.datePipe.transform(subscription.suspension, "MMM. d, y");
        return {
          title: this.i18nService.t("pastDue"),
          type: "warning",
          description: this.i18nService.t(
            "pastDueWarningForChargeAutomatically",
            subscription.gracePeriod,
            suspension!,
          ),
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
        };
      }
    }
  });

  readonly cancelAt = computed<Date | undefined>(() => {
    const subscription = this.subscription();
    if (subscription.status === "trialing" || subscription.status === "active") {
      return subscription.cancelAt;
    }
  });

  readonly canceled = computed<Date | undefined>(() => {
    const subscription = this.subscription();
    if (subscription.status === "canceled") {
      return subscription.canceled;
    }
  });

  readonly nextCharge = computed<Date | undefined>(() => {
    const subscription = this.subscription();
    if (subscription.status === "active" || subscription.status === "trialing") {
      return subscription.nextCharge;
    }
  });

  readonly suspension = computed<Date | undefined>(() => {
    const subscription = this.subscription();
    if (subscription.status === "incomplete" || subscription.status === "incomplete_expired") {
      // Add 23 hours to created date to get suspension date
      return new Date(subscription.created.getTime() + 23 * 60 * 60 * 1000);
    } else if (subscription.status === "past_due" || subscription.status === "unpaid") {
      return subscription.suspension;
    }
  });
}
