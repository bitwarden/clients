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

import { ServiceAccountGrantedPoliciesView } from "../../models/view/access-policies/service-account-granted-policies.view";
import {
  ApItemValueType,
  convertToServiceAccountGrantedPoliciesView,
} from "../../shared/access-policies/access-policy-selector/models/ap-item-value.type";
import {
  ApItemViewType,
  convertPotentialGranteesToApItemViewType,
  convertGrantedPoliciesToAccessPolicyItemViews,
} from "../../shared/access-policies/access-policy-selector/models/ap-item-view.type";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";

@Component({
  selector: "sm-service-account-projects",
  templateUrl: "./service-account-projects.component.html",
  standalone: false,
})
export class ServiceAccountProjectsComponent implements OnInit, OnDestroy {
  private currentAccessPolicies: ApItemViewType[];
  private destroy$ = new Subject<void>();
  private organizationId: string;
  private serviceAccountId: string;

  private currentAccessPolicies$ = combineLatest([this.route.params]).pipe(
    switchMap(([params]) =>
      this.accessPolicyService
        .getServiceAccountGrantedPolicies(params.organizationId, params.serviceAccountId)
        .then((policies) => {
          return convertGrantedPoliciesToAccessPolicyItemViews(policies);
        }),
    ),
  );

  private potentialGrantees$ = combineLatest([this.route.params]).pipe(
    switchMap(([params]) =>
      this.accessPolicyService
        .getProjectsPotentialGrantees(params.organizationId)
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
      this.serviceAccountId = params.serviceAccountId;
    });

    combineLatest([this.potentialGrantees$, this.currentAccessPolicies$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([potentialGrantees, currentAccessPolicies]) => {
        this.potentialGrantees = this.getPotentialGrantees(
          potentialGrantees,
          currentAccessPolicies,
        );
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
    const formValues = this.getFormValues();
    this.formGroup.disable();

    try {
      const grantedViews = await this.updateServiceAccountGrantedPolicies(
        this.organizationId,
        this.serviceAccountId,
        formValues,
      );

      this.currentAccessPolicies = convertGrantedPoliciesToAccessPolicyItemViews(grantedViews);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("serviceAccountAccessUpdated"),
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
          readOnly: m.readOnly,
        })),
      });
    }
    this.loading = false;
  }

  private isFormInvalid(): boolean {
    this.formGroup.markAllAsTouched();
    return this.formGroup.invalid;
  }

  private async updateServiceAccountGrantedPolicies(
    organizationId: string,
    serviceAccountId: string,
    selectedPolicies: ApItemValueType[],
  ): Promise<ServiceAccountGrantedPoliciesView> {
    const grantedViews = convertToServiceAccountGrantedPoliciesView(selectedPolicies);
    return await this.accessPolicyService.putServiceAccountGrantedPolicies(
      organizationId,
      serviceAccountId,
      grantedViews,
    );
  }

  private getPotentialGrantees(
    potentialGrantees: ApItemViewType[],
    currentAccessPolicies: ApItemViewType[],
  ) {
    // If the user doesn't have access to the project, they won't be in the potentialGrantees list.
    // Add them to the potentialGrantees list so they can be selected as read-only.
    for (const policy of currentAccessPolicies) {
      const exists = potentialGrantees.some((grantee) => grantee.id === policy.id);
      if (!exists) {
        potentialGrantees.push(policy);
      }
    }
    return potentialGrantees;
  }

  private getFormValues(): ApItemValueType[] {
    // The read-only disabled form values are not included in the formGroup value.
    // Manually add them to the returned result to ensure they are included in the form submission.
    let formValues = this.formGroup.value.accessPolicies;
    formValues = formValues.concat(
      this.currentAccessPolicies
        .filter((m) => m.readOnly)
        .map((m) => ({
          id: m.id,
          type: m.type,
          permission: m.permission,
        })),
    );
    return formValues;
  }
}
