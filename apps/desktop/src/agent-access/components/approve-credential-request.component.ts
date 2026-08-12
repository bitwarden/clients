import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

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

import { AgentAccessDeliveryMode } from "../models/agent-access-delivery-mode";
import { CredentialQueryType } from "../models/credential-query-type";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

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
 */
export interface SecretMatch {
  kind: "secret";
  secretId: string;
  secretName: string;
  organizationName?: string;
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
}

export interface ApproveCredentialRequestResult {
  approved: boolean;
  /** The cipher's or secret's id the user picked (`cipherId`/`secretId`). Set only when
   *  `approved` is true. */
  selectedId?: string;
}

@Component({
  selector: "app-approve-credential-request",
  templateUrl: "approve-credential-request.component.html",
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

  protected readonly hasMultipleMatches = this.params.matches.length > 1;

  /** True only for a credential-kind request explicitly delivered in reference mode — the one
   *  case where the dialog can truthfully promise the password never leaves this device. Secret
   *  requests carry no delivery mode at all (see `ApproveCredentialRequestParams.deliveryMode`'s
   *  doc), so this is always false for them and they keep the existing full-disclosure copy. */
  protected readonly isReferenceMode =
    this.params.deliveryMode === AgentAccessDeliveryMode.Reference;

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

  /** Tracks the radio selection so the "fields shared" summary reflects the highlighted match. */
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
