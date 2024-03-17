import { Component, Input, ViewChild } from "@angular/core";

import { ProductType } from "@bitwarden/common/enums";

import {
  OrganizationCreatedEvent,
  SubscriptionProduct,
  TrialOrganizationType,
} from "../../../billing/accounts/trial-initiation/trial-billing-step.component";
import { VerticalStepperComponent } from "../../trial-initiation/vertical-stepper/vertical-stepper.component";
import { SecretsManagerTrialFreeStepperComponent } from "../secrets-manager/secrets-manager-trial-free-stepper.component";

@Component({
  selector: "app-secrets-manager-trial-paid-stepper",
  templateUrl: "secrets-manager-trial-paid-stepper.component.html",
})
export class SecretsManagerTrialPaidStepperComponent extends SecretsManagerTrialFreeStepperComponent {
  @ViewChild("stepper", { static: false }) verticalStepper: VerticalStepperComponent;
  @Input() organizationTypeQueryParameter: string;

  billingSubLabel = this.i18nService.t("billingTrialSubLabel");
  organizationId: string;

  organizationCreated(event: OrganizationCreatedEvent) {
    this.organizationId = event.organizationId;
    this.billingSubLabel = event.planDescription;
    this.verticalStepper.next();
  }

  steppedBack() {
    this.verticalStepper.previous();
  }

  get createAccountLabel() {
    const organizationType =
      this.productType === ProductType.TeamsStarter
        ? "Teams Starter"
        : ProductType[this.productType];
    return `Before creating your ${organizationType} organization, you first need to log in or create a personal account.`;
  }

  get productType(): TrialOrganizationType {
    switch (this.organizationTypeQueryParameter) {
      case "enterprise":
        return ProductType.Enterprise;
      case "families":
        return ProductType.Families;
      case "teams":
        return ProductType.Teams;
      case "teamsStarter":
        return ProductType.TeamsStarter;
    }
  }

  protected readonly SubscriptionProduct = SubscriptionProduct;
}
