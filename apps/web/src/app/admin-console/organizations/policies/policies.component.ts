// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, firstValueFrom, lastValueFrom, Observable, of } from "rxjs";
import { first, map } from "rxjs/operators";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { isUpsellingPoliciesEnabled } from "@bitwarden/common/billing/utils/organization-upselling-utils";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService } from "@bitwarden/components";
import { CollectionDialogTabType } from "@bitwarden/web-vault/app/vault/components/collection-dialog";
import { All } from "@bitwarden/web-vault/app/vault/individual-vault/vault-filter/shared/models/routed-vault-filter.model";

import { PolicyListService } from "../../core/policy-list.service";
import { BasePolicy } from "../policies";

import { PolicyEditComponent, PolicyEditDialogResult } from "./policy-edit.component";
import {
  ChangePlanDialogResultType,
  openChangePlanDialog,
} from "@bitwarden/web-vault/app/billing/organizations/change-plan-dialog.component";

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

  private isBreadcrumbEventLogsEnabled$ = this.configService.getFeatureFlag$(
    FeatureFlag.PM12276_BreadcrumbEventLogs,
  );

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyListService: PolicyListService,
    private dialogService: DialogService,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      this.organizationId = params.organizationId;
      this.organization = await firstValueFrom(
        this.organizationService.getOrganizationById$(this.organizationId),
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

  protected readonly CollectionDialogTabType = CollectionDialogTabType;
  protected readonly All = All;

  protected showUpgradeBreadcrumb$(): Observable<boolean> {
    const isUpsellingEnabled = isUpsellingPoliciesEnabled(this.organization);

    return combineLatest([this.isBreadcrumbEventLogsEnabled$, of(isUpsellingEnabled)]).pipe(
      map(([isBreadcrumbEventLogsEnabled, isUpsellingEnabled]) => {
        return isUpsellingEnabled && isBreadcrumbEventLogsEnabled;
      }),
    );
  }

  protected async changePlan() {
    const reference = openChangePlanDialog(this.dialogService, {
      data: {
        organizationId: this.organizationId,
        subscription: null,
        productTierType: this.organization.productTierType,
      },
    });

    const result = await lastValueFrom(reference.closed);

    if (result === ChangePlanDialogResultType.Closed) {
      return;
    }

    await this.load();
  }
}
