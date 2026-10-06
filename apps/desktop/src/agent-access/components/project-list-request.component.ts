import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  TypographyModule,
  TableModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AGENT_LOGOS } from "../icons";
import { AgentAccessConsequence } from "../models/agent-access-consequence";
import { resolveAgentBrand } from "../utils/agent-brand.util";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

import { AgentAccessRequestDialogComponent } from "./shared/agent-access-request-dialog.component";
import { AgentAccessRequesterView } from "./shared/agent-access-requester.component";

export interface ProjectListRequestEntry {
  name: string;
  organizationName?: string;
  write: boolean;
}

export interface ProjectListRequestParams {
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
  /** Every project name this approval will release, in the exact order the response will list
   *  them — displayed in full so approving means seeing everything that goes out
   *  (agent-access-architecture.md, "M6": "the dialog shows every name being shared"). Capped
   *  upstream at `MAX_PROJECT_LIST_ENTRIES` (`desktop-agent-access.service.ts`); hitting that cap
   *  truncates silently at the service layer, so this dialog must say so itself rather than let
   *  the human believe the table is the whole list (agent-access-design-spec.md §3.4). */
  entries: ProjectListRequestEntry[];
}

export interface ProjectListRequestResult {
  approved: boolean;
}

/** Mirrors `MAX_PROJECT_LIST_ENTRIES` in `services/desktop-agent-access.service.ts`. That service
 *  caps the entry list and truncates silently past it (agent-access-architecture.md, "M6":
 *  "capped at 200 entries"); this dialog only ever sees the already-capped array, so it infers a
 *  possible truncation from hitting the cap exactly rather than importing a service-internal
 *  constant. */
const MAX_PROJECT_LIST_ENTRIES = 200;

/**
 * Approval dialog for a `projectList` request (agent-access-architecture.md, "M6-D") — the one
 * list-shaped release in the whole M6 surface (invariant 16). One approval releases every entry
 * shown here, so the dialog enumerates them all rather than summarizing a count: there is no
 * per-item picker downstream the way there is for a credential/secret match list.
 *
 * Grade `metadata` (agent-access-design-spec.md §2.1): project names, organizations, and
 * read/write flags cross the boundary here, never a secret value. This is the calm, routine
 * dialog in the family — contrast deliberately with `ProjectSecretsRequestComponent`, the
 * `disclose`-grade sibling that releases every secret VALUE in a project.
 *
 * `dialogSize="large"`: three columns (project / organization / access) wrap and truncate badly
 * at the shell's default width, which is sized for the single-column/prose content most of the
 * family renders. Widening is a legibility fix for this specific table, not a severity signal —
 * `ProjectSecretsRequestComponent`'s single-column name list stays at the default size
 * deliberately (see that component's doc comment).
 */
@Component({
  selector: "app-project-list-request",
  templateUrl: "project-list-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    I18nPipe,
    ButtonModule,
    AsyncActionsModule,
    TypographyModule,
    TableModule,
    AgentAccessRequestDialogComponent,
  ],
})
export class ProjectListRequestComponent {
  protected readonly AgentAccessConsequence = AgentAccessConsequence;

  private readonly dialogRef = inject<DialogRef<ProjectListRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  protected readonly params = inject<ProjectListRequestParams>(DIALOG_DATA);

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

  protected readonly requesterView: AgentAccessRequesterView = {
    name: this.requesterDisplayName,
    brandLogo: this.brandLogo,
  };

  /** True when the entry count lands exactly on the cap — the service truncates silently at that
   *  point, so the dialog must say the list may be incomplete rather than imply it enumerated
   *  everything (agent-access-design-spec.md §3.4). */
  protected readonly isTruncated = this.params.entries.length >= MAX_PROJECT_LIST_ENTRIES;

  static open(dialogService: DialogService, params: ProjectListRequestParams) {
    return dialogService.open<ProjectListRequestResult, ProjectListRequestParams>(
      ProjectListRequestComponent,
      { data: params },
    );
  }

  readonly submit = async () => {
    await this.dialogRef.close({ approved: true });
  };

  readonly deny = async () => {
    await this.dialogRef.close({ approved: false });
  };
}
