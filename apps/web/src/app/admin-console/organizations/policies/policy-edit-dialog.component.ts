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
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { map, firstValueFrom, switchMap, filter, combineLatest, of, startWith } from "rxjs";
import { Constructor } from "type-fest";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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
import { PolicyEditDrawerComponent } from "./policy-edit-drawer.component";

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
  protected readonly destroyRef = inject(DestroyRef);
  private readonly discardGuardEnabled = signal(false);
  /** Disarmed on lock/logout so neither closePredicate nor beforeunload prompts during teardown. */
  private readonly guardArmed = signal(false);
  private readonly useDrawer = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.PolicyDrawers),
    { initialValue: false },
  );

  protected readonly policyType = PolicyType;
  protected readonly loading = signal(true);
  protected readonly enabled = false;
  protected readonly policyEnabled = signal(false);
  private readonly _saveDisabled = signal(true);
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
    protected readonly dialogService: DialogService,
    protected readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  get policy(): BasePolicyEditDefinition {
    return this.data.policy;
  }

  private isFormDirty(): boolean {
    const component = this.policyComponent();
    if (!component) {
      return false;
    }
    return component.enabled.dirty || (component.data?.dirty ?? false);
  }

  private readonly discardDialogOptions = {
    title: { key: "discardEditsTitle" },
    content: { key: "discardEditsConfirmation" },
    type: "danger" as const,
    hideIcon: true,
    acceptButtonText: { key: "discardEdits" },
    cancelButtonText: { key: "keepEditing" },
  };

  /**
   * Installs the discard-edits guard.
   * - `beforeunload` fires for both modals and drawers (browser refresh / tab close).
   * - `closePredicate` fires for drawers only (clicking the drawer's close button).
   * Call this once the child policy component has been initialised.
   */
  protected setupDiscardGuard(): void {
    this.guardArmed.set(true);

    // Guard against browser refresh / tab close while edits are pending.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (this.guardArmed() && this.isFormDirty()) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    this.destroyRef.onDestroy(() => window.removeEventListener("beforeunload", onBeforeUnload));

    // When the vault is locked or the user is logged out, disarm both guards so neither
    // closePredicate nor beforeunload prompts during the subsequent router teardown.
    // If the active account becomes null (switchAccount(null) during logout), treat that
    // as a non-Unlocked state and disarm as well.
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) => {
          if (account?.id == null) {
            return of(null); // no active account — disarm immediately
          }
          return this.authService
            .authStatusFor$(account.id)
            .pipe(filter((status) => status !== AuthenticationStatus.Unlocked));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.guardArmed.set(false);
        this.discardGuardEnabled.set(false);
        this.dialogRef.closePredicate = undefined;
      });

    // For modals, only the beforeunload guard is needed — closePredicate is drawer-only.
    if (!this.useDrawer() || !this.dialogRef.isDrawer) {
      return;
    }

    this.discardGuardEnabled.set(true);
    this.dialogRef.closePredicate = async (result?: PolicyEditDialogResult) => {
      // A truthy result means an intentional close (e.g. after a successful save) — always allow.
      if (result || !this.isFormDirty()) {
        return true;
      }
      const confirmed = await this.dialogService.openSimpleDialog(this.discardDialogOptions);
      if (confirmed) {
        this.discardGuardEnabled.set(false);
      }
      return confirmed;
    };
  }

  protected readonly cancel = async () => {
    if (!this.discardGuardEnabled() || !this.isFormDirty()) {
      await this.dialogRef.close();
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog(this.discardDialogOptions);
    if (confirmed) {
      // Clear the predicate first so close() doesn't show a second dialog.
      this.dialogRef.closePredicate = undefined;
      await this.dialogRef.close();
    }
  };

  /**
   * Returns the policy form component to load into the dialog.
   * Subclasses can override this to load a different component (e.g. the drawer variant).
   */
  protected getComponentToLoad(): Constructor<BasePolicyEditComponent> {
    return this.data.policy.component;
  }

  async ngAfterViewInit() {
    const policyResponse = await this.load();
    this.policyEnabled.set(policyResponse.enabled);
    this.loading.set(false);

    const policyFormRef = this.policyFormRef();
    if (!policyFormRef) {
      throw new Error("Template not initialized.");
    }

    const componentRef = policyFormRef.createComponent(this.getComponentToLoad());
    componentRef.setInput("policy", this.data.policy);
    componentRef.setInput("policyResponse", policyResponse);
    const component = componentRef.instance;
    this.policyComponent.set(component);
    this.policyEnabled.set(policyResponse.enabled);

    combineLatest([
      component.enabled.valueChanges.pipe(startWith(policyResponse.enabled)),
      component.data?.valueChanges.pipe(startWith(policyResponse.data)) ?? of({}),
      component.data?.statusChanges.pipe(startWith("VALID")) ?? of("VALID"),
    ])
      .pipe(
        map(([enabledFormValue, _dataFormValue, dataFormStatus]) => {
          // Disable the Save button if one of the three is true:
          // 1. The policy data and enabled field have not changed from what currently exists
          // 2. The policy data form is currently invalid
          // 3. The server says the policy cannot be toggled
          return (
            (enabledFormValue === policyResponse.enabled &&
              // For the new policy state we need to get the raw form value in case the form is disabled
              !this.policyDataHasChanged(policyResponse.data, component.data?.getRawValue())) ||
            dataFormStatus === "INVALID" ||
            !policyResponse.canToggleState
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((disabled) => this._saveDisabled.set(disabled));

    this.cdr.detectChanges();
    this.setupDiscardGuard();
  }

  private policyDataHasChanged(oldPolicyData: any, newPolicyData: any) {
    const oldPolicy = oldPolicyData ?? {};
    const newPolicy = newPolicyData ?? {};
    return (
      Object.keys(oldPolicy).length !== Object.keys(newPolicy).length ||
      Object.keys(newPolicy).some((newKey) => {
        const oldValue = oldPolicy[newKey];
        const newValue = newPolicy[newKey];
        if (Array.isArray(oldValue) || Array.isArray(newValue)) {
          return (
            JSON.stringify((oldValue || []).sort()) !== JSON.stringify((newValue || []).sort())
          );
        }
        return oldValue !== newValue;
      })
    );
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

    try {
      await this.submitPolicy(policyComponent);

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

  private async submitPolicy(policyComponent: BasePolicyEditComponent): Promise<void> {
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

    const request = await policyComponent.buildRequest(orgKey);

    await this.policyApiService.putPolicy(
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

  static readonly openDrawer = (
    dialogService: DialogService,
    config: DialogConfig<PolicyEditDialogData>,
  ) => {
    return PolicyEditDrawerComponent.openDrawer(dialogService, config);
  };
}
