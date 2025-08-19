// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { StepperSelectionEvent } from "@angular/cdk/stepper";
import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, firstValueFrom, map, Subject, switchMap, takeUntil } from "rxjs";

import {
  InputPasswordFlow,
  PasswordInputResult,
  RegistrationFinishService,
} from "@bitwarden/auth/angular";
import { LoginStrategyServiceAbstraction, PasswordLoginCredentials } from "@bitwarden/auth/common";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import {
  OrganizationBillingServiceAbstraction as OrganizationBillingService,
  OrganizationInformation,
  PlanInformation,
} from "@bitwarden/common/billing/abstractions/organization-billing.service";
import { PlanType, ProductTierType, ProductType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ToastService } from "@bitwarden/components";

import {
  OrganizationCreatedEvent,
  SubscriptionProduct,
  TrialOrganizationType,
} from "../../../billing/accounts/trial-initiation/trial-billing-step.component";
import { RouterService } from "../../../core/router.service";
import { VerticalStepperComponent } from "../vertical-stepper/vertical-stepper.component";

export type InitiationPath =
  | "Password Manager trial from marketing website"
  | "Secrets Manager trial from marketing website";

@Component({
  selector: "app-complete-trial-initiation",
  templateUrl: "complete-trial-initiation.component.html",
  standalone: false,
})
export class CompleteTrialInitiationComponent implements OnInit, OnDestroy {
  @ViewChild("stepper", { static: false }) verticalStepper: VerticalStepperComponent;

  inputPasswordFlow = InputPasswordFlow.SetInitialPasswordAccountRegistration;
  initializing = true;

  /** Password Manager or Secrets Manager */
  product: ProductType;
  /** The tier of product being subscribed to */
  productTier: ProductTierType;
  /** Product types that display steppers for Password Manager */
  stepperProductTypes: ProductTierType[] = [
    ProductTierType.Teams,
    ProductTierType.Enterprise,
    ProductTierType.Families,
  ];

  /** Display multi-step trial flow when true */
  useTrialStepper = false;

  /** True, registering a password is in progress */
  submitting = false;

  /** Valid product types, used to filter out invalid query parameters */
  validProducts = [ProductType.PasswordManager, ProductType.SecretsManager];

  orgInfoSubLabel = "";
  orgId = "";
  orgLabel = "";
  billingSubLabel = "";
  enforcedPolicyOptions: MasterPasswordPolicyOptions;

  /** User's email address associated with the trial */
  email = "";
  /** Token from the backend associated with the email verification */
  emailVerificationToken: string;
  loading = false;
  productTierValue: number;

  trialLength: number;

  orgInfoFormGroup = this.formBuilder.group({
    name: ["", { validators: [Validators.required, Validators.maxLength(50)], updateOn: "change" }],
    billingEmail: [""],
  });

  private destroy$ = new Subject<void>();
  protected readonly SubscriptionProduct = SubscriptionProduct;
  protected readonly ProductType = ProductType;
  protected trialPaymentOptional$ = this.configService.getFeatureFlag$(
    FeatureFlag.TrialPaymentOptional,
  );
  protected allowTrialLengthZero$ = this.configService.getFeatureFlag$(
    FeatureFlag.AllowTrialLengthZero,
  );

  constructor(
    protected router: Router,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private logService: LogService,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyService: PolicyService,
    private i18nService: I18nService,
    private routerService: RouterService,
    private organizationBillingService: OrganizationBillingService,
    private organizationInviteService: OrganizationInviteService,
    private toastService: ToastService,
    private registrationFinishService: RegistrationFinishService,
    private validationService: ValidationService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private configService: ConfigService,
    private accountService: AccountService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((qParams) => {
      // Retrieve email from query params
      if (qParams.email != null && qParams.email.indexOf("@") > -1) {
        this.email = qParams.email;
        this.orgInfoFormGroup.controls.billingEmail.setValue(qParams.email);
      }

      // Show email validation toast when coming from email
      if (qParams.fromEmail && qParams.fromEmail === "true") {
        this.toastService.showToast({
          title: null,
          message: this.i18nService.t("emailVerifiedV2"),
          variant: "success",
        });
      }

      if (qParams.token != null) {
        this.emailVerificationToken = qParams.token;
      }

      const product = parseInt(qParams.product);

      // Get product from query params, default to password manager
      this.product = this.validProducts.includes(product) ? product : ProductType.PasswordManager;

      const productTierParam = parseInt(qParams.productTier) as ProductTierType;
      this.productTierValue = productTierParam;

      /** Only show the trial stepper for a subset of types */
      const showPasswordManagerStepper = this.stepperProductTypes.includes(productTierParam);

      /** All types of secret manager should see the trial stepper */
      const showSecretsManagerStepper = this.product === ProductType.SecretsManager;

      if ((showPasswordManagerStepper || showSecretsManagerStepper) && !isNaN(productTierParam)) {
        this.productTier = productTierParam;

        this.orgLabel = this.planTypeDisplay;

        this.useTrialStepper = true;
      }

      this.trialLength = qParams.trialLength ? parseInt(qParams.trialLength) : 7;

      // Are they coming from an email for sponsoring a families organization
      // After logging in redirect them to setup the families sponsorship
      this.setupFamilySponsorship(qParams.sponsorshipToken);
    });

    const invite = await this.organizationInviteService.getOrganizationInvite();
    let policies: Policy[] | null = null;

    if (invite != null) {
      try {
        policies = await this.policyApiService.getPoliciesByToken(
          invite.organizationId,
          invite.token,
          invite.email,
          invite.organizationUserId,
        );
      } catch (e) {
        this.logService.error(e);
      }
    }

    if (policies !== null) {
      this.accountService.activeAccount$
        .pipe(
          getUserId,
          switchMap((userId) => this.policyService.masterPasswordPolicyOptions$(userId, policies)),
          takeUntil(this.destroy$),
        )
        .subscribe((enforcedPasswordPolicyOptions) => {
          this.enforcedPolicyOptions = enforcedPasswordPolicyOptions;
        });
    }

    this.orgInfoFormGroup.controls.name.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.orgInfoFormGroup.controls.name.markAsTouched();
      });

    this.initializing = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Handle manual stepper change */
  verticalStepChange(event: StepperSelectionEvent) {
    if (event.selectedIndex === 1 && this.orgInfoFormGroup.controls.name.value === "") {
      this.orgInfoSubLabel = this.planInfoLabel;
    } else if (event.previouslySelectedIndex === 1) {
      this.orgInfoSubLabel = this.orgInfoFormGroup.controls.name.value;
    }
  }

  async orgNameEntrySubmit(): Promise<void> {
    const isTrialPaymentOptional = await firstValueFrom(this.trialPaymentOptional$);

    /** Only skip payment if the flag is on AND trialLength > 0 */
    if (isTrialPaymentOptional && this.trialLength > 0) {
      await this.createOrganizationOnTrial();
    } else {
      await this.conditionallyCreateOrganization();
    }
  }

  /** Update local details from organization created event */
  createdOrganization(event: OrganizationCreatedEvent) {
    this.orgId = event.organizationId;
    this.billingSubLabel = event.planDescription;
    this.verticalStepper.next();
  }

  /** create an organization on trial without payment method */
  async createOrganizationOnTrial() {
    this.loading = true;
    let trialInitiationPath: InitiationPath = "Password Manager trial from marketing website";
    let plan: PlanInformation = {
      type: this.getPlanType(),
      passwordManagerSeats: 1,
    };

    if (this.product === ProductType.SecretsManager) {
      trialInitiationPath = "Secrets Manager trial from marketing website";
      plan = {
        ...plan,
        subscribeToSecretsManager: true,
        isFromSecretsManagerTrial: true,
        secretsManagerSeats: 1,
      };
    }

    const organization: OrganizationInformation = {
      name: this.orgInfoFormGroup.value.name,
      billingEmail: this.orgInfoFormGroup.value.billingEmail,
      initiationPath: trialInitiationPath,
    };

    const response = await this.organizationBillingService.purchaseSubscriptionNoPaymentMethod({
      organization,
      plan,
    });

    this.orgId = response?.id;
    this.billingSubLabel = response.name.toString();
    this.loading = false;
    this.verticalStepper.next();
  }

  /** Move the user to the previous step */
  previousStep() {
    this.verticalStepper.previous();
  }

  getPlanType() {
    switch (this.productTier) {
      case ProductTierType.Teams:
        return PlanType.TeamsAnnually;
      case ProductTierType.Enterprise:
        return PlanType.EnterpriseAnnually;
      case ProductTierType.Families:
        return PlanType.FamiliesAnnually;
      case ProductTierType.Free:
        return PlanType.Free;
      default:
        return PlanType.EnterpriseAnnually;
    }
  }

  get isSecretsManagerFree() {
    return this.product === ProductType.SecretsManager && this.productTier === ProductTierType.Free;
  }

  get planTypeDisplay() {
    switch (this.productTier) {
      case ProductTierType.Teams:
        return "Teams";
      case ProductTierType.Enterprise:
        return "Enterprise";
      case ProductTierType.Families:
        return "Families";
      default:
        return "";
    }
  }

  get planInfoLabel() {
    switch (this.productTier) {
      case ProductTierType.Teams:
        return this.i18nService.t("enterTeamsOrgInfo");
      case ProductTierType.Enterprise:
        return this.i18nService.t("enterEnterpriseOrgInfo");
      case ProductTierType.Families:
        return this.i18nService.t("enterFamiliesOrgInfo");
      default:
        return "";
    }
  }

  get trialOrganizationType(): TrialOrganizationType {
    if (this.productTier === ProductTierType.Free) {
      return null;
    }

    return this.productTier;
  }

  readonly showBillingStep$ = combineLatest([
    this.trialPaymentOptional$,
    this.allowTrialLengthZero$,
  ]).pipe(
    map(([trialPaymentOptional, allowTrialLengthZero]) => {
      return (
        (!trialPaymentOptional && !this.isSecretsManagerFree) ||
        (trialPaymentOptional && allowTrialLengthZero && this.trialLength === 0)
      );
    }),
  );

  /** Create an organization unless the trial is for secrets manager */
  async conditionallyCreateOrganization(): Promise<void> {
    if (!this.isSecretsManagerFree) {
      this.verticalStepper.next();
      return;
    }

    const response = await this.organizationBillingService.startFree({
      organization: {
        name: this.orgInfoFormGroup.value.name,
        billingEmail: this.orgInfoFormGroup.value.billingEmail,
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

  /**
   * Complete the users registration with their password.
   *
   * When a the trial stepper isn't used, redirect the user to the login page.
   */
  async handlePasswordSubmit(passwordInputResult: PasswordInputResult) {
    if (!this.useTrialStepper) {
      await this.finishRegistration(passwordInputResult);
      this.submitting = false;

      await this.router.navigate(["/login"], { queryParams: { email: this.email } });
      return;
    }

    await this.finishRegistration(passwordInputResult);

    await this.logIn(passwordInputResult.newPassword);

    this.submitting = false;

    this.verticalStepper.next();
  }

  private setupFamilySponsorship(sponsorshipToken: string) {
    if (sponsorshipToken != null) {
      const route = this.router.createUrlTree(["setup/families-for-enterprise"], {
        queryParams: { plan: sponsorshipToken },
      });
      this.routerService.setPreviousUrl(route.toString());
    }
  }

  /** Logs the user in */
  private async logIn(masterPassword: string): Promise<void> {
    const credentials = new PasswordLoginCredentials(this.email, masterPassword);

    await this.loginStrategyService.logIn(credentials);
  }

  finishRegistration(passwordInputResult: PasswordInputResult) {
    this.submitting = true;
    return this.registrationFinishService
      .finishRegistration(this.email, passwordInputResult, this.emailVerificationToken)
      .catch((e) => {
        this.validationService.showError(e);
        this.submitting = false;
        return null;
      });
  }
}
