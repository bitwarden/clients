// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, lastValueFrom } from "rxjs";
import { first, map } from "rxjs/operators";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DialogService } from "@bitwarden/components";

import { PolicyListService } from "../../core/policy-list.service";
import { BasePolicy } from "../policies";

import { PolicyEditComponent, PolicyEditDialogResult } from "./policy-edit.component";

@Component({
  selector: "app-org-policies",
  templateUrl: "policies.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class PoliciesComponent implements OnInit {
  @ViewChild("editTemplate", { read: ViewContainerRef, static: true })
  editModalRef: ViewContainerRef;

  loading = true;
  organizationId: string;
  policies: BasePolicy[];
  organization: Organization;

  private orgPolicies: PolicyResponse[];
  protected policiesEnabledMap: Map<PolicyType, boolean> = new Map<PolicyType, boolean>();

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyListService: PolicyListService,
    private dialogService: DialogService,
  ) {}

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      this.organizationId = params.organizationId;
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      this.organization = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.organizationId)),
      );
      this.policies = this.policyListService.getPolicies();

      await this.load();

      // Handle policies component launch from Event message
      /* eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe, rxjs/no-nested-subscribe */
      this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
        if (qParams.policyId != null) {
          const policyIdFromEvents: string = qParams.policyId;
          for (const orgPolicy of this.orgPolicies) {
            if (orgPolicy.id === policyIdFromEvents) {
              for (let i = 0; i < this.policies.length; i++) {
                if (this.policies[i].type === orgPolicy.type) {
                  // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
                  // eslint-disable-next-line @typescript-eslint/no-floating-promises
                  this.edit(this.policies[i]);
                  break;
                }
              }
              break;
            }
          }
        }
      });
    });
  }

  async load() {
    const response = await this.policyApiService.getPolicies(this.organizationId);
    this.orgPolicies = response.data != null && response.data.length > 0 ? response.data : [];
    this.orgPolicies.forEach((op) => {
      this.policiesEnabledMap.set(op.type, op.enabled);
    });

    this.loading = false;
  }

  async edit(policy: BasePolicy) {
    const dialogRef = PolicyEditComponent.open(this.dialogService, {
      data: {
        policy: policy,
        organizationId: this.organizationId,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);
    if (result === PolicyEditDialogResult.Saved) {
      await this.load();
    }
  }
}
