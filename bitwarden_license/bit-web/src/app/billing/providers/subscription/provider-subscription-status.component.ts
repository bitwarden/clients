// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe } from "@angular/common";
import { Component, Input } from "@angular/core";

import { ProviderType } from "@bitwarden/common/admin-console/enums";
import { ProviderSubscriptionResponse } from "@bitwarden/common/billing/models/response/provider-subscription-response";
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
  };
};

@Component({
  selector: "app-provider-subscription-status",
  templateUrl: "provider-subscription-status.component.html",
  standalone: false,
})
export class ProviderSubscriptionStatusComponent {
  @Input({ required: true }) subscription: ProviderSubscriptionResponse;

  constructor(
    private datePipe: DatePipe,
    private i18nService: I18nService,
  ) {}

  get plan(): string {
    switch (this.subscription.providerType) {
      case ProviderType.Msp:
        return "managedServiceProvider";
      case ProviderType.BusinessUnit:
        return "businessUnit";
    }
  }

  get status(): string {
    if (this.subscription.cancelAt && this.subscription.status === "active") {
      return "pending_cancellation";
    }

    return this.subscription.status;
  }

  get data(): ComponentData {
    const defaultStatusLabel = this.i18nService.t("status");

    const nextChargeDateLabel = this.i18nService.t("nextCharge");
    const subscriptionExpiredDateLabel = this.i18nService.t("subscriptionExpired");
    const cancellationDateLabel = this.i18nService.t("cancellationDate");

    switch (this.status) {
      case "active": {
        return {
          status: {
            label: defaultStatusLabel,
            value: this.i18nService.t("active"),
          },
          date: {
            label: nextChargeDateLabel,
            value: this.subscription.currentPeriodEndDate,
          },
        };
      }
      case "trialing": {
        return {
          status: {
            label: defaultStatusLabel,
            value: this.i18nService.t("trial"),
          },
          date: {
            label: nextChargeDateLabel,
            value: this.subscription.currentPeriodEndDate,
          },
        };
      }
      case "past_due": {
        const pastDueText = this.i18nService.t("pastDue");
        const suspensionDate = this.datePipe.transform(
          this.subscription.suspension.suspensionDate,
          "mediumDate",
        );
        const calloutBody =
          this.subscription.collectionMethod === "charge_automatically"
            ? this.i18nService.t(
                "pastDueWarningForChargeAutomatically",
                this.subscription.suspension.gracePeriod,
                suspensionDate,
              )
            : this.i18nService.t(
                "pastDueWarningForSendInvoice",
                this.subscription.suspension.gracePeriod,
                suspensionDate,
              );
        return {
          status: {
            label: defaultStatusLabel,
            value: pastDueText,
          },
          date: {
            label: subscriptionExpiredDateLabel,
            value: this.subscription.suspension.unpaidPeriodEndDate,
          },
          callout: {
            severity: "warning",
            header: pastDueText,
            body: calloutBody,
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
            value: this.subscription.suspension.unpaidPeriodEndDate,
          },
          callout: {
            severity: "danger",
            header: this.i18nService.t("unpaidInvoice"),
            body: this.i18nService.t("toReactivateYourSubscription"),
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
            value: this.subscription.cancelAt,
          },
          callout: {
            severity: "warning",
            header: pendingCancellationText,
            body:
              this.i18nService.t("subscriptionPendingCanceled") +
              this.i18nService.t("providerReinstate"),
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
            value: this.subscription.currentPeriodEndDate,
          },
          callout: {
            severity: "danger",
            header: canceledText,
            body: this.i18nService.t("subscriptionCanceled"),
          },
        };
      }
    }
  }
}
