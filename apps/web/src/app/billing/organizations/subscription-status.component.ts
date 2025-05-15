// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

type ComponentData = {
  status?: {
    label: string;
    value: string;
  };
  date?: {
    label: string;
    value: string;
  };
  callout?: {
    severity: "danger" | "warning";
    header: string;
    body: string;
    showReinstatementButton: boolean;
  };
};

@Component({
  selector: "app-subscription-status",
  templateUrl: "subscription-status.component.html",
  standalone: false,
})
export class SubscriptionStatusComponent {
  @Input({ required: true }) organizationSubscriptionResponse: OrganizationSubscriptionResponse;
  @Output() reinstatementRequested = new EventEmitter<void>();

  constructor(
    private datePipe: DatePipe,
    private i18nService: I18nService,
  ) {}

  get displayedStatus(): string {
    const sponsored = this.subscription.items.some((item) => item.sponsoredSubscriptionItem);
    return sponsored ? this.i18nService.t("sponsored") : this.data.status.value;
  }

  get planName() {
    return this.organizationSubscriptionResponse.plan.name;
  }

  get status(): string {
    return this.subscription
      ? this.subscription.status != "canceled" && this.subscription.cancelAtEndDate
        ? "pending_cancellation"
        : this.subscription.status
      : "free";
  }

  get subscription() {
    return this.organizationSubscriptionResponse?.subscription;
  }

  get data(): ComponentData {
    const defaultStatusLabel = this.i18nService.t("status");

    const nextChargeDateLabel = this.i18nService.t("nextCharge");
    const subscriptionExpiredDateLabel = this.i18nService.t("subscriptionExpired");
    const cancellationDateLabel = this.i18nService.t("cancellationDate");

    switch (this.status) {
      case "free": {
        return {};
      }
      case "trialing": {
        return {
          status: {
            label: defaultStatusLabel,
            value: this.i18nService.t("trial"),
          },
          date: {
            label: nextChargeDateLabel,
            value: this.subscription.periodEndDate,
          },
        };
      }
      case "active": {
        return {
          status: {
            label: defaultStatusLabel,
            value: this.i18nService.t("active"),
          },
          date: {
            label: nextChargeDateLabel,
            value: this.subscription.periodEndDate,
          },
        };
      }
      case "past_due": {
        const pastDueText = this.i18nService.t("pastDue");
        const suspensionDate = this.datePipe.transform(
          this.subscription.suspensionDate,
          "mediumDate",
        );
        const calloutBody =
          this.subscription.collectionMethod === "charge_automatically"
            ? this.i18nService.t(
                "pastDueWarningForChargeAutomatically",
                this.subscription.gracePeriod,
                suspensionDate,
              )
            : this.i18nService.t(
                "pastDueWarningForSendInvoice",
                this.subscription.gracePeriod,
                suspensionDate,
              );
        return {
          status: {
            label: defaultStatusLabel,
            value: pastDueText,
          },
          date: {
            label: subscriptionExpiredDateLabel,
            value: this.subscription.unpaidPeriodEndDate,
          },
          callout: {
            severity: "warning",
            header: pastDueText,
            body: calloutBody,
            showReinstatementButton: false,
          },
        };
      }
      case "unpaid": {
        return {
          status: {
            label: defaultStatusLabel,
            value: this.i18nService.t("unpaid"),
          },
          date: {
            label: subscriptionExpiredDateLabel,
            value: this.subscription.unpaidPeriodEndDate,
          },
          callout: {
            severity: "danger",
            header: this.i18nService.t("unpaidInvoice"),
            body: this.i18nService.t("toReactivateYourSubscription"),
            showReinstatementButton: false,
          },
        };
      }
      case "pending_cancellation": {
        const pendingCancellationText = this.i18nService.t("pendingCancellation");
        return {
          status: {
            label: defaultStatusLabel,
            value: pendingCancellationText,
          },
          date: {
            label: cancellationDateLabel,
            value: this.subscription.periodEndDate,
          },
          callout: {
            severity: "warning",
            header: pendingCancellationText,
            body: this.i18nService.t("subscriptionPendingCanceled"),
            showReinstatementButton: true,
          },
        };
      }
      case "incomplete_expired":
      case "canceled": {
        const canceledText = this.i18nService.t("canceled");
        return {
          status: {
            label: defaultStatusLabel,
            value: canceledText,
          },
          date: {
            label: cancellationDateLabel,
            value: this.subscription.periodEndDate,
          },
          callout: {
            severity: "danger",
            header: canceledText,
            body: this.i18nService.t("subscriptionCanceled"),
            showReinstatementButton: false,
          },
        };
      }
    }
  }

  requestReinstatement = () => this.reinstatementRequested.emit();
}
