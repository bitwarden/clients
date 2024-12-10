// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, Subject, switchMap, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { ServiceAccountPeopleAccessPoliciesView } from "../../models/view/access-policies/service-account-people-access-policies.view";
import { AccessPolicySelectorService } from "../../shared/access-policies/access-policy-selector/access-policy-selector.service";
import {
  ApItemValueType,
  convertToPeopleAccessPoliciesView,
} from "../../shared/access-policies/access-policy-selector/models/ap-item-value.type";
import {
  ApItemViewType,
  convertPotentialGranteesToApItemViewType,
  convertToAccessPolicyItemViews,
} from "../../shared/access-policies/access-policy-selector/models/ap-item-view.type";
import { ApItemEnum } from "../../shared/access-policies/access-policy-selector/models/enums/ap-item.enum";
import { ApPermissionEnum } from "../../shared/access-policies/access-policy-selector/models/enums/ap-permission.enum";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";

@Component({
  selector: "sm-service-account-people",
  templateUrl: "./service-account-people.component.html",
})
export class ServiceAccountPeopleComponent implements OnInit, OnDestroy {
  private currentAccessPolicies: ApItemViewType[];
  private destroy$ = new Subject<void>();
  private organizationId: string;
  private serviceAccountId: string;

  private currentAccessPolicies$ = combineLatest([this.route.params]).pipe(
    switchMap(([params]) =>
      this.accessPolicyService
        .getServiceAccountPeopleAccessPolicies(params.serviceAccountId)
        .then((policies) => {
          return convertToAccessPolicyItemViews(policies);
        }),
    ),
  );

  private potentialGrantees$ = combineLatest([this.route.params]).pipe(
    switchMap(([params]) =>
      this.accessPolicyService
        .getPeoplePotentialGrantees(params.organizationId)
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
  protected staticPermission = ApPermissionEnum.CanReadWrite;

  constructor(
    private route: ActivatedRoute,
    private dialogService: DialogService,
    private changeDetectorRef: ChangeDetectorRef,
    private validationService: ValidationService,
    private accessPolicyService: AccessPolicyService,
    private router: Router,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private accessPolicySelectorService: AccessPolicySelectorService,
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
        this.potentialGrantees = potentialGrantees;
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

    const showAccessRemovalWarning =
      await this.accessPolicySelectorService.showAccessRemovalWarning(
        this.organizationId,
        formValues,
      );

    if (
      await this.handleAccessRemovalWarning(showAccessRemovalWarning, this.currentAccessPolicies)
    ) {
      this.formGroup.enable();
      return;
    }

    try {
      const peoplePoliciesViews = await this.updateServiceAccountPeopleAccessPolicies(
        this.serviceAccountId,
        formValues,
      );

      await this.handleAccessTokenAvailableWarning(
        showAccessRemovalWarning,
        this.currentAccessPolicies,
        formValues,
      );

      this.currentAccessPolicies = convertToAccessPolicyItemViews(peoplePoliciesViews);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("machineAccountAccessUpdated"),
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
          currentUser: m.type == ApItemEnum.User ? m.currentUser : null,
          currentUserInGroup: m.type == ApItemEnum.Group ? m.currentUserInGroup : null,
        })),
      });
    }
    this.loading = false;
  }

  private isFormInvalid(): boolean {
    this.formGroup.markAllAsTouched();
    return this.formGroup.invalid;
  }

  private async handleAccessRemovalWarning(
    showAccessRemovalWarning: boolean,
    currentAccessPolicies: ApItemViewType[],
  ): Promise<boolean> {
    if (showAccessRemovalWarning) {
      const confirmed = await this.showWarning();
      if (!confirmed) {
        this.setSelected(currentAccessPolicies);
        return true;
      }
    }
    return false;
  }

  private async updateServiceAccountPeopleAccessPolicies(
    serviceAccountId: string,
    selectedPolicies: ApItemValueType[],
  ): Promise<ServiceAccountPeopleAccessPoliciesView> {
    const serviceAccountPeopleView = convertToPeopleAccessPoliciesView(selectedPolicies);
    return await this.accessPolicyService.putServiceAccountPeopleAccessPolicies(
      serviceAccountId,
      serviceAccountPeopleView,
    );
  }

  private async handleAccessTokenAvailableWarning(
    showAccessRemovalWarning: boolean,
    currentAccessPolicies: ApItemViewType[],
    selectedPolicies: ApItemValueType[],
  ): Promise<void> {
    if (showAccessRemovalWarning) {
      await this.router.navigate(["sm", this.organizationId, "machine-accounts"]);
    } else if (
      this.accessPolicySelectorService.isAccessRemoval(currentAccessPolicies, selectedPolicies)
    ) {
      await this.showAccessTokenStillAvailableWarning();
    }
  }

  private async showWarning(): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "smAccessRemovalWarningMaTitle" },
      content: { key: "smAccessRemovalWarningMaMessage" },
      acceptButtonText: { key: "removeAccess" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    return confirmed;
  }

  private async showAccessTokenStillAvailableWarning(): Promise<void> {
    await this.dialogService.openSimpleDialog({
      title: { key: "saPeopleWarningTitle" },
      content: { key: "maPeopleWarningMessage" },
      type: "warning",
      acceptButtonText: { key: "close" },
      cancelButtonText: null,
    });
  }
}
