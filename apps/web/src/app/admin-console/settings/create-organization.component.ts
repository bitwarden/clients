import { Component, OnDestroy, OnInit } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { Subject, takeUntil } from "rxjs";
import { first } from "rxjs/operators";

import {
  InitiationPath,
  PlanType,
  ProductTierType,
  ProductType,
} from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { BreadcrumbsModule } from "@bitwarden/components";
import { Vfo1I18nPipe } from "@bitwarden/vault";

import { OrganizationPlansComponent } from "../../billing";
import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "create-organization.component.html",
  imports: [
    SharedModule,
    OrganizationPlansComponent,
    HeaderModule,
    BreadcrumbsModule,
    Vfo1I18nPipe,
  ],
})
export class CreateOrganizationComponent implements OnInit, OnDestroy {
  protected secretsManager = false;
  protected plan: PlanType = PlanType.Free;
  protected productTier: ProductTierType = ProductTierType.Free;
  protected trialLength?: number;
  protected initiationPath: InitiationPath = InitiationPath.NewOrganizationCreationInProduct;

  protected readonly showBreadcrumbs = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  constructor(
    private route: ActivatedRoute,
    private configService: ConfigService,
  ) {}

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.route.queryParams.pipe(first(), takeUntil(this.destroy$)).subscribe((qParams) => {
      if (qParams.plan === "families" || qParams.productTier == ProductTierType.Families) {
        this.plan = PlanType.FamiliesAnnually;
        this.productTier = ProductTierType.Families;
      } else if (qParams.plan === "teams" || qParams.productTier == ProductTierType.Teams) {
        this.plan = PlanType.TeamsAnnually;
        this.productTier = ProductTierType.Teams;
      } else if (
        qParams.plan === "teamsStarter" ||
        qParams.productTier == ProductTierType.TeamsStarter
      ) {
        this.plan = PlanType.TeamsStarter;
        this.productTier = ProductTierType.TeamsStarter;
      } else if (
        qParams.plan === "enterprise" ||
        qParams.productTier == ProductTierType.Enterprise
      ) {
        this.plan = PlanType.EnterpriseAnnually;
        this.productTier = ProductTierType.Enterprise;
      }

      this.secretsManager = qParams.product == ProductType.SecretsManager;

      this.trialLength = qParams.trialLength ? parseInt(qParams.trialLength) : undefined;

      // A `product` query param is only present when the user arrives from the marketing
      // deep link (in-product navigations to this page are param-less), so treat its presence
      // as a marketing-initiated trial. The server maps this onto Stripe's trialInitiationPath.
      if (qParams.product != null) {
        this.initiationPath = this.secretsManager
          ? InitiationPath.SecretsManagerTrialFromMarketingWebsite
          : InitiationPath.PasswordManagerTrialFromMarketingWebsite;
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
