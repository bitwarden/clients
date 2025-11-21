import { ChangeDetectionStrategy, Component, DestroyRef, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, Observable, of, switchMap, first, map, tap, BehaviorSubject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { getById } from "@bitwarden/common/platform/misc";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { safeProvider } from "@bitwarden/ui-common";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";

import { BasePolicyEditDefinition, PolicyDialogComponent } from "./base-policy-edit.component";
import { PolicyEditDialogComponent } from "./policy-edit-dialog.component";
import { PolicyListService } from "./policy-list.service";
import { POLICY_EDIT_REGISTER } from "./policy-register-token";

@Component({
  templateUrl: "policies.component.html",
  imports: [SharedModule, HeaderModule],
  providers: [
    safeProvider({
      provide: PolicyListService,
      deps: [POLICY_EDIT_REGISTER],
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoliciesComponent {
  private readonly refreshPolicies$: BehaviorSubject<undefined> = new BehaviorSubject(undefined);
  protected readonly loading = signal(false);

  private userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  protected organizationId$: Observable<OrganizationId> = this.route.params.pipe(
    map((params) => params.organizationId),
  );

  protected organization$: Observable<Organization> = combineLatest([
    this.userId$,
    this.organizationId$,
  ]).pipe(
    switchMap(([userId, orgId]) =>
      this.organizationService.organizations$(userId).pipe(
        getById(orgId),
        map((org) => {
          if (org == null) {
            throw new Error("No organization found for provided userId");
          }
          return org;
        }),
      ),
    ),
  );

  protected policies$: Observable<readonly BasePolicyEditDefinition[]> = of(
    this.policyListService.getPolicies(),
  );

  private orgPolicies$: Observable<PolicyResponse[]> = combineLatest([
    this.organizationId$,
    this.refreshPolicies$,
  ]).pipe(
    switchMap(([organizationId]) => this.policyApiService.getPolicies(organizationId)),
    map((response) => (response.data != null && response.data.length > 0 ? response.data : [])),
  );

  protected policiesEnabledMap$: Observable<Map<PolicyType, boolean>> = this.orgPolicies$.pipe(
    map((orgPolicies) => {
      const policiesEnabledMap: Map<PolicyType, boolean> = new Map<PolicyType, boolean>();
      orgPolicies.forEach((op) => {
        policiesEnabledMap.set(op.type, op.enabled);
      });
      return policiesEnabledMap;
    }),
  );

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyListService: PolicyListService,
    private dialogService: DialogService,
    private policyService: PolicyService,
    protected configService: ConfigService,
    private destroyRef: DestroyRef,
  ) {
    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) => this.policyService.policies$(userId)),
        tap(() => this.refreshPolicies$.next(undefined)),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.handleLaunchEvent();
  }

  // Handle policies component launch from Event message
  private handleLaunchEvent() {
    combineLatest([
      this.route.queryParams.pipe(first()),
      this.policies$,
      this.organizationId$,
      this.orgPolicies$,
    ])
      .pipe(
        map(([qParams, policies, organizationId, orgPolicies]) => {
          if (qParams.policyId != null) {
            const policyIdFromEvents: string = qParams.policyId;
            for (const orgPolicy of orgPolicies) {
              if (orgPolicy.id === policyIdFromEvents) {
                for (let i = 0; i < policies.length; i++) {
                  if (policies[i].type === orgPolicy.type) {
                    this.edit(policies[i], organizationId);
                    break;
                  }
                }
                break;
              }
            }
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  edit(policy: BasePolicyEditDefinition, organizationId: OrganizationId) {
    const dialogComponent: PolicyDialogComponent =
      policy.editDialogComponent ?? PolicyEditDialogComponent;
    dialogComponent.open(this.dialogService, {
      data: {
        policy: policy,
        organizationId: organizationId,
      },
    });
  }
}
