import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Inject,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { Observable, map, firstValueFrom, switchMap, filter, of, merge } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  SimpleDialogOptions,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../shared";

import { BasePolicyEditDefinition, BasePolicyEditComponent } from "./base-policy-edit.component";
import { VNextPolicyRequest } from "./policy-edit-definitions/organization-data-ownership.component";

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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "policy-edit-dialog.component.html",
  imports: [SharedModule],
})
export class PolicyEditDialogComponent implements AfterViewInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
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

  private originalValues: { enabled: boolean | null; data: unknown } = {
    enabled: false,
    data: undefined,
  };
  private beforeUnloadListener: ((e: BeforeUnloadEvent) => void) | undefined;

  constructor(
    @Inject(DIALOG_DATA) protected data: PolicyEditDialogData,
    protected accountService: AccountService,
    protected policyApiService: PolicyApiServiceAbstraction,
    protected i18nService: I18nService,
    private cdr: ChangeDetectorRef,
    private formBuilder: FormBuilder,
    protected dialogRef: DialogRef<PolicyEditDialogResult>,
    protected toastService: ToastService,
    protected keyService: KeyService,
    protected dialogService: DialogService,
    private destroyRef: DestroyRef,
  ) {}

  get policy(): BasePolicyEditDefinition {
    return this.data.policy;
  }

  get isPolicyEnabled(): boolean {
    return this.policyComponent?.policyResponse?.enabled ?? false;
  }

  /**
   * Type guard to check if the policy component has the buildVNextRequest method.
   */
  private hasVNextRequest(
    component: BasePolicyEditComponent,
  ): component is BasePolicyEditComponent & {
    buildVNextRequest: (orgKey: OrgKey) => Promise<VNextPolicyRequest>;
  } {
    return "buildVNextRequest" in component && typeof component.buildVNextRequest === "function";
  }

  ngOnDestroy(): void {
    this.disableBeforeUnload();
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

    this.captureOriginalValues();
    this.subscribeToFormChanges();
  }

  /**
   * Stores the loaded form values as the baseline for dirty comparison.
   * Called after the child component has initialized and patched its form.
   */
  protected captureOriginalValues(): void {
    if (!this.policyComponent) {
      return;
    }
    this.originalValues = {
      enabled: this.policyComponent.enabled.value,
      data: this.policyComponent.data
        ? JSON.parse(JSON.stringify(this.policyComponent.data.value))
        : undefined,
    };
  }

  /**
   * Returns true if the current form state differs from the originally loaded values.
   * Uses value comparison so reverted changes are not considered unsaved.
   */
  protected hasUnsavedChanges(): boolean {
    if (!this.policyComponent) {
      return false;
    }
    const enabledChanged = this.policyComponent.enabled.value !== this.originalValues.enabled;
    const dataChanged =
      JSON.stringify(this.policyComponent.data?.value) !== JSON.stringify(this.originalValues.data);
    return enabledChanged || dataChanged;
  }

  /**
   * Subscribes to form value changes and keeps `dialogRef.disableClose` in sync
   * with the current dirty state.
   */
  private subscribeToFormChanges(): void {
    if (!this.policyComponent) {
      return;
    }

    const streams: Observable<unknown>[] = [this.policyComponent.enabled.valueChanges];
    if (this.policyComponent.data) {
      streams.push(this.policyComponent.data.valueChanges);
    }

    merge(...streams)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.hasUnsavedChanges()) {
          this.dialogRef.disableClose = true;
          this.enableBeforeUnload();
        } else {
          this.dialogRef.disableClose = false;
          this.disableBeforeUnload();
        }
      });
  }

  /**
   * Clears dirty state and the beforeunload warning. Call before programmatically closing the
   * drawer after a successful save in a subclass that overrides `submit`.
   */
  protected resetDirtyState(): void {
    this.dialogRef.disableClose = false;
    this.disableBeforeUnload();
  }

  private enableBeforeUnload(): void {
    if (this.beforeUnloadListener) {
      return;
    }
    this.beforeUnloadListener = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", this.beforeUnloadListener);
  }

  private disableBeforeUnload(): void {
    if (this.beforeUnloadListener) {
      window.removeEventListener("beforeunload", this.beforeUnloadListener);
      this.beforeUnloadListener = undefined;
    }
  }

  /**
   * Options for the "discard unsaved edits?" confirmation dialog.
   */
  private get discardDialogOptions(): SimpleDialogOptions {
    return {
      title: this.i18nService.t("discardEdits"),
      content: this.i18nService.t("discardEditsDesc"),
      type: "warning",
      acceptButtonText: { key: "discardEdits" },
      cancelButtonText: { key: "backToEditing" },
    };
  }

  /**
   * Closes the drawer, showing a confirmation dialog first if there are unsaved changes.
   * Used by the Cancel button and the header X button.
   */
  async cancel(): Promise<void> {
    if (!this.dialogRef.disableClose) {
      this.dialogRef.close();
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog(this.discardDialogOptions);
    if (confirmed) {
      this.dialogRef.disableClose = false;
      this.disableBeforeUnload();
      this.dialogRef.close();
    }
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
      if (this.hasVNextRequest(this.policyComponent)) {
        await this.handleVNextSubmission(this.policyComponent);
      } else {
        await this.handleStandardSubmission();
      }

      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name)),
      });
      this.dialogRef.disableClose = false;
      this.disableBeforeUnload();
      this.dialogRef.close("saved");
    } catch (error: any) {
      this.toastService.showToast({
        variant: "error",
        message: error.message,
      });
    }
  };

  private async handleStandardSubmission(): Promise<void> {
    if (!this.policyComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    const request = await this.policyComponent.buildRequest();
    await this.policyApiService.putPolicy(this.data.organizationId, this.data.policy.type, request);
  }

  private async handleVNextSubmission(
    policyComponent: BasePolicyEditComponent & {
      buildVNextRequest: (orgKey: OrgKey) => Promise<VNextPolicyRequest>;
    },
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

    const request = await policyComponent.buildVNextRequest(orgKey);

    await this.policyApiService.putPolicyVNext(
      this.data.organizationId,
      this.data.policy.type,
      request,
    );
  }
  static open = (dialogService: DialogService, config: DialogConfig<PolicyEditDialogData>) => {
    return dialogService.openDrawer<PolicyEditDialogResult, PolicyEditDialogData>(
      PolicyEditDialogComponent,
      config,
    );
  };
}
