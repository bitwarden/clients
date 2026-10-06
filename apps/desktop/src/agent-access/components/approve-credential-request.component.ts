import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  TypographyModule,
  RadioButtonModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AGENT_LOGOS } from "../icons";
import { AgentAccessConsequence } from "../models/agent-access-consequence";
import { AgentAccessDeliveryMode } from "../models/agent-access-delivery-mode";
import { CredentialQueryType } from "../models/credential-query-type";
import { resolveAgentBrand } from "../utils/agent-brand.util";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

import { AgentAccessRequestDialogComponent } from "./shared/agent-access-request-dialog.component";
import { AgentAccessRequesterView } from "./shared/agent-access-requester.component";

/** Presence-only flags — never the actual field values — for the "fields shared" summary. */
export interface CredentialFieldsShared {
  username: boolean;
  password: boolean;
  totp: boolean;
  uri: boolean;
}

/**
 * One active login cipher that matched the request's query. `username` is shown only so the user
 * can tell candidates apart in the picker (e.g. three github.com logins) — it renders solely in
 * this desktop-local approval UI, is never sent anywhere, and is never the password/TOTP/notes
 * value.
 */
export interface CredentialLoginMatch {
  kind: "credential";
  cipherId: string;
  cipherName: string;
  username?: string;
  fieldsShared: CredentialFieldsShared;
}

/**
 * One Secrets Manager secret that matched the request's query (agent-access-architecture.md,
 * "M4"). `organizationName` is shown so the user can tell same-named secrets in different orgs
 * apart. Unlike the credential path there is no per-field picker — a secret request always shares
 * exactly `["value"]`, so no `fieldsShared` flags are needed here.
 *
 * `organizationName` alone is not always enough to disambiguate: Secrets Manager enforces
 * secret-name uniqueness *per project*, not per organization, and the lookup that produces these
 * matches (`AgentAccessSecretsService.findSecrets`) lists secrets org-wide across every project —
 * so two secrets can share both `secretName` AND `organizationName` while living in different
 * projects of the same org. `projectId`/`projectName` — plumbed through from
 * `AgentAccessSecretsService`'s `SmSecretMatch` via `DesktopAgentAccessService`'s
 * `SecretCandidate` — are the actual disambiguator for that case. Both are optional: Secrets
 * Manager allows project-less secrets, so a match may carry neither; a consumer that needs a
 * guaranteed-unique display string should fall back to a shortened id when both are absent.
 */
export interface SecretMatch {
  kind: "secret";
  secretId: string;
  secretName: string;
  organizationName?: string;
  projectId?: string;
  projectName?: string;
}

/** Discriminated union so one dialog renders either resource kind (agent-access-architecture.md,
 *  "M4" — Secrets Manager secrets over user auth). */
export type CredentialMatch = CredentialLoginMatch | SecretMatch;

export interface ApproveCredentialRequestParams {
  /** Friendly agent name reported by the requester, if any. Falls back to a shortened
   *  fingerprint, then to a generic "unknown application" label when neither is present — a
   *  local-origin request never carries a fingerprint (see napi's `CredentialRequestData` docs),
   *  and `requesterName` derivation can itself fail to attest anything recognizable. */
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
  queryType: CredentialQueryType;
  queryValue: string;
  /**
   * How the requester wants an approved credential delivered (see
   * `AgentAccessDeliveryMode`'s doc). Only ever set for a credential-kind request — a secret
   * request carries no delivery mode at all, so this is left `undefined` for `resolveSecretRequest`
   * and the dialog keeps its existing full-disclosure copy. Drives the reference-mode reassurance
   * copy below (`isReferenceMode`): reference mode is the one case where the dialog can truthfully
   * promise the password never leaves this device.
   */
  deliveryMode?: AgentAccessDeliveryMode;
  /**
   * Every candidate that matched the query — either active login ciphers or Secrets Manager
   * secrets, never a mix — with their response payloads already built (see
   * `DesktopAgentAccessService.lookupCredential`/`lookupSecret`) so the item shown here is exactly
   * the one released — never empty, since a zero-match request is denied before this dialog opens.
   */
  matches: CredentialMatch[];
  /**
   * Whether the lookup that produced `matches` actually cut more matches off at its cap
   * (`MAX_CREDENTIAL_MATCHES` in `desktop-agent-access.service.ts` for the credential path;
   * `MAX_SM_MATCHES` in `agent-access-secrets.service.ts` for the secret path) — computed by the
   * lookup path itself, which sees the full, uncapped candidate list before applying the cap and
   * so can know this precisely, rather than inferred here from `matches.length` landing on the
   * cap (a request with exactly that many genuine matches and no truncation would otherwise show
   * a false caveat — see `ResolvedCandidates`'s doc in `desktop-agent-access.service.ts`; both the
   * credential path (`findCiphers`) and the secret path (`AgentAccessSecretsService.matchSecrets`)
   * report this exactly, not as a heuristic).
   */
  matchesTruncated: boolean;
}

export interface ApproveCredentialRequestResult {
  approved: boolean;
  /** The cipher's or secret's id the user picked (`cipherId`/`secretId`). Set only when
   *  `approved` is true. */
  selectedId?: string;
}

/** Shortens a secretId to a stable, compact fallback disambiguator for a match whose
 *  `projectName` is absent — a project-less secret, or a project-name decrypt failure that
 *  degrades to absent rather than failing the secret (see `SecretMatch`'s doc). Not
 *  cryptographically meaningful, just enough of the id that two identically-named,
 *  identically-orged secrets never render identically. Mirrors `shortenFingerprint`'s shape. */
function shortenSecretId(secretId: string): string {
  return `${secretId.slice(0, 8)}…`;
}

@Component({
  selector: "app-approve-credential-request",
  templateUrl: "approve-credential-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    I18nPipe,
    ButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    TypographyModule,
    RadioButtonModule,
    AgentAccessRequestDialogComponent,
  ],
})
export class ApproveCredentialRequestComponent {
  protected readonly CredentialQueryType = CredentialQueryType;

  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject<DialogRef<ApproveCredentialRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  protected readonly params = inject<ApproveCredentialRequestParams>(DIALOG_DATA);

  // Null-safe: `requesterFingerprint` is optional (never present on a local-origin request), and
  // falling back to `.slice(0, 6)` on `undefined` used to throw during dialog construction —
  // silently killing the request through to the Rust-side 60s timeout instead of showing this
  // dialog at all. `shortenFingerprint()` already handles the null/undefined case.
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

  protected readonly hasMultipleMatches = this.params.matches.length > 1;

  /** `matches` is never a mix of kinds (see `ApproveCredentialRequestParams.matches`'s doc), so
   *  the first entry's kind speaks for the whole request — drives the dialog title, the grade,
   *  and which per-match detail renders. */
  protected readonly isSecretRequest = this.params.matches[0].kind === "secret";

  protected readonly dialogTitle = this.i18nService.t(
    this.isSecretRequest ? "agentAccessApprovalTitleSecret" : "agentAccessApprovalTitleCredential",
  );

  /** True only for a credential-kind request explicitly delivered in reference mode — the one
   *  case where the dialog can truthfully promise the password never leaves this device. Secret
   *  requests carry no delivery mode at all (see `ApproveCredentialRequestParams.deliveryMode`'s
   *  doc), so this is always false for them and they keep the existing full-disclosure copy. */
  protected readonly isReferenceMode =
    this.params.deliveryMode === AgentAccessDeliveryMode.Reference;

  /**
   * The consequence grade, set explicitly per resource kind rather than inferred from
   * `deliveryMode` (agent-access-design-spec.md §3.3, BUG 2 — `resolveSecretRequest` never sets
   * `deliveryMode` at all, so inferring the grade from it left the secret path permanently on the
   * `warning` callout with no warning text behind it). A secret request is always `disclose` — a
   * value leaves the device. A credential request is `disclose` unless it's in reference mode, in
   * which case it's `metadata` — the password genuinely never leaves this device.
   */
  protected readonly grade: AgentAccessConsequence = this.isSecretRequest
    ? AgentAccessConsequence.Disclose
    : this.isReferenceMode
      ? AgentAccessConsequence.Metadata
      : AgentAccessConsequence.Disclose;

  /** One sentence naming precisely what crosses the boundary for this resource kind/mode — see
   *  the grade doc above for why this is set explicitly per kind rather than derived from a field
   *  the secret path never populates. */
  protected readonly consequenceSummary: string = this.isSecretRequest
    ? this.i18nService.t("agentAccessSecretDiscloseSummary")
    : this.isReferenceMode
      ? this.i18nService.t("agentAccessCredentialMetadataSummary")
      : this.i18nService.t("agentAccessCredentialDiscloseSummary");

  /** Whether the match list was actually truncated — reported by the lookup path itself (see
   *  `ApproveCredentialRequestParams.matchesTruncated`'s doc), not inferred here from
   *  `matches.length`. */
  protected readonly matchesTruncated = this.params.matchesTruncated;

  /** Caveat line under the consequence band — only rendered when the match list was truncated
   *  upstream (agent-access-design-spec.md §3.3 — "a silently truncated list misrepresents what
   *  matched"). */
  protected readonly consequenceDetail: string | undefined = this.matchesTruncated
    ? this.i18nService.t("agentAccessMatchesTruncatedDetail")
    : undefined;

  /** The id that identifies a match regardless of kind — `cipherId` for a credential, `secretId`
   *  for a secret. Used for the radio value/tracking and to correlate the form's selection back
   *  to a match. */
  protected static matchId(match: CredentialMatch): string {
    return match.kind === "credential" ? match.cipherId : match.secretId;
  }

  protected readonly approveCredentialRequestForm = this.formBuilder.group({
    selectedId: [
      this.params.matches.length === 1
        ? ApproveCredentialRequestComponent.matchId(this.params.matches[0])
        : null,
      this.hasMultipleMatches ? [Validators.required] : [],
    ],
  });

  /** Tracks the radio selection so the single-match display (and, eventually, the approved id on
   *  submit) reflects the highlighted match. Per-match detail itself lives inside each radio card
   *  now (agent-access-design-spec.md §3.3, BUG 3), not gated on this signal, so nothing appears
   *  or disappears as the selection changes. */
  private readonly selectedId = toSignal(
    this.approveCredentialRequestForm.controls.selectedId.valueChanges,
    { initialValue: this.approveCredentialRequestForm.controls.selectedId.value },
  );

  protected readonly selectedMatch = computed(() =>
    this.params.matches.find(
      (match) => ApproveCredentialRequestComponent.matchId(match) === this.selectedId(),
    ),
  );

  protected matchId(match: CredentialMatch): string {
    return ApproveCredentialRequestComponent.matchId(match);
  }

  /** One sentence naming exactly which fields a given credential match will share — folds what
   *  used to be a bulleted list into prose so it can live inside each radio card without pushing
   *  the whole picker out of the "one grade of consequence" system (agent-access-design-spec.md
   *  §2). Field labels come from the same generic `username`/`password`/`verificationCode`/`uri`
   *  keys the cipher form itself uses. */
  protected credentialFieldsSummary(match: CredentialLoginMatch): string {
    const fields: string[] = [];
    if (match.fieldsShared.username) {
      fields.push(this.i18nService.t("username"));
    }
    if (match.fieldsShared.password) {
      fields.push(this.i18nService.t("password"));
    }
    if (match.fieldsShared.totp) {
      fields.push(this.i18nService.t("verificationCode"));
    }
    if (match.fieldsShared.uri) {
      fields.push(this.i18nService.t("uri"));
    }
    return this.i18nService.t("agentAccessCredentialFieldsSummary", fields.join(", "));
  }

  /** The project half of a secret card's disambiguating line (agent-access-design-spec.md §3.3,
   *  BUG 1) — the actual reported defect. Two secrets can share both `secretName` and
   *  `organizationName` while living in different projects of the same org (Secrets Manager
   *  enforces name-uniqueness per project, not per org), so `projectName` is what tells the two
   *  cards apart. It can legitimately be absent (a project-less secret, or a project-name decrypt
   *  failure that degrades to absent rather than failing the secret — see `SecretMatch`'s doc),
   *  so this falls back to a shortened, guaranteed-unique `secretId` rather than ever rendering
   *  the same text for two different secrets. */
  protected secretProjectLabel(match: SecretMatch): string {
    return match.projectName ?? shortenSecretId(match.secretId);
  }

  static open(dialogService: DialogService, params: ApproveCredentialRequestParams) {
    return dialogService.open<ApproveCredentialRequestResult, ApproveCredentialRequestParams>(
      ApproveCredentialRequestComponent,
      { data: params },
    );
  }

  readonly submit = async () => {
    if (this.approveCredentialRequestForm.invalid) {
      this.approveCredentialRequestForm.markAllAsTouched();
      return;
    }

    const selectedId = this.approveCredentialRequestForm.value.selectedId ?? undefined;
    await this.dialogRef.close({ approved: true, selectedId });
  };

  readonly deny = async () => {
    await this.dialogRef.close({ approved: false });
  };
}
