import { ChangeDetectionStrategy, Component, DestroyRef } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, Observable, of, switchMap, first, map, shareReplay } from "rxjs";

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
import { DialogService, ItemModule, SectionHeaderComponent } from "@bitwarden/components";
import { safeProvider } from "@bitwarden/ui-common";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";

import { BasePolicyEditDefinition, PolicyDialogComponent } from "./base-policy-edit.component";
import { PolicyEditDialogComponent } from "./policy-edit-dialog.component";
import { PolicyListService, PolicySection } from "./policy-list.service";
import { POLICY_EDIT_REGISTER } from "./policy-register-token";

@Component({
  templateUrl: "policies.component.html",
  imports: [SharedModule, HeaderModule, SectionHeaderComponent, ItemModule],
  providers: [
    safeProvider({
      provide: PolicyListService,
      deps: [POLICY_EDIT_REGISTER],
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoliciesComponent {
  private readonly userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  protected readonly organizationId$: Observable<OrganizationId> = this.route.params.pipe(
    map((params) => params.organizationId),
  );

  protected readonly organization$: Observable<Organization> = combineLatest([
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

  protected readonly policies$: Observable<readonly BasePolicyEditDefinition[]> = of(
    this.policyListService.getPolicies(),
  );

  private readonly orgPolicies$: Observable<PolicyResponse[]> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.policyService.policies$(userId)),
      switchMap(() => this.organizationId$),
      switchMap((organizationId) => this.policyApiService.getPolicies(organizationId)),
      map((response) => (response.data != null && response.data.length > 0 ? response.data : [])),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  protected readonly policiesEnabledMap$: Observable<Map<PolicyType, boolean>> =
    this.orgPolicies$.pipe(
      map((orgPolicies) => {
        const policiesEnabledMap: Map<PolicyType, boolean> = new Map<PolicyType, boolean>();
        orgPolicies.forEach((op) => {
          policiesEnabledMap.set(op.type, op.enabled);
        });
        return policiesEnabledMap;
      }),
    );

  protected readonly policySections$: Observable<PolicySection[]> = this.organization$.pipe(
    switchMap((organization) =>
      combineLatest(
        this.policyListService.sections.map((section) =>
          this.visiblePoliciesInSection$(section, organization),
        ),
      ),
    ),
    map((sections) => sections.filter((s) => s.policies.length > 0)),
  );

  private visiblePoliciesInSection$(
    section: PolicySection,
    organization: Organization,
  ): Observable<PolicySection> {
    if (section.policies.length === 0) {
      return of({ ...section, policies: [] });
    }

    return combineLatest(
      section.policies.map((p) =>
        p.display$(organization, this.configService).pipe(map((visible) => (visible ? p : null))),
      ),
    ).pipe(
      map((results) => ({
        ...section,
        policies: results.filter((p): p is BasePolicyEditDefinition => p !== null),
      })),
    );
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly organizationService: OrganizationService,
    private readonly accountService: AccountService,
    private readonly policyApiService: PolicyApiServiceAbstraction,
    private readonly policyListService: PolicyListService,
    private readonly dialogService: DialogService,
    private readonly policyService: PolicyService,
    protected readonly configService: ConfigService,
    private readonly destroyRef: DestroyRef,
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
