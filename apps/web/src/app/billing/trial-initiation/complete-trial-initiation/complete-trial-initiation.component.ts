import { StepperSelectionEvent } from "@angular/cdk/stepper";
import { Component, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, firstValueFrom } from "rxjs";

import {
  InputPasswordFlow,
  PasswordInputResult,
  RegistrationFinishService,
} from "@bitwarden/auth/angular";
import { LoginStrategyServiceAbstraction, PasswordLoginCredentials } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  OrganizationBillingServiceAbstraction as OrganizationBillingService,
  OrganizationInformation,
  PlanInformation,
} from "@bitwarden/common/billing/abstractions/organization-billing.service";
import {
  InitiationPath,
  PlanType,
  ProductTierType,
  ProductType,
} from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ToastService } from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";
import { Trial } from "@bitwarden/web-vault/app/billing/trial-initiation/trial-billing-step/trial-billing-step.service";

import { RouterService } from "../../../core/router.service";
import { OrganizationCreatedEvent } from "../trial-billing-step/trial-billing-step.component";
import { VerticalStepperComponent } from "../vertical-stepper/vertical-stepper.component";

import { parseTrialInitiationParams, TrialInitiationParams } from "./trial-initiation-params";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-complete-trial-initiation",
  templateUrl: "complete-trial-initiation.component.html",
  standalone: false,
})
export class CompleteTrialInitiationComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("stepper", { static: false }) verticalStepper!: VerticalStepperComponent;

  inputPasswordFlow = InputPasswordFlow.SetInitialPasswordAccountRegistration;
  initializing = true;

  /** Password Manager or Secrets Manager */
  product?: ProductType;
  /** The tier of product being subscribed to */
  productTier!: ProductTierType;
  /** Product tiers that show the multi-step trial flow for Password Manager. */
  private readonly stepperProductTiers: ProductTierType[] = [
    ProductTierType.Teams,
    ProductTierType.Enterprise,
    ProductTierType.Families,
  ];

  /** Display multi-step trial flow when true */
  useTrialStepper = false;

  /** True, registering a password is in progress */
  submitting = false;

  /** True when PAM billing support is enabled */
  pamBillingSupportEnabled = false;

  /** True when the trial includes Privileged Controls — requested by the link and enabled by flag */
  includesPrivilegedControls = false;

  orgInfoSubLabel = "";
  orgId = "";
  orgLabel = "";
  billingSubLabel = "";

  /** User's email address associated with the trial */
  email = "";
  /** Token from the backend associated with the email verification */
  emailVerificationToken?: string;
  /** Present when the trial was set up by sales rather than self-serve email verification */
  salesAssistedToken?: string;
  loading = false;

  trialLength!: number;
  paymentOptional = false;

  orgInfoFormGroup = this.formBuilder.group({
    name: ["", { validators: [Validators.required, Validators.maxLength(50)], updateOn: "change" }],
    billingEmail: [""],
  });

  protected readonly ProductType = ProductType;

  constructor(
    protected router: Router,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private routerService: RouterService,
    private organizationBillingService: OrganizationBillingService,
    private toastService: ToastService,
    private registrationFinishService: RegistrationFinishService,
    private validationService: ValidationService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private configService: ConfigService,
    private accountService: AccountService,
  ) {
    combineLatest([
      this.route.queryParams,
      this.configService.getFeatureFlag$(FeatureFlag.PamBillingSupport),
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([queryParams, pamBillingSupportEnabled]) => {
        this.pamBillingSupportEnabled = pamBillingSupportEnabled;
        this.applyParams(parseTrialInitiationParams(queryParams));
      });

    this.orgInfoFormGroup.controls.name.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.orgInfoFormGroup.controls.name.markAsTouched());
  }

  private applyParams(params: TrialInitiationParams): void {
    if (params.email) {
      this.email = params.email;
      this.orgInfoFormGroup.controls.billingEmail.setValue(params.email);
    }

    if (params.emailVerified) {
      this.toastService.showToast({
        title: "",
        message: this.i18nService.t("emailVerifiedV2"),
        variant: "success",
      });
    }

    this.emailVerificationToken = params.emailVerificationToken;
    this.salesAssistedToken = params.salesAssistedToken;
    this.product = params.product;

    this.includesPrivilegedControls = this.shouldIncludePrivilegedControls(params);
    this.trialLength = params.trialLength;
    this.paymentOptional = params.paymentOptional;

    // Stepper visibility is a view decision derived from the product and tier; the tier and its
    // label are only relevant while the stepper is shown.
    this.useTrialStepper = this.showsTrialStepper(this.product, params.productTier);
    if (this.useTrialStepper && params.productTier !== undefined) {
      this.productTier = params.productTier;
      this.orgLabel = this.planTypeDisplay;
    }

    // Coming from an email for sponsoring a families organization: after logging in,
    // redirect them to set up the families sponsorship.
    this.setupFamilySponsorship(params.sponsorshipToken);

    this.initializing = false;
  }

  /** Whether to show the multi-step trial flow for the given product and tier. */
  private showsTrialStepper(
    product: ProductType,
    productTier: ProductTierType | undefined,
  ): boolean {
    return (
      productTier !== undefined &&
      (this.stepperProductTiers.includes(productTier) || product === ProductType.SecretsManager)
    );
  }

  /** Handle manual stepper change */
  verticalStepChange(event: StepperSelectionEvent) {
    if (event.selectedIndex === 1 && this.orgInfoFormGroup.controls.name.value === "") {
      this.orgInfoSubLabel = this.planInfoLabel;
    } else if (event.previouslySelectedIndex === 1) {
      this.orgInfoSubLabel = this.orgInfoFormGroup.controls.name.value!;
    }
  }

  async orgNameEntrySubmit(): Promise<void> {
    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    /** Skip payment if paymentOptional from URL and trialLength > 0 */
    if (this.paymentOptional && this.trialLength > 0) {
      await this.createOrganizationOnTrial(activeUserId);
    } else {
      await this.conditionallyCreateOrganization(activeUserId);
    }
  }

  /** Update local details from organization created event */
  createdOrganization(event: OrganizationCreatedEvent) {
    this.orgId = event.organizationId;
    this.billingSubLabel = event.planDescription;
    this.verticalStepper.next();
  }

  /** create an organization on trial without payment method */
  async createOrganizationOnTrial(activeUserId: UserId) {
    this.loading = true;
    const trialInitiationPath: InitiationPath = this.salesAssistedToken
      ? InitiationPath.SalesAssistedTrialFromAdminPortal
      : this.product === ProductType.SecretsManager
        ? InitiationPath.SecretsManagerTrialFromMarketingWebsite
        : InitiationPath.PasswordManagerTrialFromMarketingWebsite;
    let plan: PlanInformation = {
      type: await this.getPlanType(),
      passwordManagerSeats: 1,
    };

    if (this.product === ProductType.SecretsManager) {
      plan = {
        ...plan,
        subscribeToSecretsManager: true,
        isFromSecretsManagerTrial: true,
        secretsManagerSeats: 1,
      };
    }

    if (this.includesPrivilegedControls) {
      plan = {
        ...plan,
        subscribeToPrivilegedControls: true,
        pamSeats: 1,
      };
    }

    const organization: OrganizationInformation = {
      name: this.orgInfoFormGroup.value.name == null ? "" : this.orgInfoFormGroup.value.name,
      billingEmail:
        this.orgInfoFormGroup.value.billingEmail == null
          ? ""
          : this.orgInfoFormGroup.value.billingEmail,
      initiationPath: trialInitiationPath,
    };

    const response = await this.organizationBillingService.purchaseSubscriptionNoPaymentMethod(
      {
        organization,
        plan,
      },
      activeUserId,
      this.trialLength,
    );

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

  get showBillingStep(): boolean {
    return !this.paymentOptional && !this.isSecretsManagerFree;
  }

  /** Create an organization unless the trial is for secrets manager */
  async conditionallyCreateOrganization(activeUserId: UserId): Promise<void> {
    if (!this.isSecretsManagerFree) {
      this.verticalStepper.next();
      return;
    }

    const response = await this.organizationBillingService.startFree(
      {
        organization: {
          name: this.orgInfoFormGroup.value.name == null ? "" : this.orgInfoFormGroup.value.name,
          billingEmail:
            this.orgInfoFormGroup.value.billingEmail == null
              ? ""
              : this.orgInfoFormGroup.value.billingEmail,
          initiationPath: InitiationPath.PasswordManagerTrialFromMarketingWebsite,
        },
        plan: {
          type: 0,
          subscribeToSecretsManager: true,
          isFromSecretsManagerTrial: true,
        },
      },
      activeUserId,
    );

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

  /**
   * Auth team finding:
   * TODO PM-44167: This does not redirect the user. `setPreviousUrl` only sets an in-memory value that
   * nothing uses as a post-login redirect, and the next navigation overwrites it. The URL is also
   * wrong: the families-for-enterprise setup page reads a `token` query param, not `plan`.
   * Further, no server code sends a `sponsorshipToken` query param to this page: the sponsorship offer
   * email links to `/accept-families-for-enterprise?token=…` instead. Unsure if an external link
   * (e.g. the marketing site) could still send it.
   * Confirm with the Billing team whether this redirect is still needed:
   * 1. If yes: right before `logIn()`, persist the URL (with `token`) with
   *    `DeepLinkRedirectService.persistPostLoginRedirectUrl`, so `deepLinkGuard` replays it.
   * 2. If no: remove this method and the `sponsorshipToken` query param handling.
   */
  private setupFamilySponsorship(sponsorshipToken: string | undefined) {
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

  async finishRegistration(passwordInputResult: PasswordInputResult) {
    this.submitting = true;
    return this.registrationFinishService
      .finishRegistration(
        this.email,
        passwordInputResult,
        this.emailVerificationToken,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        this.salesAssistedToken,
      )
      .catch((e: unknown): null => {
        this.validationService.showError(e);
        this.submitting = false;
        return null;
      });
  }

  private shouldIncludePrivilegedControls(params: TrialInitiationParams): boolean {
    // Privileged Controls is only available for Enterprise Password Manager trials

    return (
      this.pamBillingSupportEnabled &&
      this.product === ProductType.PasswordManager &&
      params.productTier === ProductTierType.Enterprise &&
      params.privilegedControlsRequested
    );
  }

  get trial(): Trial {
    const product =
      this.product === ProductType.PasswordManager ? "passwordManager" : "secretsManager";

    const tier =
      this.productTier === ProductTierType.Families
        ? "families"
        : this.productTier === ProductTierType.Teams
          ? "teams"
          : "enterprise";

    return {
      organization: {
        name: this.orgInfoFormGroup.value.name!,
        email: this.orgInfoFormGroup.value.billingEmail!,
      },
      product,
      tier,
      length: this.trialLength,
      privilegedControls: this.includesPrivilegedControls ? { seats: 1 } : undefined,
    };
  }
}
