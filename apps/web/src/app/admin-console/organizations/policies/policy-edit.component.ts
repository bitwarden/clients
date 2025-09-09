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
import { Observable, map, firstValueFrom } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { BasePolicy, BasePolicyComponent } from "../policies";
import { vNextOrganizationDataOwnershipPolicyComponent } from "../policies/vnext-organization-data-ownership.component";

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
}
@Component({
  selector: "app-policy-edit",
  templateUrl: "policy-edit.component.html",
  standalone: false,
})
export class PolicyEditComponent implements AfterViewInit {
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
  constructor(
    @Inject(DIALOG_DATA) protected data: PolicyEditDialogData,
    private policyApiService: PolicyApiServiceAbstraction,
    private i18nService: I18nService,
    private cdr: ChangeDetectorRef,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef<PolicyEditDialogResult>,
    private toastService: ToastService,
    private configService: ConfigService,
    private keyService: KeyService,
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
    if ((await this.policyComponent.confirm()) == false) {
      this.dialogRef.close();
      return;
    }

    try {
      if (await this.shouldUseVNextImplementation()) {
        await this.handleVNextSubmission();
      } else {
        await this.handleStandardSubmission();
      }

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name)),
      });
      this.dialogRef.close(PolicyEditDialogResult.Saved);
    } catch (error) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: error.message,
      });
    }
  };

  private async shouldUseVNextImplementation(): Promise<boolean> {
    const isVNextComponent =
      this.policyComponent instanceof vNextOrganizationDataOwnershipPolicyComponent;
    const isVNextFeatureEnabled = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.CreateDefaultLocation),
    );

    return isVNextComponent && isVNextFeatureEnabled;
  }

  private async handleStandardSubmission(): Promise<void> {
    const request = await this.policyComponent.buildRequest();
    await this.policyApiService.putPolicy(this.data.organizationId, this.data.policy.type, request);
  }

  private async handleVNextSubmission(): Promise<void> {
    const orgKey = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.keyService.orgKeys$(userId)),
        map((orgKeys) => orgKeys[this.data.organizationId as OrganizationId] ?? null),
      ),
    );

    if (orgKey == null) {
      throw new Error("No encryption key for this organization.");
    }

    const vNextRequest = await (
      this.policyComponent as vNextOrganizationDataOwnershipPolicyComponent
    ).buildVNextRequest(orgKey);

    await this.policyApiService.putPolicyVNext(
      this.data.organizationId,
      this.data.policy.type,
      vNextRequest,
    );
  }
  static open = (dialogService: DialogService, config: DialogConfig<PolicyEditDialogData>) => {
    return dialogService.open<PolicyEditDialogResult>(PolicyEditComponent, config);
  };
}
