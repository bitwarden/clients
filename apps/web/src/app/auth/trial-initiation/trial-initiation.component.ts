import { StepperSelectionEvent } from "@angular/cdk/stepper";
import { TitleCasePipe } from "@angular/common";
import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { UntypedFormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import {
  OrganizationInformation,
  PlanInformation,
  OrganizationBillingServiceAbstraction as OrganizationBillingService,
} from "@bitwarden/common/billing/abstractions/organization-billing.service";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ReferenceEventRequest } from "@bitwarden/common/models/request/reference-event.request";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  OrganizationCreatedEvent,
  SubscriptionProduct,
  TrialOrganizationType,
} from "../../billing/accounts/trial-initiation/trial-billing-step.component";
import { AcceptOrganizationInviteService } from "../organization-invite/accept-organization.service";
import { OrganizationInvite } from "../organization-invite/organization-invite";

import { RouterService } from "./../../core/router.service";
import { VerticalStepperComponent } from "./vertical-stepper/vertical-stepper.component";

export enum ValidOrgParams {
  families = "families",
  enterprise = "enterprise",
  teams = "teams",
  teamsStarter = "teamsStarter",
  individual = "individual",
  premium = "premium",
  free = "free",
}

enum ValidLayoutParams {
  default = "default",
  teams = "teams",
  teams1 = "teams1",
  teams2 = "teams2",
  teams3 = "teams3",
  enterprise = "enterprise",
  enterprise1 = "enterprise1",
  enterprise2 = "enterprise2",
  cnetcmpgnent = "cnetcmpgnent",
  cnetcmpgnind = "cnetcmpgnind",
  cnetcmpgnteams = "cnetcmpgnteams",
  abmenterprise = "abmenterprise",
  abmteams = "abmteams",
  secretsManager = "secretsManager",
}

@Component({
  selector: "app-trial",
  templateUrl: "trial-initiation.component.html",
})
export class TrialInitiationComponent implements OnInit, OnDestroy {
  email = "";
  fromOrgInvite = false;
  org = "";
  orgInfoSubLabel = "";
  orgId = "";
  orgLabel = "";
  billingSubLabel = "";
  layout = "default";
  plan: PlanType;
  productTier: ProductTierType;
  accountCreateOnly = true;
  useTrialStepper = false;
  loading = false;
  policies: Policy[];
  enforcedPolicyOptions: MasterPasswordPolicyOptions;
  trialFlowOrgs: string[] = [
    ValidOrgParams.teams,
    ValidOrgParams.teamsStarter,
    ValidOrgParams.enterprise,
    ValidOrgParams.families,
  ];
  routeFlowOrgs: string[] = [
    ValidOrgParams.free,
    ValidOrgParams.premium,
    ValidOrgParams.individual,
  ];
  layouts = ValidLayoutParams;
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
  protected enableTrialPayment$ = this.configService.getFeatureFlag$(
    FeatureFlag.TrialPaymentOptional,
  );

  constructor(
    private route: ActivatedRoute,
    protected router: Router,
    private formBuilder: UntypedFormBuilder,
    private titleCasePipe: TitleCasePipe,
    private logService: LogService,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyService: PolicyService,
    private i18nService: I18nService,
    private routerService: RouterService,
    private acceptOrgInviteService: AcceptOrganizationInviteService,
    private organizationBillingService: OrganizationBillingService,
    private configService: ConfigService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((qParams) => {
      this.referenceData = new ReferenceEventRequest();
      if (qParams.email != null && qParams.email.indexOf("@") > -1) {
        this.email = qParams.email;
        this.fromOrgInvite = qParams.fromOrgInvite === "true";
      }

      this.referenceDataId = qParams.reference;

      if (Object.values(ValidLayoutParams).includes(qParams.layout)) {
        this.layout = qParams.layout;
        this.accountCreateOnly = false;
      }

      if (this.trialFlowOrgs.includes(qParams.org)) {
        this.org = qParams.org;
        this.orgLabel = this.titleCasePipe.transform(this.orgDisplayName);
        this.useTrialStepper = true;
        this.referenceData.flow = qParams.org;

        if (this.org === ValidOrgParams.families) {
          this.plan = PlanType.FamiliesAnnually;
          this.productTier = ProductTierType.Families;
        } else if (this.org === ValidOrgParams.teamsStarter) {
          this.plan = PlanType.TeamsStarter;
          this.productTier = ProductTierType.TeamsStarter;
        } else if (this.org === ValidOrgParams.teams) {
          this.plan = PlanType.TeamsAnnually;
          this.productTier = ProductTierType.Teams;
        } else if (this.org === ValidOrgParams.enterprise) {
          this.plan = PlanType.EnterpriseAnnually;
          this.productTier = ProductTierType.Enterprise;
        }
      } else if (this.routeFlowOrgs.includes(qParams.org)) {
        this.referenceData.flow = qParams.org;
        const route = this.router.createUrlTree(["create-organization"], {
          queryParams: { plan: qParams.org },
        });
        this.routerService.setPreviousUrl(route.toString());
      }

      // Are they coming from an email for sponsoring a families organization
      // After logging in redirect them to setup the families sponsorship
      this.setupFamilySponsorship(qParams.sponsorshipToken);

      this.referenceData.initiationPath = this.accountCreateOnly
        ? "Registration form"
        : "Password Manager trial from marketing website";
    });

    // If there's a deep linked org invite, use it to get the password policies
    const orgInvite = await this.acceptOrgInviteService.getOrganizationInvite();
    if (orgInvite != null) {
      await this.initPasswordPolicies(orgInvite);
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
      this.orgInfoSubLabel =
        "Enter your " +
        this.titleCasePipe.transform(this.orgDisplayName) +
        " organization information";
    } else if (event.previouslySelectedIndex === 1) {
      this.orgInfoSubLabel = this.orgInfoFormGroup.controls.name.value;
    }

    //set billing sub label
    if (event.selectedIndex === 2) {
      this.billingSubLabel = this.i18nService.t("billingTrialSubLabel");
    }
  }

  async createOrganizationOnTrial() {
    this.loading = true;
    const organization: OrganizationInformation = {
      name: this.orgInfoFormGroup.get("name").value,
      billingEmail: this.orgInfoFormGroup.get("email").value,
      initiationPath: "Password Manager trial from marketing website",
    };

    const plan: PlanInformation = {
      type: this.plan,
      passwordManagerSeats: 1,
    };

    const response = await this.organizationBillingService.purchaseSubscriptionNoPaymentMethod({
      organization,
      plan,
    });

    this.orgId = response?.id;
    this.billingSubLabel = `${this.i18nService.t("annual")} ($0/${this.i18nService.t("yr")})`;
    this.loading = false;
    this.verticalStepper.next();
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

  navigateToOrgVault() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["organizations", this.orgId, "vault"]);
  }

  navigateToOrgInvite() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["organizations", this.orgId, "members"]);
  }

  previousStep() {
    this.verticalStepper.previous();
  }

  get orgDisplayName() {
    if (this.org === "teamsStarter") {
      return "Teams Starter";
    }

    return this.org;
  }

  get freeTrialText() {
    const translationKey =
      this.layout === this.layouts.secretsManager
        ? "startYour7DayFreeTrialOfBitwardenSecretsManagerFor"
        : "startYour7DayFreeTrialOfBitwardenFor";

    return this.i18nService.t(translationKey, this.org);
  }

  get trialOrganizationType(): TrialOrganizationType {
    switch (this.productTier) {
      case ProductTierType.Free:
        return null;
      default:
        return this.productTier;
    }
  }

  private setupFamilySponsorship(sponsorshipToken: string) {
    if (sponsorshipToken != null) {
      const route = this.router.createUrlTree(["setup/families-for-enterprise"], {
        queryParams: { plan: sponsorshipToken },
      });
      this.routerService.setPreviousUrl(route.toString());
    }
  }

  private async initPasswordPolicies(invite: OrganizationInvite): Promise<void> {
    if (invite == null) {
      return;
    }

    try {
      this.policies = await this.policyApiService.getPoliciesByToken(
        invite.organizationId,
        invite.token,
        invite.email,
        invite.organizationUserId,
      );
    } catch (e) {
      this.logService.error(e);
    }

    if (this.policies != null) {
      this.policyService
        .masterPasswordPolicyOptions$(this.policies)
        .pipe(takeUntil(this.destroy$))
        .subscribe((enforcedPasswordPolicyOptions) => {
          this.enforcedPolicyOptions = enforcedPasswordPolicyOptions;
        });
    }
  }

  protected readonly SubscriptionProduct = SubscriptionProduct;
}
