// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatest,
  firstValueFrom,
  Observable,
  of,
  switchMap,
  first,
  map,
  withLatestFrom,
  tap,
} from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService } from "@bitwarden/components";
import { safeProvider } from "@bitwarden/ui-common";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";

import { BasePolicyEditDefinition, PolicyDialogComponent } from "./base-policy-edit.component";
import { PolicyEditDialogComponent } from "./policy-edit-dialog.component";
import { PolicyListService } from "./policy-list.service";
import { POLICY_EDIT_REGISTER } from "./policy-register-token";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "policies.component.html",
  imports: [SharedModule, HeaderModule],
  providers: [
    safeProvider({
      provide: PolicyListService,
      deps: [POLICY_EDIT_REGISTER],
    }),
  ],
})
export class PoliciesComponent implements OnInit {
  loading = true;
  organizationId: string;
  policies$: Observable<BasePolicyEditDefinition[]>;

  private orgPolicies: PolicyResponse[];
  protected policiesEnabledMap: Map<PolicyType, boolean> = new Map<PolicyType, boolean>();

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyListService: PolicyListService,
    private dialogService: DialogService,
    private policyService: PolicyService,
    protected configService: ConfigService,
  ) {
    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) => this.policyService.policies$(userId)),
        tap(async () => await this.load()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      this.organizationId = params.organizationId;
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );

      const organization$ = this.organizationService
        .organizations$(userId)
        .pipe(getOrganizationById(this.organizationId));

      this.policies$ = organization$.pipe(
        withLatestFrom(of(this.policyListService.getPolicies())),
        switchMap(([organization, policies]) => {
          return combineLatest(
            policies.map((policy) =>
              policy
                .display$(organization, this.configService)
                .pipe(map((shouldDisplay) => ({ policy, shouldDisplay }))),
            ),
          );
        }),
        map((results) =>
          results.filter((result) => result.shouldDisplay).map((result) => result.policy),
        ),
      );

      await this.load();

      // Handle policies component launch from Event message
      combineLatest([this.route.queryParams.pipe(first()), this.policies$])
        /* eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe, rxjs/no-nested-subscribe */
        .subscribe(async ([qParams, policies]) => {
          if (qParams.policyId != null) {
            const policyIdFromEvents: string = qParams.policyId;
            for (const orgPolicy of this.orgPolicies) {
              if (orgPolicy.id === policyIdFromEvents) {
                for (let i = 0; i < policies.length; i++) {
                  if (policies[i].type === orgPolicy.type) {
                    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    this.edit(policies[i]);
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

  async edit(policy: BasePolicyEditDefinition) {
    const dialogComponent: PolicyDialogComponent =
      policy.editDialogComponent ?? PolicyEditDialogComponent;
    dialogComponent.open(this.dialogService, {
      data: {
        policy: policy,
        organizationId: this.organizationId,
      },
    });
  }
}
