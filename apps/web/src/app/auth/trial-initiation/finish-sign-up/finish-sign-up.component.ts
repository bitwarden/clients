import { StepperSelectionEvent } from "@angular/cdk/stepper";
import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { UntypedFormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { OrganizationBillingServiceAbstraction as OrganizationBillingService } from "@bitwarden/common/billing/abstractions/organization-billing.service";
import { ProductType } from "@bitwarden/common/enums";
import { ReferenceEventRequest } from "@bitwarden/common/models/request/reference-event.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

import {
  OrganizationCreatedEvent,
  SubscriptionProduct,
  TrialOrganizationType,
} from "../../../billing/accounts/trial-initiation/trial-billing-step.component";
import { RouterService } from "../../../core/router.service";
import { VerticalStepperComponent } from "../vertical-stepper/vertical-stepper.component";

import { Product } from "./enums/product";

@Component({
  selector: "app-finish-sign-up",
  templateUrl: "finish-sign-up.component.html",
})
export class FinishSignUpComponent implements OnInit, OnDestroy {
  /** Password Manager or Secrets Manager */
  product: Product;
  /** The type of product being subscribed to */
  planType: ProductType;
  /** Product types that display steppers for Password Manager */
  stepperProductTypes: number[] = [ProductType.Teams, ProductType.Enterprise, ProductType.Families];
  /** Display multi-step trial flow when true */
  useTrialStepper = false;
  validProducts = [Product.PasswordManager, Product.SecretsManager];

  email = "";
  fromOrgInvite = false;
  orgInfoSubLabel = "";
  orgId = "";
  orgLabel = "";
  billingSubLabel = "";
  policies: Policy[];
  enforcedPolicyOptions: MasterPasswordPolicyOptions;
  referenceData: ReferenceEventRequest;
  @ViewChild("stepper", { static: false }) verticalStepper: VerticalStepperComponent;

  orgInfoFormGroup = this.formBuilder.group({
    name: ["", { validators: [Validators.required, Validators.maxLength(50)], updateOn: "change" }],
    email: [""],
  });

  private set referenceDataId(referenceId: string) {
    if (referenceId != null) {
      this.referenceData.id = referenceId;
    } else {
      this.referenceData.id = ("; " + document.cookie)
        .split("; reference=")
        .pop()
        .split(";")
        .shift();
    }

    if (this.referenceData.id === "") {
      this.referenceData.id = null;
    } else {
      // Matches "_ga_QBRN562QQQ=value1.value2.session" and captures values and session.
      const regex = /_ga_QBRN562QQQ=([^.]+)\.([^.]+)\.(\d+)/;
      const match = document.cookie.match(regex);
      if (match) {
        this.referenceData.session = match[3];
      }
    }
  }

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    protected router: Router,
    private formBuilder: UntypedFormBuilder,
    private stateService: StateService,
    private logService: LogService,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyService: PolicyService,
    private i18nService: I18nService,
    private routerService: RouterService,
    protected organizationBillingService: OrganizationBillingService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((qParams) => {
      this.referenceData = new ReferenceEventRequest();
      if (qParams.email != null && qParams.email.indexOf("@") > -1) {
        this.email = qParams.email;
        this.fromOrgInvite = qParams.fromOrgInvite === "true";
      }

      this.referenceDataId = qParams.reference;

      this.product = this.validProducts.includes(qParams.product)
        ? qParams.product
        : Product.PasswordManager;

      const planTypeParam = parseInt(qParams.planType);

      /** Only show the trial stepper for a subset of types */
      const showPasswordManagerStepper = this.stepperProductTypes.includes(planTypeParam);

      /** All types of secret manager should see the trial stepper */
      const showSecretsManagerStepper = this.isSecretsManager();

      if ((showPasswordManagerStepper || showSecretsManagerStepper) && !isNaN(planTypeParam)) {
        this.planType = planTypeParam;

        this.orgLabel = this.planTypeDisplay;
        this.referenceData.flow = this.planTypeDisplay;

        this.useTrialStepper = true;
      }

      // Are they coming from an email for sponsoring a families organization
      // After logging in redirect them to setup the families sponsorship
      this.setupFamilySponsorship(qParams.sponsorshipToken);

      const productName = this.isSecretsManager() ? "Secrets Manager" : "Password Manager";
      this.referenceData.initiationPath = !this.planType
        ? "Registration form"
        : `${productName} trial from marketing website`;
    });

    const invite = await this.stateService.getOrganizationInvitation();
    if (invite != null) {
      try {
        const policies = await this.policyApiService.getPoliciesByToken(
          invite.organizationId,
          invite.token,
          invite.email,
          invite.organizationUserId,
        );
        if (policies.data != null) {
          this.policies = Policy.fromListResponse(policies);
        }
      } catch (e) {
        this.logService.error(e);
      }
    }

    if (this.policies != null) {
      this.policyService
        .masterPasswordPolicyOptions$(this.policies)
        .pipe(takeUntil(this.destroy$))
        .subscribe((enforcedPasswordPolicyOptions) => {
          this.enforcedPolicyOptions = enforcedPasswordPolicyOptions;
        });
    }

    this.orgInfoFormGroup.controls.name.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.orgInfoFormGroup.controls.name.markAsTouched();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  stepSelectionChange(event: StepperSelectionEvent) {
    // Set org info sub label
    if (event.selectedIndex === 1 && this.orgInfoFormGroup.controls.name.value === "") {
      this.orgInfoSubLabel = this.planInfoLabel;
    } else if (event.previouslySelectedIndex === 1) {
      this.orgInfoSubLabel = this.orgInfoFormGroup.controls.name.value;
    }

    //set billing sub label
    if (event.selectedIndex === 2) {
      this.billingSubLabel = this.i18nService.t("billingTrialSubLabel");
    }
  }

  createdAccount(email: string) {
    this.email = email;
    this.orgInfoFormGroup.get("email")?.setValue(email);
    this.verticalStepper.next();
  }

  billingSuccess(event: any) {
    this.orgId = event?.orgId;
    this.billingSubLabel = event?.subLabelText;
    this.verticalStepper.next();
  }

  createdOrganization(event: OrganizationCreatedEvent) {
    this.orgId = event.organizationId;
    this.billingSubLabel = event.planDescription;
    this.verticalStepper.next();
  }

  previousStep() {
    this.verticalStepper.previous();
  }

  isSecretsManager() {
    return this.product === Product.SecretsManager;
  }

  async getStartedNavigation(): Promise<void> {
    if (this.product === Product.SecretsManager) {
      await this.router.navigate(["sm", this.orgId]);
    } else {
      await this.router.navigate(["organizations", this.orgId, "vault"]);
    }
  }

  async inviteUsersNavigation(): Promise<void> {
    await this.router.navigate(["organizations", this.orgId, "members"]);
  }

  async conditionallyCreateOrganization(): Promise<void> {
    if (!this.isSecretsManagerFree) {
      this.verticalStepper.next();
      return;
    }

    const response = await this.organizationBillingService.startFree({
      organization: {
        name: this.orgInfoFormGroup.get("name").value,
        billingEmail: this.orgInfoFormGroup.get("email").value,
      },
      plan: {
        type: 0,
        subscribeToSecretsManager: true,
        isFromSecretsManagerTrial: true,
      },
    });

    this.orgId = response.id;
    this.verticalStepper.next();
  }

  get isSecretsManagerFree() {
    return this.isSecretsManager() && this.planType === ProductType.Free;
  }

  get planTypeDisplay() {
    switch (this.planType) {
      case ProductType.Teams:
        return "Teams";
      case ProductType.Enterprise:
        return "Enterprise";
      case ProductType.Families:
        return "Families";
      default:
        return "";
    }
  }

  get planInfoLabel() {
    switch (this.planType) {
      case ProductType.Teams:
        return this.i18nService.t("enterTeamsOrgInfo");
      case ProductType.Enterprise:
        return this.i18nService.t("enterEnterpriseOrgInfo");
      case ProductType.Families:
        return this.i18nService.t("enterFamiliesOrgInfo");
      default:
        return "";
    }
  }

  get trialOrganizationType(): TrialOrganizationType {
    if (this.planType === ProductType.Free) {
      return null;
    }

    return this.planType;
  }

  private setupFamilySponsorship(sponsorshipToken: string) {
    if (sponsorshipToken != null) {
      const route = this.router.createUrlTree(["setup/families-for-enterprise"], {
        queryParams: { plan: sponsorshipToken },
      });
      this.routerService.setPreviousUrl(route.toString());
    }
  }

  protected readonly SubscriptionProduct = SubscriptionProduct;
}
