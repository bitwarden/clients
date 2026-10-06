import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  CalloutModule,
  TypographyModule,
  FormFieldModule,
  SelectModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AGENT_LOGOS } from "../icons";
import { AgentAccessConsequence } from "../models/agent-access-consequence";
import { SmProjectMatch } from "../services/agent-access-secrets.service";
import { resolveAgentBrand } from "../utils/agent-brand.util";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

import { AgentAccessRequestDialogComponent } from "./shared/agent-access-request-dialog.component";
import { AgentAccessRequesterView } from "./shared/agent-access-requester.component";

/**
 * What an agent's `secretUpdate` request proposes to change, resolved BEFORE this dialog opens
 * (agent-access-architecture.md, "M6-D": "resolving names/state BEFORE the dialog"). Every
 * property that is present is a change the dialog shows and, on approval, releases — an absent
 * property means that field is left alone (ciphertext passthrough, see
 * `AgentAccessSecretsService.updateSecret`).
 */
export interface UpdateSecretRequestChanges {
  name?: { from: string; to: string };
  /** `"agent"` — the agent supplied a new value, shown masked, with no reveal — unlike
   *  `create-secret-request`, this dialog has no sanctioned exception to the "never render a
   *  secret value" invariant, so the actual string never reaches this component's params at all.
   *  `"generated"` — Bitwarden will generate the new value at approval time; it is never shown
   *  here or anywhere else (agent-access-architecture.md, invariant 14). */
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
  /**
   * Attested code-signature facts for the requester (agent-access-design-spec.md §7.5.2), read
   * from `localPeer.signature` on the wire message — never from `requesterName`, which is
   * self-reported and must never influence which brand logo resolves. `undefined` on a relay-
   * origin request, which has no OS-verified peer at all; see `resolveAgentBrand`'s contract for
   * why an absent/invalid signature always falls back to the neutral glyph rather than a logo.
   */
  signatureKind?: string;
  signatureIdentity?: string;
  signatureValid?: boolean;
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
 * individual field changes, each displayed as a labeled before/after (or "will be generated")
 * card so approving this dialog releases exactly, and only, what it displays
 * (payload-built-before-dialog invariant).
 *
 * SECURITY: never renders the secret's current value or current note — only the proposed new
 * value's *origin* (`"agent"` vs `"generated"`) and the proposed new note text, which came from
 * the agent, not from decrypting anything currently stored. Unlike `create-secret-request`, the
 * `"agent"` value case has no reveal toggle: the actual proposed string never reaches this
 * component's `DIALOG_DATA` at all, only the `"agent"` tag, so there is nothing here that could
 * be revealed even by a future bug in this file (agent-access-design-spec.md §2.3's invariant 21
 * — "never render a secret value" — has no sanctioned exception in this dialog).
 */
@Component({
  selector: "app-update-secret-request",
  templateUrl: "update-secret-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    I18nPipe,
    ButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    CalloutModule,
    TypographyModule,
    FormFieldModule,
    SelectModule,
    AgentAccessRequestDialogComponent,
  ],
})
export class UpdateSecretRequestComponent {
  protected readonly NO_MOVE_SENTINEL = NO_MOVE_SENTINEL;
  protected readonly AgentAccessConsequence = AgentAccessConsequence;

  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject<DialogRef<UpdateSecretRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  protected readonly params = inject<UpdateSecretRequestParams>(DIALOG_DATA);

  protected readonly requesterDisplayName =
    this.params.requesterName?.trim() ||
    (this.params.requesterFingerprint
      ? shortenFingerprint(this.params.requesterFingerprint)
      : this.i18nService.t("agentAccessUnknownApplication"));

  /** The known agent behind a *verified* signature, or `undefined` for an unrecognized/unverified
   *  requester — decoration only, never a factor in what's authorized (see `resolveAgentBrand`'s
   *  contract). SECURITY: resolved from `params.signature*` only; `params.requesterName` is
   *  self-reported and must never influence this (agent-access-design-spec.md §7.5.2). */
  protected readonly brand = resolveAgentBrand(this.params);

  /** Brand mark for the resolved agent; `undefined` renders the neutral `bwi-terminal` glyph. */
  protected readonly brandLogo = this.brand == null ? undefined : AGENT_LOGOS[this.brand];

  /** WHO is asking (spec §2). */
  protected readonly requesterView: AgentAccessRequesterView = {
    name: this.requesterDisplayName,
    brandLogo: this.brandLogo,
  };

  /** WHAT happens if I say yes (spec §2) — always `change`: the vault is mutated, but nothing
   *  that already exists is disclosed, whichever of the three change kinds below are present.
   *  The specifics live in the body's before/after cards, not in this one-sentence summary. */
  protected readonly consequenceSummary = this.i18nService.t("agentAccessUpdateConsequenceSummary");

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
