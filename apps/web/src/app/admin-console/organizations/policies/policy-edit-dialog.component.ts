import { DialogRef as CdkDialogRef } from "@angular/cdk/dialog";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
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
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
    protected readonly dialogService: DialogService,
    protected readonly cdkDialogRef: CdkDialogRef,
    protected readonly configService: ConfigService,
  ) {}

  get policy(): BasePolicyEditDefinition {
    return this.data.policy;
  }

  private isFormDirty(): boolean {
    const component = this.policyComponent();
    return (component?.enabled?.dirty ?? false) || (component?.data?.dirty ?? false);
  }

  private readonly discardDialogOptions = {
    title: { key: "discardEditsTitle" },
    content: { key: "discardEditsConfirmation" },
    type: "danger" as const,
    hideIcon: true,
    acceptButtonText: { key: "discardEdits" },
    cancelButtonText: { key: "backToEditing" },
  };

  /**
   * Sets up the discard-edits guard based on whether the dialog is a modal or a drawer.
   *
   * For modals: disables the default ESC/backdrop close and subscribes to backdrop clicks manually
   * so they go through the `cancel()` dirty check.
   *
   * For drawers: installs a `closePredicate` on the dialog ref so that any close path — including
   * the X button, policy switching, and the `canDeactivate` navigation guard — shows the
   * confirmation dialog before proceeding.
   *
   * Call this once the child policy component has been initialised.
   */
  protected async setupDiscardGuard(): Promise<void> {
    this.discardGuardEnabled.set(
      await this.configService.getFeatureFlag(FeatureFlag.PolicyDrawers),
    );
    if (!this.discardGuardEnabled()) {
      return;
    }

    if (!this.dialogRef.isDrawer) {
      this.dialogRef.disableClose = true;
      this.cdkDialogRef.backdropClick
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.cancel());
      this.cdkDialogRef.keydownEvents
        .pipe(
          filter((e: KeyboardEvent) => e.key === "Escape"),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => void this.cancel());
    } else {
      this.dialogRef.closePredicate = async (result?: PolicyEditDialogResult) => {
        // A defined result means an intentional close (e.g. after a successful save) — always allow.
        if (result !== undefined || !this.isFormDirty()) {
          return true;
        }
        return this.dialogService.openSimpleDialog(this.discardDialogOptions);
      };
    }
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

  @HostListener("window:beforeunload", ["$event"])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.discardGuardEnabled() && this.isFormDirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  }

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
          map((status) => status === "INVALID" || !policyResponse.canToggleState),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((disabled) => this._saveDisabled.set(disabled));
    }

    this.cdr.detectChanges();
    await this.setupDiscardGuard();
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
    return dialogService.openDrawer<PolicyEditDialogResult>(PolicyEditDialogComponent, config);
  };
}
