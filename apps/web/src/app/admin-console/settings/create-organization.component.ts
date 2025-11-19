// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs/operators";

import { PlanType, ProductTierType, ProductType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { OrganizationPlansComponent } from "../../billing";
import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "create-organization.component.html",
  imports: [SharedModule, OrganizationPlansComponent, HeaderModule],
})
export class CreateOrganizationComponent implements OnInit {
  protected secretsManager = false;
  protected plan: PlanType = PlanType.Free;
  protected productTier: ProductTierType = ProductTierType.Free;

  constructor(
    private route: ActivatedRoute,
    private configService: ConfigService,
  ) {}

  async ngOnInit(): Promise<void> {
    const milestone3FeatureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM26462_Milestone_3,
    );
    const familyPlan = milestone3FeatureEnabled
      ? PlanType.FamiliesAnnually
      : PlanType.FamiliesAnnually2025;

    this.route.queryParams.pipe(first(), takeUntilDestroyed()).subscribe((qParams) => {
      if (qParams.plan === "families" || qParams.productTier == ProductTierType.Families) {
        this.plan = familyPlan;
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
    });
  }
}
