import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { catchError, combineLatest, EMPTY, Subject, switchMap, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";

import {
  ApItemValueType,
  convertToProjectServiceAccountsAccessPoliciesView,
} from "../../shared/access-policies/access-policy-selector/models/ap-item-value.type";
import {
  ApItemViewType,
  convertPotentialGranteesToApItemViewType,
  convertPoliciesToApItemViewType,
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
        .getProjectServiceAccountsAccessPolicies(params.projectId, params.organizationId)
        .then((policies) => {
          return convertPoliciesToApItemViewType(policies);
        }),
    ),
    catchError(() => {
      this.router.navigate(["/sm", this.organizationId, "projects"]);
      return EMPTY;
    }),
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

  constructor(
    private route: ActivatedRoute,
    private changeDetectorRef: ChangeDetectorRef,
    private validationService: ValidationService,
    private accessPolicyService: AccessPolicyService,
    private router: Router,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
  ) {}

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    try {
      const projectServiceAccountPoliciesView = convertToProjectServiceAccountsAccessPoliciesView(
        this.projectId,
        this.formGroup.value.accessPolicies,
      );

      const serviceAccountsPoliciesViews =
        await this.accessPolicyService.putProjectServiceAccountsAccessPolicies(
          projectServiceAccountPoliciesView,
          this.projectId,
          this.organizationId,
        );

      this.currentAccessPolicies = convertPoliciesToApItemViewType(serviceAccountsPoliciesViews);

      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("projectAccessUpdated"),
      );
    } catch (e) {
      this.validationService.showError(e);
      this.setSelected(this.currentAccessPolicies);
    }
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
}
