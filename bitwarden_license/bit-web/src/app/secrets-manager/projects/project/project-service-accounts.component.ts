import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { map, Observable, startWith, Subject, switchMap, takeUntil } from "rxjs";

import { ValidationService } from "@bitwarden/common/abstractions/validation.service";
import { Guid } from "@bitwarden/common/types/guid";
import { SelectItemView } from "@bitwarden/components";

import {
  ProjectAccessPoliciesView,
  ServiceAccountProjectAccessPolicyView,
} from "../../models/view/access-policy.view";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";
import {
  AccessSelectorComponent,
  AccessSelectorRowView,
} from "../../shared/access-policies/access-selector.component";

@Component({
  selector: "sm-project-service-accounts",
  templateUrl: "./project-service-accounts.component.html",
})
export class ProjectServiceAccountsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private organizationId: Guid;
  private projectId: Guid;

  protected rows$: Observable<AccessSelectorRowView[]> =
    this.accessPolicyService.projectAccessPolicyChanges$.pipe(
      startWith(null),
      switchMap(() =>
        this.accessPolicyService.getProjectAccessPolicies(this.organizationId, this.projectId)
      ),
      map((policies) =>
        policies.serviceAccountAccessPolicies.map((policy) => ({
          type: "serviceAccount",
          name: policy.serviceAccountName,
          id: policy.serviceAccountId,
          accessPolicyId: policy.id,
          read: policy.read,
          write: policy.write,
          icon: AccessSelectorComponent.serviceAccountIcon,
          static: true,
        }))
      )
    );

  protected handleCreateAccessPolicies(selected: SelectItemView[]) {
    const projectAccessPoliciesView = new ProjectAccessPoliciesView();
    projectAccessPoliciesView.serviceAccountAccessPolicies = selected
      .filter(
        (selection) => AccessSelectorComponent.getAccessItemType(selection) === "serviceAccount"
      )
      .map((filtered) => {
        const view = new ServiceAccountProjectAccessPolicyView();
        view.grantedProjectId = this.projectId;
        view.serviceAccountId = filtered.id as Guid;
        view.read = true;
        view.write = false;
        return view;
      });

    return this.accessPolicyService.createProjectAccessPolicies(
      this.organizationId,
      this.projectId,
      projectAccessPoliciesView
    );
  }

  protected async handleDeleteAccessPolicy(policy: AccessSelectorRowView) {
    try {
      await this.accessPolicyService.deleteAccessPolicy(policy.accessPolicyId);
    } catch (e) {
      this.validationService.showError(e);
    }
  }

  constructor(
    private route: ActivatedRoute,
    private validationService: ValidationService,
    private accessPolicyService: AccessPolicyService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.organizationId = params.organizationId;
      this.projectId = params.projectId;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
