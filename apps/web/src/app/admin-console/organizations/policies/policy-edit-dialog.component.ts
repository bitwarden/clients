import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Inject,
  Signal,
  ViewContainerRef,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { map, firstValueFrom, switchMap, filter } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { VNextSavePolicyRequest } from "@bitwarden/common/admin-console/models/request/v-next-save-policy.request";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey } from "@bitwarden/common/types/key";
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

export type PolicyEditDialogData = {
  /**
   * The metadata containing information about how to display and edit the policy.
   */
  policy: BasePolicyEditDefinition;
  /**
   * The organization for the policy.
   */
  organization: Organization;
};

export type PolicyEditDialogResult = "saved";

@Component({
  templateUrl: "policy-edit-dialog.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyEditDialogComponent implements AfterViewInit {
  private readonly policyFormRef = viewChild("policyForm", { read: ViewContainerRef });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly policyType = PolicyType;
  protected readonly loading = signal(true);
  protected readonly enabled = false;
  private readonly _saveDisabled = signal(false);
  protected readonly saveDisabled: Signal<boolean> = this._saveDisabled;
  protected readonly policyComponent = signal<BasePolicyEditComponent | undefined>(undefined);

  readonly formGroup = this.formBuilder.group({
    enabled: [this.enabled],
  });
  constructor(
    @Inject(DIALOG_DATA) protected readonly data: PolicyEditDialogData,
    protected readonly accountService: AccountService,
    protected readonly policyApiService: PolicyApiServiceAbstraction,
    protected readonly i18nService: I18nService,
    private readonly cdr: ChangeDetectorRef,
    private readonly formBuilder: FormBuilder,
    protected readonly dialogRef: DialogRef<PolicyEditDialogResult>,
    protected readonly toastService: ToastService,
    protected readonly keyService: KeyService,
  ) {}

  get policy(): BasePolicyEditDefinition {
    return this.data.policy;
  }

  /**
   * Type guard to check if the policy component has the buildVNextRequest method.
   */
  private hasVNextRequest(
    component: BasePolicyEditComponent,
  ): component is BasePolicyEditComponent & {
    buildVNextRequest: (orgKey: OrgKey) => Promise<VNextSavePolicyRequest>;
  } {
    return "buildVNextRequest" in component && typeof component.buildVNextRequest === "function";
  }

  /**
   * Instantiates the child policy component and inserts it into the view.
   */
  async ngAfterViewInit() {
    const policyResponse = await this.load();
    this.loading.set(false);

    const policyFormRef = this.policyFormRef();
    if (!policyFormRef) {
      throw new Error("Template not initialized.");
    }

    const componentRef = policyFormRef.createComponent(this.data.policy.component);
    componentRef.setInput("policy", this.data.policy);
    componentRef.setInput("policyResponse", policyResponse);
    const component = componentRef.instance;
    this.policyComponent.set(component);

    if (component.data) {
      component.data.statusChanges
        .pipe(
          map((status) => status !== "VALID" || !policyResponse.canToggleState),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((disabled) => this._saveDisabled.set(disabled));
    }

    this.cdr.detectChanges();
  }

  async load() {
    try {
      return await this.policyApiService.getPolicy(
        this.data.organization.id,
        this.data.policy.type,
      );
    } catch (e: any) {
      // No policy exists yet, instantiate an empty one
      if (e.statusCode === 404) {
        return new PolicyResponse({ Enabled: false });
      } else {
        throw e;
      }
    }
  }

  readonly submit = async () => {
    const policyComponent = this.policyComponent();
    if (!policyComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    if ((await policyComponent.confirm?.()) == false) {
      await this.dialogRef.close();
      return;
    }

    try {
      await this.handleVNextSubmission(policyComponent);

      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name)),
      });
      await this.dialogRef.close("saved");
    } catch (error: any) {
      this.toastService.showToast({
        variant: "error",
        message: error.message,
      });
    }
  };

  private async handleVNextSubmission(policyComponent: BasePolicyEditComponent): Promise<void> {
    const orgKey = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.keyService.orgKeys$(userId)),
        filter((orgKeys) => orgKeys != null),
        map((orgKeys) => orgKeys[this.data.organization.id] ?? null),
      ),
    );

    if (orgKey == null) {
      throw new Error("No encryption key for this organization.");
    }

    const request = await policyComponent.buildVNextRequest(orgKey);

    await this.policyApiService.putPolicyVNext(
      this.data.organization.id,
      this.data.policy.type,
      request,
    );
  }
  static readonly open = (
    dialogService: DialogService,
    config: DialogConfig<PolicyEditDialogData>,
  ) => {
    return dialogService.open<PolicyEditDialogResult>(PolicyEditDialogComponent, config);
  };
}
