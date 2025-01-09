// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, Subject, switchMap, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ToastService } from "@bitwarden/components";

import { ProjectServiceAccountsAccessPoliciesView } from "../../models/view/access-policies/project-service-accounts-access-policies.view";
import {
  ApItemValueType,
  convertToProjectServiceAccountsAccessPoliciesView,
} from "../../shared/access-policies/access-policy-selector/models/ap-item-value.type";
import {
  ApItemViewType,
  convertPotentialGranteesToApItemViewType,
  convertProjectServiceAccountsViewToApItemViews,
} from "../../shared/access-policies/access-policy-selector/models/ap-item-view.type";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";

@Component({
  selector: "sm-project-service-accounts",
  templateUrl: "./project-service-accounts.component.html",
})
export class ProjectServiceAccountsComponent implements OnInit, OnDestroy {
  private currentAccessPolicies: ApItemViewType[];
  private destroy$ = new Subject<void>();
  private organizationId: string;
  private projectId: string;

  private currentAccessPolicies$ = combineLatest([this.route.params]).pipe(
    switchMap(([params]) =>
      this.accessPolicyService
        .getProjectServiceAccountsAccessPolicies(params.organizationId, params.projectId)
        .then((policies) => {
          return convertProjectServiceAccountsViewToApItemViews(policies);
        }),
    ),
  );

  private potentialGrantees$ = combineLatest([this.route.params]).pipe(
    switchMap(([params]) =>
      this.accessPolicyService
        .getServiceAccountsPotentialGrantees(params.organizationId)
        .then((grantees) => {
          return convertPotentialGranteesToApItemViewType(grantees);
        }),
    ),
  );

  protected formGroup = new FormGroup({
    accessPolicies: new FormControl([] as ApItemValueType[]),
  });

  protected loading = true;
  protected potentialGrantees: ApItemViewType[];
  protected items: ApItemViewType[];

  constructor(
    private route: ActivatedRoute,
    private changeDetectorRef: ChangeDetectorRef,
    private validationService: ValidationService,
    private accessPolicyService: AccessPolicyService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.organizationId = params.organizationId;
      this.projectId = params.projectId;
    });

    combineLatest([this.potentialGrantees$, this.currentAccessPolicies$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([potentialGrantees, currentAccessPolicies]) => {
        this.potentialGrantees = potentialGrantees;
        this.items = this.getItems(potentialGrantees, currentAccessPolicies);
        this.setSelected(currentAccessPolicies);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit = async () => {
    if (this.isFormInvalid()) {
      return;
    }
    const formValues = this.formGroup.value.accessPolicies;
    this.formGroup.disable();

    try {
      const accessPoliciesView = await this.updateProjectServiceAccountsAccessPolicies(
        this.organizationId,
        this.projectId,
        formValues,
      );

      const updatedView = convertProjectServiceAccountsViewToApItemViews(accessPoliciesView);
      this.items = this.getItems(this.potentialGrantees, updatedView);
      this.setSelected(updatedView);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("projectAccessUpdated"),
      });
    } catch (e) {
      this.validationService.showError(e);
      this.setSelected(this.currentAccessPolicies);
    }
    this.formGroup.enable();
  };

  private setSelected(policiesToSelect: ApItemViewType[]) {
    this.loading = true;
    this.currentAccessPolicies = policiesToSelect;
    if (policiesToSelect != undefined) {
      // Must detect changes so that AccessSelector @Inputs() are aware of the latest
      // potentialGrantees, otherwise no selected values will be patched below
      this.changeDetectorRef.detectChanges();
      this.formGroup.patchValue({
        accessPolicies: policiesToSelect.map((m) => ({
          type: m.type,
          id: m.id,
          permission: m.permission,
        })),
      });
    }
    this.loading = false;
  }

  private isFormInvalid(): boolean {
    this.formGroup.markAllAsTouched();
    return this.formGroup.invalid;
  }

  private async updateProjectServiceAccountsAccessPolicies(
    organizationId: string,
    projectId: string,
    selectedPolicies: ApItemValueType[],
  ): Promise<ProjectServiceAccountsAccessPoliciesView> {
    const view = convertToProjectServiceAccountsAccessPoliciesView(selectedPolicies);
    return await this.accessPolicyService.putProjectServiceAccountsAccessPolicies(
      organizationId,
      projectId,
      view,
    );
  }

  private getItems(potentialGrantees: ApItemViewType[], currentAccessPolicies: ApItemViewType[]) {
    // If the user doesn't have access to the service account, they won't be in the potentialGrantees list.
    // Add them to the potentialGrantees list if they are selected.
    const items = [...potentialGrantees];
    for (const policy of currentAccessPolicies) {
      const exists = potentialGrantees.some((grantee) => grantee.id === policy.id);
      if (!exists) {
        items.push(policy);
      }
    }
    return items;
  }
}
