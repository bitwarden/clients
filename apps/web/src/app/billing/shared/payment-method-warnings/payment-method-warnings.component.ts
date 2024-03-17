import { Component } from "@angular/core";
import { map, Observable } from "rxjs";

import { PaymentMethodWarningsServiceAbstraction as PaymentMethodWarningService } from "@bitwarden/common/billing/abstractions/payment-method-warnings-service.abstraction";

type Warning = {
  organizationId: string;
  organizationName: string;
};

@Component({
  selector: "app-payment-method-warnings",
  templateUrl: "payment-method-warnings.component.html",
})
export class PaymentMethodWarningsComponent {
  constructor(private paymentMethodWarningService: PaymentMethodWarningService) {}

  protected warnings$: Observable<Warning[]> =
    this.paymentMethodWarningService.paymentMethodWarnings$.pipe(
      map((warnings) =>
        Object.entries(warnings ?? [])
          .filter(([_, warning]) => warning.risksSubscriptionFailure && !warning.acknowledged)
          .map(([organizationId, { organizationName }]) => ({
            organizationId,
            organizationName,
          })),
      ),
    );

  protected async closeWarning(organizationId: string): Promise<void> {
    await this.paymentMethodWarningService.acknowledge(organizationId);
  }
}
