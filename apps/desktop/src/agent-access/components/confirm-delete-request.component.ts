import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AGENT_LOGOS } from "../icons";
import { AgentAccessConsequence } from "../models/agent-access-consequence";
import { AgentAccessResourceType } from "../models/agent-access-resource-type";
import { resolveAgentBrand } from "../utils/agent-brand.util";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

import { AgentAccessRequestDialogComponent } from "./shared/agent-access-request-dialog.component";
import { AgentAccessRequesterView } from "./shared/agent-access-requester.component";

export interface ConfirmDeleteRequestParams {
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
  kind: typeof AgentAccessResourceType.Secret | typeof AgentAccessResourceType.Project;
  /** The item's CURRENT decrypted name, resolved before this dialog opened. */
  itemName: string;
  organizationName?: string;
  /** Only ever set for `kind: "project"`, and only when the count could be resolved
   *  (`AgentAccessSecretsService.countSecretsInProject` degrades to `undefined` on failure —
   *  the dialog then warns without a number rather than blocking the flow). */
  containedSecretCount?: number;
}

export interface ConfirmDeleteRequestResult {
  approved: boolean;
}

/**
 * Shared delete-confirmation dialog for `secretDelete`/`projectDelete` requests
 * (agent-access-architecture.md, "M6-D"). One component for both resource kinds because the shape
 * is identical (requester identity + item name + a danger-styled confirm) — only the consequence
 * copy differs, and it must be TRUTHFUL (invariant 17): a secret delete is a soft SM-trash move an
 * org admin can restore; a project delete is permanent and orphans any contained secrets (they lose
 * the project but are not themselves deleted, though they may become inaccessible to non-admin
 * users). Never understates either consequence — and never overstates the project case into
 * claiming the contained secrets are deleted, which they are not.
 *
 * The only `destroy`-grade dialog in the Agent Access family
 * (agent-access-design-spec.md §2.1/§3.2) — it adopts `app-agent-access-request-dialog` (§7) with
 * a fixed `AgentAccessConsequence.Destroy` grade for both branches (both close a danger-styled
 * confirm), while the consequence band's summary/detail text is what carries the truthful
 * distinction between "recoverable" (secret) and "permanent" (project).
 */
@Component({
  selector: "app-confirm-delete-request",
  templateUrl: "confirm-delete-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    I18nPipe,
    ButtonModule,
    AsyncActionsModule,
    TypographyModule,
    AgentAccessRequestDialogComponent,
  ],
})
export class ConfirmDeleteRequestComponent {
  protected readonly AgentAccessResourceType = AgentAccessResourceType;
  protected readonly AgentAccessConsequence = AgentAccessConsequence;

  private readonly dialogRef = inject<DialogRef<ConfirmDeleteRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  protected readonly params = inject<ConfirmDeleteRequestParams>(DIALOG_DATA);

  protected readonly requesterDisplayName =
    this.params.requesterName?.trim() ||
    (this.params.requesterFingerprint
      ? shortenFingerprint(this.params.requesterFingerprint)
      : this.i18nService.t("agentAccessUnknownApplication"));

  protected readonly isProject = computed(
    () => this.params.kind === AgentAccessResourceType.Project,
  );

  /** The known agent behind a *verified* signature, or `undefined` for an unrecognized/unverified
   *  requester — decoration only, never a factor in what's authorized (see `resolveAgentBrand`'s
   *  contract). SECURITY: resolved from `params.signature*` only; `params.requesterName` is
   *  self-reported and must never influence this (agent-access-design-spec.md §7.5.2). */
  protected readonly brand = resolveAgentBrand(this.params);

  /** Brand mark for the resolved agent; `undefined` renders the neutral `bwi-terminal` glyph. */
  protected readonly brandLogo = this.brand == null ? undefined : AGENT_LOGOS[this.brand];

  /** WHO is asking (spec §2). As of agent-access-design-spec.md §7.5.2 the attested code-signature
   *  now flows into this dialog too, so `brandLogo` resolves exactly the way it does on every
   *  other request dialog (see `brand`/`brandLogo` above) — gated on `signatureValid === true`,
   *  never on the self-reported `requesterName`. `descriptor`/`unverified` remain unset: this
   *  dialog never showed a "signed by"/"published by" line or an unverified-signature warning
   *  strip, and that is unchanged — only the missing logo was the gap. Absent a verified
   *  signature, `brandLogo` is `undefined` and the shared requester block renders the neutral
   *  glyph with no second line, exactly as it did before this migration. */
  protected readonly requesterView = computed<AgentAccessRequesterView>(() => ({
    name: this.requesterDisplayName,
    brandLogo: this.brandLogo,
  }));

  protected readonly dialogTitle = computed(() =>
    this.i18nService.t(
      this.isProject()
        ? "agentAccessDeleteProjectRequestTitle"
        : "agentAccessDeleteSecretRequestTitle",
    ),
  );

  /** WHAT happens if I say yes (spec §2) — one truthful sentence per branch. A secret delete is a
   *  soft, recoverable trash move; a project delete is permanent. Both are `destroy`-graded, but
   *  the sentence itself is what tells the two apart, per the design spec's instruction not to
   *  flatten these into one warning. */
  protected readonly consequenceSummary = computed(() =>
    this.i18nService.t(
      this.isProject()
        ? "agentAccessDeleteProjectPermanentWarning"
        : "agentAccessDeleteSecretTrashNotice",
    ),
  );

  /** Second, muted line — only ever populated for a project delete, where the contained-secret
   *  count (or its absence) is itself part of the consequence: "12 secrets will lose this
   *  project" and "we couldn't count them" are different warnings and both matter (spec, Dialog
   *  1). `undefined` for a secret delete renders no second line. */
  protected readonly consequenceDetail = computed(() => {
    if (!this.isProject()) {
      return undefined;
    }
    return this.params.containedSecretCount != null
      ? this.i18nService.t(
          "agentAccessDeleteProjectContainedSecretsWarning",
          this.params.containedSecretCount,
        )
      : this.i18nService.t("agentAccessDeleteProjectContainedSecretsUnknownWarning");
  });

  static open(dialogService: DialogService, params: ConfirmDeleteRequestParams) {
    return dialogService.open<ConfirmDeleteRequestResult, ConfirmDeleteRequestParams>(
      ConfirmDeleteRequestComponent,
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
