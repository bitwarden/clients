// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { OrganizationPlansComponent } from "@bitwarden/web-vault/app/billing";

@Component({
  selector: "app-create-organization",
  templateUrl: "create-organization.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class CreateOrganizationComponent implements OnInit {
  @ViewChild(OrganizationPlansComponent, { static: true })
  orgPlansComponent: OrganizationPlansComponent;

  providerId: string;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.params.subscribe(async (params) => {
      this.providerId = params.providerId;
    });
  }
}
