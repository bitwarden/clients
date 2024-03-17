import { Component, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs/operators";

import { PlanType } from "@bitwarden/common/billing/enums";
import { ProductType } from "@bitwarden/common/enums";

import { OrganizationPlansComponent } from "../../billing";
import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

@Component({
  templateUrl: "create-organization.component.html",
  standalone: true,
  imports: [SharedModule, OrganizationPlansComponent, HeaderModule],
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class CreateOrganizationComponent implements OnInit {
  @ViewChild(OrganizationPlansComponent, { static: true })
  orgPlansComponent: OrganizationPlansComponent;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.plan === "families") {
        this.orgPlansComponent.plan = PlanType.FamiliesAnnually;
        this.orgPlansComponent.product = ProductType.Families;
      } else if (qParams.plan === "teams") {
        this.orgPlansComponent.plan = PlanType.TeamsAnnually;
        this.orgPlansComponent.product = ProductType.Teams;
      } else if (qParams.plan === "teamsStarter") {
        this.orgPlansComponent.plan = PlanType.TeamsStarter;
        this.orgPlansComponent.product = ProductType.TeamsStarter;
      } else if (qParams.plan === "enterprise") {
        this.orgPlansComponent.plan = PlanType.EnterpriseAnnually;
        this.orgPlansComponent.product = ProductType.Enterprise;
      }
    });
  }
}
