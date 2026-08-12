import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { AgentFillFieldRole } from "@bitwarden/common/autofill/agent-fill/agent-fill-messages";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  IconButtonModule,
  DialogService,
  CalloutModule,
  TypographyModule,
  RadioButtonModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { shortenFingerprint } from "../utils/shorten-fingerprint";

import { CredentialLoginMatch } from "./approve-credential-request.component";

/** One role the extension planned a §4.1-safe target for. `target` is the extension's
 *  human-readable descriptor (e.g. `input[type=password]#pw (login form)`) — never a value. */
export interface FillFieldPlanEntry {
  role: AgentFillFieldRole;
  target: string;
}

/** One requested role with no safe target, and the machine-readable reason it was skipped. */
export interface FillSkippedRole {
  role: AgentFillFieldRole;
  reason: string;
}

export interface ApproveFillRequestParams {
  /** Same fallback chain as `ApproveCredentialRequestComponent.requesterDisplayName` — resolved
   *  from the OS/connection store, never self-reported by the requester. */
  requesterName?: string;
  requesterFingerprint?: string;
  /**
   * The extension-reported active-tab origin — the visually dominant element of this dialog
   * (agent-access-architecture.md, "M5": "origin is the visually dominant element"). SECURITY:
   * always from the extension's own report, NEVER from the request (M5 invariant 9) — the agent
   * cannot name a destination, so what's shown here is where the fill will actually land.
   */
  origin: string;
  /**
   * Every origin-matching login candidate, reusing the credential shape of the sibling approval
   * dialog's picker. Never empty — a zero-match request is denied (`originMismatch`) before this
   * dialog opens. `fieldsShared` flags reflect which planned roles that candidate would fill.
   */
  matches: CredentialLoginMatch[];
  /** The planned role -> target mapping the extension committed to. */
  fieldPlan: FillFieldPlanEntry[];
  /** Requested roles with no safe target, shown so the user knows what will NOT be filled. */
  skipped: FillSkippedRole[];
}

export interface ApproveFillRequestResult {
  approved: boolean;
  /** The cipher id the user picked. Set only when `approved` is true. */
  selectedId?: string;
}

/**
 * Approval dialog for a `deliveryMode: "fill"` credential request (agent-access-architecture.md,
 * "M5 — Browser fill delivery"). A standalone sibling of `ApproveCredentialRequestComponent` —
 * the picker works the same way, but what is being approved differs: nothing is handed to the
 * agent; the selected item's fields are written into the shown origin's page by the browser
 * extension, per the field plan displayed beneath.
 *
 * SECURITY: everything rendered here is value-free — item names, usernames (to tell candidates
 * apart), role names, and target descriptors. No password/TOTP value ever reaches this dialog.
 */
@Component({
  selector: "app-approve-fill-request",
  templateUrl: "approve-fill-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DialogModule,
    CommonModule,
    I18nPipe,
    ButtonModule,
    IconButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    CalloutModule,
    TypographyModule,
    RadioButtonModule,
  ],
})
export class ApproveFillRequestComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject<DialogRef<ApproveFillRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  protected readonly params = inject<ApproveFillRequestParams>(DIALOG_DATA);

  // Null-safe fallback chain, same as the sibling dialogs: a local-origin request never carries
  // a fingerprint, and name derivation can fail to attest anything recognizable.
  protected readonly requesterDisplayName =
    this.params.requesterName?.trim() ||
    (this.params.requesterFingerprint
      ? shortenFingerprint(this.params.requesterFingerprint)
      : this.i18nService.t("agentAccessUnknownApplication"));

  protected readonly hasMultipleMatches = this.params.matches.length > 1;

  protected readonly approveFillRequestForm = this.formBuilder.group({
    selectedId: [
      this.params.matches.length === 1 ? this.params.matches[0].cipherId : null,
      this.hasMultipleMatches ? [Validators.required] : [],
    ],
  });

  private readonly selectedId = toSignal(
    this.approveFillRequestForm.controls.selectedId.valueChanges,
    { initialValue: this.approveFillRequestForm.controls.selectedId.value },
  );

  protected readonly selectedMatch = computed(() =>
    this.params.matches.find((match) => match.cipherId === this.selectedId()),
  );

  /** Localized label for a fill role. Exhaustive over `AgentFillFieldRole` — a new role in the
   *  contract fails compilation here rather than rendering a raw string. */
  protected roleLabel(role: AgentFillFieldRole): string {
    const keys: Record<AgentFillFieldRole, string> = {
      username: "username",
      password: "password",
      totp: "verificationCode",
    };
    return this.i18nService.t(keys[role]);
  }

  static open(dialogService: DialogService, params: ApproveFillRequestParams) {
    return dialogService.open<ApproveFillRequestResult, ApproveFillRequestParams>(
      ApproveFillRequestComponent,
      { data: params },
    );
  }

  readonly submit = async () => {
    if (this.approveFillRequestForm.invalid) {
      this.approveFillRequestForm.markAllAsTouched();
      return;
    }

    const selectedId = this.approveFillRequestForm.value.selectedId ?? undefined;
    await this.dialogRef.close({ approved: true, selectedId });
  };

  readonly deny = async () => {
    await this.dialogRef.close({ approved: false });
  };
}
