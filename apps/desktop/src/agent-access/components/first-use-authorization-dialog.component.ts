import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogRef,
  DialogService,
  RadioButtonModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AGENT_LOGOS } from "../icons";
import { AgentAccessConsequence } from "../models/agent-access-consequence";
import { AgentAccessGrantScope } from "../models/agent-access-grant";
import { AGENT_DEFINITIONS } from "../models/agent-registry";
import { resolveAgentBrand } from "../utils/agent-brand.util";

import { AgentAccessRequestDialogComponent } from "./shared/agent-access-request-dialog.component";
import { AgentAccessRequesterView } from "./shared/agent-access-requester.component";

/** The two napi `SignatureKindData` members that carry an actual verified code signature —
 *  everything else (no signature captured, `linuxPathOnly`, or a signature that failed
 *  verification) falls back to the weaker path-based descriptor. Kept as local string literals,
 *  not an import of the napi ambient `const enum`, matching `CredentialQueryType`'s precedent
 *  (see its docs) for the same reason: `const enum`s have no runtime JS value to import. */
const VERIFIABLE_SIGNATURE_KIND = Object.freeze({
  MacosTeamId: "macosTeamId",
  WindowsPublisher: "windowsPublisher",
} as const);

/** Which descriptor line the template renders. Mirrors the fallback rule
 *  `deriveAgentAccessAttestationKey` uses to key the grant itself (utils/agent-access-attestation
 *  .util.ts), so what's shown here is what the grant is actually keyed on. */
type SignatureDescriptorKind = "signedBy" | "publishedBy" | "path";

export interface FirstUseAuthorizationDialogParams {
  /** Attested display name — the parent process's name if the parent-chain walk resolved it,
   *  else the immediate peer's (`aac`), else a caller-supplied localized fallback. Never
   *  self-reported by the requester (agent-access-desktop-plan.md, "What is already correct"). */
  displayName: string;
  exePath?: string;
  /** `undefined` when attestation produced no signature info at all — distinct from a
   *  signature that was captured but failed verification (`signatureValid: false`). Both cases
   *  render the same weaker "at path" descriptor; see `descriptorKind`. */
  signatureKind?: string;
  signatureIdentity?: string;
  signatureValid?: boolean;
}

export interface FirstUseAuthorizationDialogResult {
  authorized: boolean;
  /** Set only when `authorized` is true. */
  scope?: AgentAccessGrantScope;
}

/**
 * First-use authorization prompt for a local Agent Access requester — this dialog *is* the
 * pairing for local agents (agent-access-architecture.md, "Grant store (W2b)"; replaces local
 * token pairing entirely, per agent-access-desktop-plan.md §3). Shown once per attested peer; on
 * "Allow" the caller persists a grant and every request after that skips straight to the normal
 * per-request approval dialog — this is NOT a standing "always allow": that dialog still runs on
 * every subsequent request (agent-access-desktop-plan.md, W5 — no such option exists in v1).
 *
 * Copy here deliberately states only what was verified ("signed by X" / "at path Y") and never
 * claims safety: attestation is defense-in-depth, not a boundary — same-user software could still
 * act through a legitimate signed binary, or simply wait for the user to approve a request and
 * read the result (agent-access-desktop-plan.md, "Risks" — "Attestation overclaim").
 *
 * This dialog is the *source* of the design language the whole Agent Access family now shares
 * (agent-access-design-spec.md §1, fault 3 and §7): its identity block was promoted out to
 * `app-agent-access-requester` almost unchanged, and this dialog now consumes that shared
 * component (`change`-graded, per spec §3.2) instead of hand-rolling its own copy. The
 * signedBy/publishedBy/path *selection* logic (`descriptorKind` below) deliberately stays local —
 * it's per-dialog i18n, not shared chrome (§7) — but the shared component only accepts a single
 * pre-resolved, already-localized `descriptor` string, so `resolvedDescriptor` below does the
 * `i18nService.t()` call that the template used to do directly via `| i18n`.
 */
@Component({
  selector: "app-first-use-authorization-dialog",
  templateUrl: "first-use-authorization-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    I18nPipe,
    ButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    TypographyModule,
    RadioButtonModule,
    AgentAccessRequestDialogComponent,
  ],
})
export class FirstUseAuthorizationDialogComponent {
  protected readonly AgentAccessGrantScope = AgentAccessGrantScope;
  protected readonly AgentAccessConsequence = AgentAccessConsequence;

  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject<DialogRef<FirstUseAuthorizationDialogResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  protected readonly params = inject<FirstUseAuthorizationDialogParams>(DIALOG_DATA);

  // Only one scope exists in Phase 1 (agent-access-desktop-plan.md, W5's intro): "All logins",
  // pre-selected and required so the control can't submit empty. The control (rather than a
  // hardcoded literal) is what lets Phase 2 add more radio options without touching this form's
  // shape.
  protected readonly firstUseAuthorizationForm = this.formBuilder.group({
    scope: [AgentAccessGrantScope.AllLogins as AgentAccessGrantScope, Validators.required],
  });

  protected readonly descriptorKind = computed<SignatureDescriptorKind>(() => {
    if (this.params.signatureValid !== true) {
      return "path";
    }
    if (this.params.signatureKind === VERIFIABLE_SIGNATURE_KIND.MacosTeamId) {
      return "signedBy";
    }
    if (this.params.signatureKind === VERIFIABLE_SIGNATURE_KIND.WindowsPublisher) {
      return "publishedBy";
    }
    return "path";
  });

  /** True only when a signature was captured but explicitly failed verification — distinct from
   *  no signature info being available at all (e.g. Linux, or attestation couldn't run). Both
   *  render the same path descriptor; only this case additionally shows the "could not be
   *  verified" callout, since the other case never claimed to have a signature to verify. */
  protected readonly signatureInvalid = computed(
    () => this.params.signatureKind != null && this.params.signatureValid === false,
  );

  /** The known agent behind a *verified* signature, or `undefined` for an unrecognized or
   *  unverified requester. Decoration only: the brand never changes what is authorized or how the
   *  grant is keyed, and an unverified peer deliberately resolves to `undefined` so a look-alike
   *  binary cannot borrow a familiar logo (see `resolveAgentBrand`). */
  protected readonly brand = computed(() => resolveAgentBrand(this.params));

  /** Brand mark for the resolved agent; `undefined` renders the neutral terminal glyph instead. */
  protected readonly brandLogo = computed(() => {
    const brand = this.brand();
    return brand == null ? undefined : AGENT_LOGOS[brand];
  });

  /** Product name for a recognized agent ("Claude Code"), falling back to the attested process
   *  name ("claude") otherwise. Both are OS-sourced rather than self-reported: the fallback comes
   *  from `deriveAgentAccessDisplayName`, and the product name is only reached through a verified
   *  signature. */
  protected readonly requesterName = computed(() => {
    const brand = this.brand();
    return brand == null ? this.params.displayName : AGENT_DEFINITIONS[brand].displayName;
  });

  /** Value shown in the "at path" descriptor: the signature's own identity (which already falls
   *  back to the exe path for unsigned/invalid peers — see `SignatureInfoData`'s docs) if
   *  present, else the exe path directly. */
  protected readonly pathDescriptorValue = computed(
    () => this.params.signatureIdentity || this.params.exePath || "",
  );

  /** The finished, already-localized descriptor line `app-agent-access-requester` renders as-is
   *  (its `descriptor` input is a single pre-resolved string, not a kind to switch on — spec §7).
   *  `descriptorKind` above still decides WHICH sentence; this only resolves the i18n call that
   *  used to live directly in the template's `@switch`. */
  protected readonly resolvedDescriptor = computed<string>(() => {
    switch (this.descriptorKind()) {
      case "signedBy":
        return this.i18nService.t("agentAccessFirstUseSignedBy", this.params.signatureIdentity);
      case "publishedBy":
        return this.i18nService.t("agentAccessFirstUsePublishedBy", this.params.signatureIdentity);
      default:
        return this.i18nService.t("agentAccessFirstUseAtPath", this.pathDescriptorValue());
    }
  });

  /** WHO is asking (spec §2), assembled for `app-agent-access-requester` from the pieces above.
   *  `unverified` is deliberately `signatureInvalid()` and nothing broader — an unrecognized but
   *  never-signed requester is not itself alarming (see the class doc comment and the shared
   *  component's own doc comment on not training users to click through warnings that don't
   *  matter). */
  protected readonly requesterView = computed<AgentAccessRequesterView>(() => ({
    name: this.requesterName(),
    descriptor: this.resolvedDescriptor(),
    brandLogo: this.brandLogo(),
    unverified: this.signatureInvalid(),
  }));

  static open(dialogService: DialogService, params: FirstUseAuthorizationDialogParams) {
    return dialogService.open<FirstUseAuthorizationDialogResult, FirstUseAuthorizationDialogParams>(
      FirstUseAuthorizationDialogComponent,
      { data: params },
    );
  }

  readonly submit = async () => {
    if (this.firstUseAuthorizationForm.invalid) {
      this.firstUseAuthorizationForm.markAllAsTouched();
      return;
    }

    await this.dialogRef.close({
      authorized: true,
      scope: this.firstUseAuthorizationForm.value.scope ?? AgentAccessGrantScope.AllLogins,
    });
  };

  readonly deny = async () => {
    await this.dialogRef.close({ authorized: false });
  };
}
