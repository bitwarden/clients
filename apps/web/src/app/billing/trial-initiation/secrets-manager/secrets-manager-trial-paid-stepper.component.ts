// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnInit, ViewChild } from "@angular/core";
import { UntypedFormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { OrganizationBillingServiceAbstraction as OrganizationBillingService } from "@bitwarden/common/billing/abstractions/organization-billing.service";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ReferenceEventRequest } from "@bitwarden/common/models/request/reference-event.request";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  OrganizationCreatedEvent,
  SubscriptionProduct,
  TrialOrganizationType,
} from "../../../billing/accounts/trial-initiation/trial-billing-step.component";
import { VerticalStepperComponent } from "../../trial-initiation/vertical-stepper/vertical-stepper.component";
import { SecretsManagerTrialFreeStepperComponent } from "../secrets-manager/secrets-manager-trial-free-stepper.component";

export enum ValidOrgParams {
  families = "families",
  enterprise = "enterprise",
  teams = "teams",
  teamsStarter = "teamsStarter",
  individual = "individual",
  premium = "premium",
  free = "free",
}

const trialFlowOrgs = [
  ValidOrgParams.teams,
  ValidOrgParams.teamsStarter,
  ValidOrgParams.enterprise,
  ValidOrgParams.families,
];

@Component({
  selector: "app-secrets-manager-trial-paid-stepper",
  templateUrl: "secrets-manager-trial-paid-stepper.component.html",
})
export class SecretsManagerTrialPaidStepperComponent
  extends SecretsManagerTrialFreeStepperComponent
  implements OnInit
{
  @ViewChild("stepper", { static: false }) verticalStepper: VerticalStepperComponent;
  @Input() organizationTypeQueryParameter: string;

  plan: PlanType;
  createOrganizationLoading = false;
  billingSubLabel = this.i18nService.t("billingTrialSubLabel");
  organizationId: string;

  private destroy$ = new Subject<void>();
  protected enableTrialPayment$ = this.configService.getFeatureFlag$(
    FeatureFlag.TrialPaymentOptional,
  );

  constructor(
    private route: ActivatedRoute,
    private configService: ConfigService,
    protected formBuilder: UntypedFormBuilder,
    protected i18nService: I18nService,
    protected organizationBillingService: OrganizationBillingService,
    protected router: Router,
  ) {
    super(formBuilder, i18nService, organizationBillingService, router);
  }

  async ngOnInit(): Promise<void> {
    this.referenceEventRequest = new ReferenceEventRequest();
    this.referenceEventRequest.initiationPath = "Secrets Manager trial from marketing website";

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((qParams) => {
      if (trialFlowOrgs.includes(qParams.org)) {
        if (qParams.org === ValidOrgParams.teamsStarter) {
          this.plan = PlanType.TeamsStarter;
        } else if (qParams.org === ValidOrgParams.teams) {
          this.plan = PlanType.TeamsAnnually;
        } else if (qParams.org === ValidOrgParams.enterprise) {
          this.plan = PlanType.EnterpriseAnnually;
        }
      }
    });
  }

  organizationCreated(event: OrganizationCreatedEvent) {
    this.organizationId = event.organizationId;
    this.billingSubLabel = event.planDescription;
    this.verticalStepper.next();
  }

  steppedBack() {
    this.verticalStepper.previous();
  }

  async createOrganizationOnTrial(): Promise<void> {
    this.createOrganizationLoading = true;
    const response = await this.organizationBillingService.purchaseSubscriptionNoPaymentMethod({
      organization: {
        name: this.formGroup.get("name").value,
        billingEmail: this.formGroup.get("email").value,
        initiationPath: "Secrets Manager trial from marketing website",
      },
      plan: {
        type: this.plan,
        subscribeToSecretsManager: true,
        isFromSecretsManagerTrial: true,
        passwordManagerSeats: 1,
        secretsManagerSeats: 1,
      },
    });

    this.organizationId = response?.id;
    this.subLabels.organizationInfo = response?.name;
    this.createOrganizationLoading = false;
    this.verticalStepper.next();
  }

  get createAccountLabel() {
    const organizationType =
      this.productType === ProductTierType.TeamsStarter
        ? "Teams Starter"
        : ProductTierType[this.productType];
    return `Before creating your ${organizationType} organization, you first need to log in or create a personal account.`;
  }

  get productType(): TrialOrganizationType {
    switch (this.organizationTypeQueryParameter) {
      case "enterprise":
        return ProductTierType.Enterprise;
      case "families":
        return ProductTierType.Families;
      case "teams":
        return ProductTierType.Teams;
      case "teamsStarter":
        return ProductTierType.TeamsStarter;
    }
  }

  protected readonly SubscriptionProduct = SubscriptionProduct;
}
