// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs/operators";

import { PlanType, ProductTierType, ProductType } from "@bitwarden/common/billing/enums";

import { OrganizationPlansComponent } from "../../billing";
import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

@Component({
  templateUrl: "create-organization.component.html",
  imports: [SharedModule, OrganizationPlansComponent, HeaderModule],
})
export class CreateOrganizationComponent {
  protected secretsManager = false;
  protected plan: PlanType = PlanType.Free;
  protected productTier: ProductTierType = ProductTierType.Free;

  constructor(private route: ActivatedRoute) {
    this.route.queryParams.pipe(first(), takeUntilDestroyed()).subscribe((qParams) => {
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
    });
  }
}
