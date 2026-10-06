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

export interface ProjectSecretsRequestEntry {
  name: string;
}

export interface ProjectSecretsRequestParams {
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
  /** The resolved project's decrypted name — never the raw id/name selector the wire message
   *  carried (agent-access-architecture.md, "M7": resolved BEFORE this dialog opens). */
  projectName: string;
  organizationName?: string;
  /** Every secret name this approval will release for env injection, in the exact order the
   *  response will list them — displayed in full so approving means seeing everything that goes
   *  out (agent-access-architecture.md, "M7": "the full name list is shown"). Names only, never
   *  values — the dialog never shows a value, even masked (invariant 21). Capped upstream at
   *  `MAX_PROJECT_SECRETS_ENTRIES`; unlike `ProjectListRequestComponent`, the service denies the
   *  whole request before opening this dialog when the true count exceeds the cap (a truncated
   *  bulk release would silently omit secrets the agent's command still expects) — so hitting the
   *  cap here means exactly 200, not "200 of more." The truncation notice below is still shown at
   *  the cap because the dialog itself has no way to tell the two cases apart from `entries`
   *  alone, and a false "complete" claim is worse than an unnecessary caution. */
  entries: ProjectSecretsRequestEntry[];
}

export interface ProjectSecretsRequestResult {
  approved: boolean;
}

/** Mirrors `MAX_PROJECT_SECRETS_ENTRIES` in `services/desktop-agent-access.service.ts`. */
const MAX_PROJECT_SECRETS_ENTRIES = 200;

/**
 * Approval dialog for a `projectSecretsRequest` (agent-access-architecture.md, "M7 — `bws run`
 * parity"): the sole bulk-VALUE release in the whole Agent Access surface. One approval releases
 * every secret's VALUE in `projectName` for injection into the agent's command environment —
 * unlike `ProjectListRequestComponent` (M6, names/ids/write-flags only, no values), so the copy
 * here is explicit that VALUES leave the desktop, even though the dialog itself only ever shows
 * NAMES (never a value, agent-access-architecture.md invariant 21).
 *
 * Grade `disclose` (agent-access-design-spec.md §2.1): a secret value leaves this device. This is
 * the single bulk-value release in the whole Agent Access surface and reads as the most serious
 * non-destructive dialog in the family — contrast deliberately with `ProjectListRequestComponent`,
 * the `metadata`-grade sibling that never releases a value at all.
 *
 * Truthful consequence labeling (M7 decision, mirrors `run_with_secret`'s honesty caveat): values
 * are injected into the command's *environment* and scrubbed from its *captured output*, never
 * returned to the agent conversationally — but the command the agent runs can still read them.
 * This is `run_with_secret`'s trust model multiplied by every secret in the project; the dialog
 * says so plainly rather than implying "the agent never sees it" the way the create/update
 * generated-value notices do (those describe a value that never exists outside this process; this
 * one describes a value that is about to run inside a child process). That caveat is surfaced via
 * the consequence band's `detail` line so it stays pinned above the (potentially long,
 * internally-scrolling) secret table rather than risk being scrolled past.
 *
 * `dialogSize="default"` (deliberate, not an oversight): the body is a single-column list of
 * secret names — the opposite of `ProjectListRequestComponent`'s cramped 3-column table. Widening
 * to `large` would leave that single column stranded in a lot of empty horizontal space without
 * making anything more legible, so this dialog stays at the shell's default width.
 */
@Component({
  selector: "app-project-secrets-request",
  templateUrl: "project-secrets-request.component.html",
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
export class ProjectSecretsRequestComponent {
  protected readonly AgentAccessConsequence = AgentAccessConsequence;

  private readonly dialogRef = inject<DialogRef<ProjectSecretsRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  protected readonly params = inject<ProjectSecretsRequestParams>(DIALOG_DATA);

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

  /** See the `entries` doc comment on `ProjectSecretsRequestParams` for why this is still shown
   *  at the cap even though this path never actually truncates a true-over-200 release. */
  protected readonly isTruncated = this.params.entries.length >= MAX_PROJECT_SECRETS_ENTRIES;

  static open(dialogService: DialogService, params: ProjectSecretsRequestParams) {
    return dialogService.open<ProjectSecretsRequestResult, ProjectSecretsRequestParams>(
      ProjectSecretsRequestComponent,
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
