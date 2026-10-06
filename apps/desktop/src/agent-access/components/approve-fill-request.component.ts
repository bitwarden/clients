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
  DialogService,
  TypographyModule,
  RadioButtonModule,
  IconComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AGENT_LOGOS } from "../icons";
import { AgentAccessConsequence } from "../models/agent-access-consequence";
import { resolveAgentBrand } from "../utils/agent-brand.util";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

import { CredentialLoginMatch } from "./approve-credential-request.component";
import { AgentAccessRequestDialogComponent } from "./shared/agent-access-request-dialog.component";
import { AgentAccessRequesterView } from "./shared/agent-access-requester.component";

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
   * Attested code-signature facts for the requester (agent-access-design-spec.md §7.5.2), read
   * from `localPeer.signature` on the wire message — never from `requesterName`, which is
   * self-reported and must never influence which brand logo resolves. `undefined` on a relay-
   * origin request, which has no OS-verified peer at all; see `resolveAgentBrand`'s contract for
   * why an absent/invalid signature always falls back to the neutral glyph rather than a logo.
   */
  signatureKind?: string;
  signatureIdentity?: string;
  signatureValid?: boolean;
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

/** Shortens a cipherId to a stable, compact fallback disambiguator for a match with no username
 *  — mirrors `shortenSecretId` in `approve-credential-request.component.ts`, whose sibling
 *  picker has the same "two cards must never render identically" requirement
 *  (agent-access-design-spec.md §3.3, BUG 1). Not cryptographically meaningful, just enough of
 *  the id that two identically-named credentials, both without a username, never look the same. */
function shortenCipherId(cipherId: string): string {
  return `${cipherId.slice(0, 8)}…`;
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
 *
 * `disclose`-graded (spec §3.2): a real credential value leaves this device and lands in a live
 * browser page — it just never passes through the agent. The consequence band names the origin
 * the same way the dominant origin display below it does, but does not replace that display:
 * the band is one quiet sentence among several in the WHO/WHAT section, while the origin keeps
 * its own larger, `aria-live="polite"` line in the WHICH body — see that block's comment.
 */
@Component({
  selector: "app-approve-fill-request",
  templateUrl: "approve-fill-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    I18nPipe,
    ButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    TypographyModule,
    RadioButtonModule,
    IconComponent,
    AgentAccessRequestDialogComponent,
  ],
})
export class ApproveFillRequestComponent {
  protected readonly AgentAccessConsequence = AgentAccessConsequence;

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

  /** WHAT happens if I say yes (spec §2) — names the origin the fill lands on, echoing (not
   *  replacing) the dominant origin display in the body below. */
  protected readonly consequenceSummary = this.i18nService.t(
    "agentAccessFillDiscloseSummary",
    this.params.origin,
  );

  /** Second, muted line — the same "nothing reaches the agent" reassurance the old duplicated
   *  callout used to carry, now living in the band's caveat slot instead of a second title. */
  protected readonly consequenceDetail = this.i18nService.t("agentAccessFillAgentNotShownDetail");

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

  /** The picker's distinguishing second line for a match card — the username when the login has
   *  one, else a shortened, guaranteed-unique id, so two identically-named candidates (a sibling
   *  agent is fixing the equivalent bug in `approve-credential-request`'s picker, see
   *  agent-access-design-spec.md §3.3 BUG 1) never render as indistinguishable cards here either. */
  protected matchDisambiguator(match: CredentialLoginMatch): string {
    return match.username ?? shortenCipherId(match.cipherId);
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
