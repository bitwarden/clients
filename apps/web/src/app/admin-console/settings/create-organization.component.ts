// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subject, takeUntil } from "rxjs";
import { first } from "rxjs/operators";

import { PlanType, ProductTierType, ProductType } from "@bitwarden/common/billing/enums";

import { OrganizationPlansComponent } from "../../billing";
import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "create-organization.component.html",
  imports: [SharedModule, OrganizationPlansComponent, HeaderModule],
})
export class CreateOrganizationComponent implements OnInit, OnDestroy {
  protected secretsManager = false;
  protected plan: PlanType = PlanType.Free;
  protected productTier: ProductTierType = ProductTierType.Free;

  constructor(private route: ActivatedRoute) {}

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
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
