import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
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
  FormFieldModule,
  SelectModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SmProjectMatch } from "../services/agent-access-secrets.service";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

/**
 * What an agent's `secretUpdate` request proposes to change, resolved BEFORE this dialog opens
 * (agent-access-architecture.md, "M6-D": "resolving names/state BEFORE the dialog"). Every
 * property that is present is a change the dialog shows and, on approval, releases — an absent
 * property means that field is left alone (ciphertext passthrough, see
 * `AgentAccessSecretsService.updateSecret`).
 */
export interface UpdateSecretRequestChanges {
  name?: { from: string; to: string };
  /** `"agent"` — the agent supplied a new value, shown masked with a reveal toggle, exactly like
   *  `create-secret-request`. `"generated"` — Bitwarden will generate the new value at approval
   *  time; it is never shown here or anywhere else (agent-access-architecture.md, invariant 14). */
  value?: "agent" | "generated";
  /** The agent's PROPOSED new note text. Never the secret's CURRENT note — that is write-only
   *  through Agent Access and is never fetched, let alone rendered, by this dialog (M4 invariant
   *  2, restated for M6). An empty string means the agent is asking to clear the note. */
  note?: { to: string };
  /** A proposed move, by project-name HINT — never trusted silently; see `writableProjects`. */
  project?: { toHint: string };
}

export interface UpdateSecretRequestParams {
  requesterName?: string;
  requesterFingerprint?: string;
  /** The secret's CURRENT decrypted name — display only, for the dialog's header/identity block.
   *  Never the proposed value for anything the agent didn't ask to change. */
  secretName: string;
  organizationName?: string;
  changes: UpdateSecretRequestChanges;
  /** Every `write === true` project in the secret's organization — supplied only when
   *  `changes.project` is set (a move was requested); the picker renders only then. */
  writableProjects?: SmProjectMatch[];
  /** A writable project whose decrypted name matches `changes.project.toHint` exactly. Never
   *  trusted silently — the user sees and can change the selection. */
  preselectedProjectId?: string;
  userId: UserId;
}

/** Set only when the user confirmed the proposed move by leaving a project selected. Omitting
 *  this (even when a move was proposed) means "leave the secret's project mapping alone" —
 *  `updateSecret` then sends `projectIds: undefined`, never `[]`. */
export interface UpdateSecretRequestResult {
  approved: boolean;
  projectId?: string;
}

/** Sentinel meaning "don't move the secret" in the project `bit-select`, distinct from any real
 *  project id — mirrors `create-secret-request`'s `NEW_PROJECT_SENTINEL` pattern. */
const NO_MOVE_SENTINEL = "__agent-access-no-move__";

/**
 * Approval dialog for a `secretUpdate` request (agent-access-architecture.md, "M6-D"). Unlike
 * `CreateSecretRequestComponent`, there is no single "the proposed item" — only a list of
 * individual field changes, each displayed with a from -> to (or "will be generated") summary so
 * approving this dialog releases exactly, and only, what it displays (payload-built-before-dialog
 * invariant).
 *
 * SECURITY: never renders the secret's current value or current note — only the proposed new
 * value's *origin* (`"agent"` vs `"generated"`) and the proposed new note text, which came from
 * the agent, not from decrypting anything currently stored.
 */
@Component({
  selector: "app-update-secret-request",
  templateUrl: "update-secret-request.component.html",
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
    FormFieldModule,
    SelectModule,
  ],
})
export class UpdateSecretRequestComponent {
  protected readonly NO_MOVE_SENTINEL = NO_MOVE_SENTINEL;

  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject<DialogRef<UpdateSecretRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  protected readonly params = inject<UpdateSecretRequestParams>(DIALOG_DATA);

  protected readonly requesterDisplayName =
    this.params.requesterName?.trim() ||
    (this.params.requesterFingerprint
      ? shortenFingerprint(this.params.requesterFingerprint)
      : this.i18nService.t("agentAccessUnknownApplication"));

  protected readonly showProjectPicker = computed(() => this.params.changes.project != null);

  protected readonly updateSecretRequestForm = this.formBuilder.group({
    projectId: [this.params.preselectedProjectId ?? NO_MOVE_SENTINEL],
  });

  static open(dialogService: DialogService, params: UpdateSecretRequestParams) {
    return dialogService.open<UpdateSecretRequestResult, UpdateSecretRequestParams>(
      UpdateSecretRequestComponent,
      { data: params },
    );
  }

  readonly submit = async () => {
    const projectIdValue = this.updateSecretRequestForm.value.projectId;
    const projectId =
      this.showProjectPicker() && projectIdValue && projectIdValue !== NO_MOVE_SENTINEL
        ? projectIdValue
        : undefined;
    await this.dialogRef.close({ approved: true, projectId });
  };

  readonly deny = async () => {
    await this.dialogRef.close({ approved: false });
  };
}
