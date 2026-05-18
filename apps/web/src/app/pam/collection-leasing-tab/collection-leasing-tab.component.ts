import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  LinkModule,
  ToastService,
  ToggleGroupModule,
} from "@bitwarden/components";
import { CollectionLeasingRequest, LeasingPolicy, PamApiService } from "@bitwarden/pam";

import { CompositePolicyEditorComponent } from "../policy-editor/composite/composite-policy-editor.component";
import { HumanApprovalEditorComponent } from "../policy-editor/human-approval/human-approval-editor.component";

/** The discriminator values of {@link LeasingPolicy}. */
export const LeasingPolicyKind = Object.freeze({
  HumanApproval: "human_approval",
  IpAllowlist: "ip_allowlist",
  TimeOfDay: "time_of_day",
  AllOf: "all_of",
} as const);
export type LeasingPolicyKind = (typeof LeasingPolicyKind)[keyof typeof LeasingPolicyKind];

/**
 * Leasing-tab scaffold for the collection-edit dialog.
 *
 * Owns the master `leasing_enabled` toggle and the policy-mode selector. Real
 * mode editors land in PM-37272 (Human approval), PM-37273 (IP allowlist),
 * PM-37274 (Time of day) and PM-37275 (Custom composite); this scaffold renders
 * only a placeholder region per mode and exposes the chosen kind via the
 * {@link activePolicyKind} signal so the future editors can subscribe to it.
 *
 * v0 save semantics:
 *  - When `leasingEnabled === false`, the policy is dropped (PUT with
 *    `{ leasingEnabled: false, policy: null }`).
 *  - When `leasingEnabled === true` and the active kind is `human_approval`,
 *    the policy is `{ kind: "human_approval" }` — Human approval has no editor
 *    state, so this scaffold can already emit a valid policy.
 *  - For every other kind, this scaffold emits `policy: null` (acceptable per
 *    PM-37271 AC; the future editor stories fill in the real shape).
 */
@Component({
  selector: "pam-collection-leasing-tab",
  templateUrl: "./collection-leasing-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    JslibModule,
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    CheckboxModule,
    FormFieldModule,
    LinkModule,
    ToggleGroupModule,
    HumanApprovalEditorComponent,
    CompositePolicyEditorComponent,
  ],
})
export class CollectionLeasingTabComponent implements OnInit {
  private readonly pamApi = inject(PamApiService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  /** Collection whose leasing config is being edited. */
  readonly collectionId = input.required<string>();

  /**
   * Whether the current user has `Manage` permission on the collection. The
   * tab is read-only when this is false.
   */
  readonly canManage = input<boolean>(false);

  /**
   * Emitted when the user clicks the "Manage members" link inside the Leasing
   * tab. The host (collection-dialog) should switch to its Access tab. We use
   * an output rather than a routerLink because the dialog is modal and the
   * Access tab lives inside the same dialog.
   */
  readonly switchToAccess = output<void>();

  protected readonly loading = signal(true);
  protected readonly leasingEnabled = signal(false);
  protected readonly activePolicyKind = signal<LeasingPolicyKind>(LeasingPolicyKind.HumanApproval);

  /** Holds the latest serialized policy from the composite editor. Null until valid. */
  protected readonly compositePolicy = signal<LeasingPolicy | null>(null);

  /** Tracks the last-loaded server state so we can detect "turning off". */
  private readonly wasEnabledOnLoad = false;

  /**
   * `true` when the form is in a state we can save. v0 considers any combination
   * valid (leasing off saves null policy; leasing on + human_approval saves a
   * concrete policy; the other kinds save null awaiting their editor stories).
   * Future mode-editor stories will tighten this once their forms exist.
   */
  protected readonly canSave = computed(() => !this.loading() && this.canManage());

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const config = await this.pamApi.getCollectionLeasingConfig(this.collectionId());
      this.leasingEnabled.set(config.leasingEnabled);
      this.wasEnabledOnLoad = config.leasingEnabled;
      if (config.policy != null) {
        this.activePolicyKind.set(config.policy.kind);
      }
    } catch {
      // The server returns 404 when no config has been saved yet — treat as
      // a clean slate rather than surfacing an error to the user.
      this.leasingEnabled.set(false);
      this.wasEnabledOnLoad = false;
      this.activePolicyKind.set(LeasingPolicyKind.HumanApproval);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handle a click on the master toggle. When the user is turning leasing OFF
   * for a collection that previously had it on, we surface a confirmation that
   * explains the in-flight-leases-are-honored-until-expiry behavior; the API
   * is what actually drains pending requests, this dialog only sets
   * expectations.
   */
  protected async onToggleLeasingEnabled(nextChecked: boolean): Promise<void> {
    if (!nextChecked && this.wasEnabledOnLoad) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamLeasingTurnOffTitle" },
        content: { key: "pamLeasingTurnOffContent" },
        acceptButtonText: { key: "pamLeasingTurnOffAccept" },
        cancelButtonText: { key: "cancel" },
        type: "warning",
      });
      if (!confirmed) {
        // Revert the checkbox visually.
        this.leasingEnabled.set(true);
        return;
      }
    }
    this.leasingEnabled.set(nextChecked);
  }

  protected onSelectPolicyKind(kind: LeasingPolicyKind): void {
    this.activePolicyKind.set(kind);
  }

  protected onManageMembersClicked(): void {
    this.switchToAccess.emit();
  }

  /**
   * Submit handler. Bound to `bitAction` so the async-actions module disables
   * the button + shows a spinner for the duration of the request.
   *
   * Arrow function so `bitAction` keeps `this`.
   */
  protected readonly save = async (): Promise<void> => {
    if (!this.canSave()) {
      return;
    }
    const policy = this.buildPolicy();
    const request = new CollectionLeasingRequest({
      leasingEnabled: this.leasingEnabled(),
      policy,
    });
    try {
      const result = await this.pamApi.setCollectionLeasingConfig(this.collectionId(), request);
      this.wasEnabledOnLoad = result.leasingEnabled;
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamLeasingSaved"),
      });
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamLeasingSaveFailed"),
      });
      throw e;
    }
  };

  protected onCompositePolicyChange(policy: LeasingPolicy | null): void {
    this.compositePolicy.set(policy);
  }

  private buildPolicy(): LeasingPolicy | null {
    if (!this.leasingEnabled()) {
      return null;
    }
    if (this.activePolicyKind() === LeasingPolicyKind.HumanApproval) {
      return { kind: "human_approval" };
    }
    if (this.activePolicyKind() === LeasingPolicyKind.AllOf) {
      return this.compositePolicy();
    }
    // IP allowlist and time-of-day defer to their editor stories (PM-37273/74).
    return null;
  }
}
