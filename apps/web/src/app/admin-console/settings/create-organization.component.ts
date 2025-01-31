// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subject } from "rxjs";
import { first, takeUntil } from "rxjs/operators";

import { PlanType, ProductTierType, ProductType } from "@bitwarden/common/billing/enums";

import { OrganizationPlansComponent } from "../../billing";
import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

@Component({
  templateUrl: "create-organization.component.html",
  standalone: true,
  imports: [SharedModule, OrganizationPlansComponent, HeaderModule],
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class CreateOrganizationComponent implements OnInit, OnDestroy {
  @ViewChild(OrganizationPlansComponent, { static: true })
  orgPlansComponent: OrganizationPlansComponent;
  private destroy$ = new Subject<void>();
  secretsManager = false;
  plan: PlanType = PlanType.Free;
  productTier: ProductTierType = ProductTierType.Free;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
