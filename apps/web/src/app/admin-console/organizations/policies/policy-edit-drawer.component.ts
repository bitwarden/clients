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
import { combineLatest, map, firstValueFrom, switchMap, filter, of, startWith } from "rxjs";
import { Constructor } from "type-fest";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  SpinnerComponent,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../shared";

import { BasePolicyEditDefinition, BasePolicyEditComponent } from "./base-policy-edit.component";
import type { PolicyEditDialogData, PolicyEditDialogResult } from "./policy-edit-dialog.component";

@Component({
  selector: "app-policy-edit-drawer",
  templateUrl: "policy-edit-drawer.component.html",
  imports: [SharedModule, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyEditDrawerComponent implements AfterViewInit {
  private readonly policyFormRef = viewChild("policyForm", { read: ViewContainerRef });
  private readonly destroyRef = inject(DestroyRef);
  /** Disarmed on lock/logout so neither closePredicate nor beforeunload prompts during teardown. */
  private readonly guardArmed = signal(true);

  protected readonly policyType = PolicyType;
  protected readonly loading = signal(true);
  protected readonly enabled = false;
  private readonly _saveDisabled = signal(true);
  protected readonly saveDisabled: Signal<boolean> = this._saveDisabled;
  protected readonly policyComponent = signal<BasePolicyEditComponent | undefined>(undefined);
  protected readonly policyEnabled = signal(false);

  readonly formGroup = this.formBuilder.group({
    enabled: [this.enabled],
  });

  constructor(
    @Inject(DIALOG_DATA) protected readonly data: PolicyEditDialogData,
    private readonly accountService: AccountService,
    private readonly policyApiService: PolicyApiServiceAbstraction,
    private readonly i18nService: I18nService,
    private readonly cdr: ChangeDetectorRef,
    private readonly formBuilder: FormBuilder,
    private readonly dialogRef: DialogRef<PolicyEditDialogResult>,
    private readonly toastService: ToastService,
    private readonly keyService: KeyService,
    private readonly dialogService: DialogService,
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
    cancelButtonText: { key: "backToEditing" },
  };

  private setupDiscardGuard(): void {
    this.dialogRef.closePredicate = async (result?: PolicyEditDialogResult) => {
      // A truthy result means an intentional close (e.g. after a successful save) — always allow.
      if (result || !this.isFormDirty()) {
        return true;
      }
      return this.dialogService.openSimpleDialog(this.discardDialogOptions);
    };

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
        this.dialogRef.closePredicate = undefined;
      });
  }

  async ngAfterViewInit() {
    const policyResponse = await this.load();
    this.loading.set(false);
    this.cdr.detectChanges(); // ensure @else branch renders before accessing policyFormRef

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
      component.data?.statusChanges.pipe(startWith(component.data?.status)) ?? of("VALID"),
    ])
      .pipe(
        map(([enabledFormValue, _dataFormValue, dataFormStatus]) => {
          // Disable the Save button if one of the three is true:
          // 1. The policy data and enabled field have not changed from what currently exists
          // 2. The policy data form is currently invalid
          // 3. The server says the policy cannot be toggled
          return (
            (enabledFormValue === policyResponse.enabled &&
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
      Object.keys(newPolicy).some((newKey) => oldPolicy[newKey] !== newPolicy[newKey])
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

  private getComponentToLoad(): Constructor<BasePolicyEditComponent> {
    return this.data.policy.v2?.component ?? this.data.policy.component;
  }

  static readonly openDrawer = (
    dialogService: DialogService,
    config: DialogConfig<PolicyEditDialogData>,
  ) => {
    return dialogService.openDrawer<PolicyEditDialogResult>(PolicyEditDrawerComponent, config);
  };
}
