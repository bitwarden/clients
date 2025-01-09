// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  Inject,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { Observable, map } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { BasePolicy, BasePolicyComponent } from "../policies";

export type PolicyEditDialogData = {
  /** Returns policy abstracts. */
  policy: BasePolicy;
  /** Returns a unique organization id  */
  organizationId: string;
};

export enum PolicyEditDialogResult {
  Saved = "saved",
}
@Component({
  selector: "app-policy-edit",
  templateUrl: "policy-edit.component.html",
})
export class PolicyEditComponent implements AfterViewInit {
  @ViewChild("policyForm", { read: ViewContainerRef, static: true })
  policyFormRef: ViewContainerRef;

  policyType = PolicyType;
  loading = true;
  enabled = false;
  saveDisabled$: Observable<boolean>;
  defaultTypes: any[];
  policyComponent: BasePolicyComponent;

  private policyResponse: PolicyResponse;
  formGroup = this.formBuilder.group({
    enabled: [this.enabled],
  });
  constructor(
    @Inject(DIALOG_DATA) protected data: PolicyEditDialogData,
    private policyApiService: PolicyApiServiceAbstraction,
    private i18nService: I18nService,
    private cdr: ChangeDetectorRef,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef<PolicyEditDialogResult>,
    private toastService: ToastService,
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
  }

  submit = async () => {
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
    return dialogService.open<PolicyEditDialogResult>(PolicyEditComponent, config);
  };
}
