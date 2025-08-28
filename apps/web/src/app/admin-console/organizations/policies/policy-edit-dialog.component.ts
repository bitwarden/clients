import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  Inject,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { filter, map, Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById, isNotNull } from "@bitwarden/common/platform/misc";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { SharedModule } from "../../../shared";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export type PolicyEditDialogData = {
  /**
   * The metadata containing information about how to display and edit the policy.
   */
  policy: BasePolicy;
  /**
   * The organization ID for the policy.
   */
  organizationId: string;
};

export type PolicyEditDialogResult = "saved" | "upgrade-plan";

@Component({
  templateUrl: "policy-edit-dialog.component.html",
  imports: [SharedModule],
})
export class PolicyEditDialogComponent implements AfterViewInit {
  @ViewChild("policyForm", { read: ViewContainerRef, static: true })
  policyFormRef: ViewContainerRef | undefined;

  policyType = PolicyType;
  loading = true;
  enabled = false;
  saveDisabled$: Observable<boolean> = of(false);
  policyComponent: BasePolicyComponent | undefined;

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
  ) {
    this.organization$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
      getById(this.data.organizationId),
      filter(isNotNull),
    );
    this.isBreadcrumbingEnabled$ = this.organization$.pipe(
      switchMap((organization) =>
        this.organizationBillingService.isBreadcrumbingPoliciesEnabled$(organization),
      ),
    );
  }

  get policy(): BasePolicy {
    return this.data.policy;
  }

  /**
   * Instantiates the child policy component and inserts it into the view.
   */
  async ngAfterViewInit() {
    const policyResponse = await this.load();
    this.loading = false;

    if (!this.policyFormRef) {
      throw new Error("Template not initialized.");
    }

    this.policyComponent = this.policyFormRef.createComponent(this.data.policy.component).instance;
    this.policyComponent.policy = this.data.policy;
    this.policyComponent.policyResponse = policyResponse;

    if (this.policyComponent.data) {
      // If the policy has additional configuration, disable the save button if the form state is invalid
      this.saveDisabled$ = this.policyComponent.data.statusChanges.pipe(
        map((status) => status !== "VALID" || !policyResponse.canToggleState),
      );
    }

    this.cdr.detectChanges();
  }

  async load() {
    try {
      return await this.policyApiService.getPolicy(this.data.organizationId, this.data.policy.type);
    } catch (e: any) {
      // No policy exists yet, instantiate an empty one
      if (e.statusCode === 404) {
        return new PolicyResponse({ Enabled: false });
      } else {
        throw e;
      }
    }
  }

  submit = async () => {
    if (!this.policyComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    if ((await this.policyComponent.confirm()) == false) {
      this.dialogRef.close();
      return;
    }

    let request: PolicyRequest;

    try {
      request = await this.policyComponent.buildRequest();
    } catch (e: any) {
      this.toastService.showToast({ variant: "error", message: e.message });
      return;
    }

    await this.policyApiService.putPolicy(this.data.organizationId, this.data.policy.type, request);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name)),
    });
    this.dialogRef.close("saved");
  };

  static open = (dialogService: DialogService, config: DialogConfig<PolicyEditDialogData>) => {
    return dialogService.open<PolicyEditDialogResult>(PolicyEditDialogComponent, config);
  };

  protected upgradePlan(): void {
    this.dialogRef.close("upgrade-plan");
  }
}
