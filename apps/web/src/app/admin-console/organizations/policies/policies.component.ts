import { ChangeDetectionStrategy, Component, DestroyRef } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, defer, Observable, of, switchMap, first, map, shareReplay } from "rxjs";

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
import { PolicyListService, PolicySection } from "./policy-list.service";
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
  private userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  protected organizationId$: Observable<OrganizationId> = this.route.params.pipe(
    map((params) => params.organizationId),
  );

  private organization$: Observable<Organization> = combineLatest([
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

  private orgPolicies$: Observable<PolicyResponse[]> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.policyService.policies$(userId)),
    switchMap(() => this.organizationId$),
    switchMap((organizationId) => this.policyApiService.getPolicies(organizationId)),
    map((response) => (response.data != null && response.data.length > 0 ? response.data : [])),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected policiesEnabledMap$: Observable<Map<PolicyType, boolean>> = this.orgPolicies$.pipe(
    map((orgPolicies) => {
      const map = new Map<PolicyType, boolean>();
      orgPolicies.forEach((op) => map.set(op.type, op.enabled));
      return map;
    }),
  );

  protected policies$: Observable<readonly BasePolicyEditDefinition[]> = defer(() =>
    of(this.policyListService.getPolicies()),
  );

  protected policySections$: Observable<PolicySection[]> = this.organization$.pipe(
    switchMap((organization) =>
      combineLatest(
        this.policyListService.sections.map((section) => {
          const displayChecks =
            section.policies.length > 0
              ? combineLatest(
                  section.policies.map((p) =>
                    p
                      .display$(organization, this.configService)
                      .pipe(map((visible) => (visible ? p : null))),
                  ),
                )
              : of([] as (BasePolicyEditDefinition | null)[]);

          return displayChecks.pipe(
            map((results) => ({
              category: section.category,
              labelKey: section.labelKey,
              policies: results.filter((p): p is BasePolicyEditDefinition => p !== null),
            })),
          );
        }),
      ).pipe(map((sections) => sections.filter((s) => s.policies.length > 0))),
    ),
  );

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyListService: PolicyListService,
    private dialogService: DialogService,
    private policyService: PolicyService,
    private configService: ConfigService,
    private destroyRef: DestroyRef,
  ) {
    this.handleLaunchEvent();
  }

  // Handle policies component launch from Event message
  private handleLaunchEvent() {
    combineLatest([this.route.queryParams.pipe(first()), this.organizationId$, this.orgPolicies$])
      .pipe(
        map(([qParams, organizationId, orgPolicies]) => {
          if (qParams.policyId != null) {
            const policyIdFromEvents: string = qParams.policyId;
            const policies = this.policyListService.getPolicies();
            for (const orgPolicy of orgPolicies) {
              if (orgPolicy.id === policyIdFromEvents) {
                for (const policy of policies) {
                  if (policy.type === orgPolicy.type) {
                    this.edit(policy, organizationId);
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
