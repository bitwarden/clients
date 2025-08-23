// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  Inject,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { map, Observable, switchMap } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";
import { SharedModule } from "../../../shared";

export type PolicyEditDialogData = {
  /** Returns policy abstracts. */
  policy: BasePolicy;
  /** Returns a unique organization id  */
  organizationId: string;
};

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum PolicyEditDialogResult {
  Saved = "saved",
  UpgradePlan = "upgrade-plan",
}
@Component({
  templateUrl: "policy-edit-dialog.component.html",
  imports: [SharedModule],
})
export class PolicyEditDialogComponent implements AfterViewInit {
  @ViewChild("policyForm", { read: ViewContainerRef, static: true })
  policyFormRef: ViewContainerRef;

  policyType = PolicyType;
  loading = true;
  enabled = false;
  saveDisabled$: Observable<boolean>;
  policyComponent: BasePolicyComponent;

  private policyResponse: PolicyResponse;
  formGroup = this.formBuilder.group({
    enabled: [this.enabled],
  });
  protected organization$: Observable<Organization>;
  protected isBreadcrumbingEnabled$: Observable<boolean>;

  constructor(
    @Inject(DIALOG_DATA) protected data: PolicyEditDialogData,
    private accountService: AccountService,
    private policyApiService: PolicyApiServiceAbstraction,
    private organizationService: OrganizationService,
    private i18nService: I18nService,
    private cdr: ChangeDetectorRef,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef<PolicyEditDialogResult>,
    private toastService: ToastService,
    private organizationBillingService: OrganizationBillingServiceAbstraction,
  ) {}

  get policy(): BasePolicy {
    return this.data.policy;
  }

  async ngAfterViewInit() {
    await this.load();
    this.loading = false;

    this.policyComponent = this.policyFormRef.createComponent(this.data.policy.component)
      .instance as BasePolicyComponent;
    this.policyComponent.policy = this.data.policy;
    this.policyComponent.policyResponse = this.policyResponse;

    this.saveDisabled$ = this.policyComponent.data.statusChanges.pipe(
      map((status) => status !== "VALID" || !this.policyResponse.canToggleState),
    );

    this.cdr.detectChanges();
  }

  async load() {
    try {
      this.policyResponse = await this.policyApiService.getPolicy(
        this.data.organizationId,
        this.data.policy.type,
      );
    } catch (e) {
      if (e.statusCode === 404) {
        this.policyResponse = new PolicyResponse({ Enabled: false });
      } else {
        throw e;
      }
    }
    this.organization$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
      getOrganizationById(this.data.organizationId),
    );
    this.isBreadcrumbingEnabled$ = this.organization$.pipe(
      switchMap((organization) =>
        this.organizationBillingService.isBreadcrumbingPoliciesEnabled$(organization),
      ),
    );
  }

  submit = async () => {
    if ((await this.policyComponent.confirm()) == false) {
      this.dialogRef.close();
      return;
    }

    let request: PolicyRequest;

    try {
      request = await this.policyComponent.buildRequest();
    } catch (e) {
      this.toastService.showToast({ variant: "error", title: null, message: e.message });
      return;
    }

    await this.policyApiService.putPolicy(this.data.organizationId, this.data.policy.type, request);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name)),
    });
    this.dialogRef.close(PolicyEditDialogResult.Saved);
  };

  static open = (dialogService: DialogService, config: DialogConfig<PolicyEditDialogData>) => {
    return dialogService.open<PolicyEditDialogResult>(PolicyEditDialogComponent, config);
  };

  protected upgradePlan(): void {
    this.dialogRef.close(PolicyEditDialogResult.UpgradePlan);
  }
}
