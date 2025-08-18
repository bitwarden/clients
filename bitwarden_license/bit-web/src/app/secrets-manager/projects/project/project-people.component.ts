// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, Subject, switchMap, takeUntil, catchError } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService, ToastService } from "@bitwarden/components";

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
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";

@Component({
  selector: "sm-project-people",
  templateUrl: "./project-people.component.html",
  standalone: false,
})
export class ProjectPeopleComponent implements OnInit, OnDestroy {
  private currentAccessPolicies: ApItemViewType[];
  private destroy$ = new Subject<void>();
  private organizationId: string;
  private projectId: string;

  private currentAccessPolicies$ = combineLatest([this.route.params]).pipe(
    switchMap(([params]) =>
      this.accessPolicyService.getProjectPeopleAccessPolicies(params.projectId).then((policies) => {
        return convertToAccessPolicyItemViews(policies);
      }),
    ),
    catchError(async () => {
      this.logService.info("Error fetching project people access policies.");
      await this.router.navigate(["/sm", this.organizationId, "projects"]);
      return undefined;
    }),
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
    private logService: LogService,
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
        this.setSelected(currentAccessPolicies);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }
    const formValues = this.formGroup.value.accessPolicies;
    this.formGroup.disable();

    const showAccessRemovalWarning =
      await this.accessPolicySelectorService.showAccessRemovalWarning(
        this.organizationId,
        formValues,
      );

    if (showAccessRemovalWarning) {
      const confirmed = await this.showWarning();
      if (!confirmed) {
        this.setSelected(this.currentAccessPolicies);
        this.formGroup.enable();
        return;
      }
    }

    try {
      const projectPeopleView = convertToPeopleAccessPoliciesView(formValues);
      const peoplePoliciesViews = await this.accessPolicyService.putProjectPeopleAccessPolicies(
        this.projectId,
        projectPeopleView,
      );
      this.currentAccessPolicies = convertToAccessPolicyItemViews(peoplePoliciesViews);

      if (showAccessRemovalWarning) {
        await this.router.navigate(["sm", this.organizationId, "projects"]);
      }
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
          currentUser: m.type == ApItemEnum.User ? m.currentUser : null,
          currentUserInGroup: m.type == ApItemEnum.Group ? m.currentUserInGroup : null,
        })),
      });
    }
    this.loading = false;
  }

  private async showWarning(): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "smAccessRemovalWarningProjectTitle" },
      content: { key: "smAccessRemovalWarningProjectMessage" },
      acceptButtonText: { key: "removeAccess" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    return confirmed;
  }
}
