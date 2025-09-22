import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  Inject,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { Observable, map, firstValueFrom, switchMap, filter, of } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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

import { SharedModule } from "../../../shared";

import { BasePolicyEditDefinition, BasePolicyEditComponent } from "./base-policy-edit.component";
import { vNextOrganizationDataOwnershipPolicyComponent } from "./policy-edit-definitions";

export type PolicyEditDialogData = {
  /**
   * The metadata containing information about how to display and edit the policy.
   */
  policy: BasePolicyEditDefinition;
  /**
   * The organization ID for the policy.
   */
  organizationId: string;
};

export type PolicyEditDialogResult = "saved";

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
  policyComponent: BasePolicyEditComponent | undefined;

  formGroup = this.formBuilder.group({
    enabled: [this.enabled],
  });
  constructor(
    @Inject(DIALOG_DATA) protected data: PolicyEditDialogData,
    private accountService: AccountService,
    private policyApiService: PolicyApiServiceAbstraction,
    private i18nService: I18nService,
    private cdr: ChangeDetectorRef,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef<PolicyEditDialogResult>,
    private toastService: ToastService,
    private configService: ConfigService,
    private keyService: KeyService,
  ) {}

  get policy(): BasePolicyEditDefinition {
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

    try {
      if (
        this.policyComponent instanceof vNextOrganizationDataOwnershipPolicyComponent &&
        (await this.isVNextEnabled())
      ) {
        await this.handleVNextSubmission(this.policyComponent);
      } else {
        await this.handleStandardSubmission();
      }

      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name)),
      });
      this.dialogRef.close("saved");
    } catch (error: any) {
      this.toastService.showToast({
        variant: "error",
        message: error.message,
      });
    }
  };

  private async isVNextEnabled(): Promise<boolean> {
    const isVNextFeatureEnabled = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.CreateDefaultLocation),
    );

    return isVNextFeatureEnabled;
  }

  private async handleStandardSubmission(): Promise<void> {
    if (!this.policyComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    const request = await this.policyComponent.buildRequest();
    await this.policyApiService.putPolicy(this.data.organizationId, this.data.policy.type, request);
  }

  private async handleVNextSubmission(
    policyComponent: vNextOrganizationDataOwnershipPolicyComponent,
  ): Promise<void> {
    const orgKey = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.keyService.orgKeys$(userId)),
        filter((orgKeys) => orgKeys != null),
        map((orgKeys) => orgKeys[this.data.organizationId as OrganizationId] ?? null),
      ),
    );

    if (orgKey == null) {
      throw new Error("No encryption key for this organization.");
    }

    const vNextRequest = await policyComponent.buildVNextRequest(orgKey);

    await this.policyApiService.putPolicyVNext(
      this.data.organizationId,
      this.data.policy.type,
      vNextRequest,
    );
  }
  static open = (dialogService: DialogService, config: DialogConfig<PolicyEditDialogData>) => {
    return dialogService.open<PolicyEditDialogResult>(PolicyEditDialogComponent, config);
  };
}
