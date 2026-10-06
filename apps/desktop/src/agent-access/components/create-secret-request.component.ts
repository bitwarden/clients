import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { from, map, of, startWith, switchMap } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  IconButtonModule,
  DialogService,
  TypographyModule,
  FormFieldModule,
  SelectModule,
  IconComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AGENT_LOGOS } from "../icons";
import { AgentAccessConsequence } from "../models/agent-access-consequence";
import {
  AgentAccessSecretsService,
  SmProjectMatch,
} from "../services/agent-access-secrets.service";
import { resolveAgentBrand } from "../utils/agent-brand.util";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

import { AgentAccessRequestDialogComponent } from "./shared/agent-access-request-dialog.component";
import { AgentAccessRequesterView } from "./shared/agent-access-requester.component";

/** Selected in the project `bit-select` to reveal the "new project name" input, instead of
 *  picking an existing project. Never a legal project id (see `deriveAgentAccessAttestationKey`
 *  and sibling models for the same "sentinel string, not a real identifier" pattern). */
const NEW_PROJECT_SENTINEL = "__agent-access-new-project__";

export interface CreateSecretRequestParams {
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
  /** The agent's proposed secret. Display-only everywhere in this dialog: if the user wants a
   *  different name or value, they deny and the agent can re-request (agent-access-architecture
   *  .md, "M4b" — "the item shown here is exactly the one released/created"). */
  secretName: string;
  /** The agent-supplied value. Absent when {@link generated} is set — in that case Bitwarden
   *  generates the value at approval time and it never crosses into this process at all
   *  (agent-access-architecture.md, "M6": "generated inside the desktop app ... never shown to
   *  you"). Mutually exclusive with `generated`. */
  secretValue?: string;
  /** Set instead of `secretValue` for a `generate: true` create request (M6). The dialog shows a
   *  static notice — never a value, generated or otherwise — in its place. */
  generated?: { length?: number; symbols?: boolean };
  secretNote?: string;
  /** Optional project-name HINT from the agent — never trusted silently; only ever used to
   *  preselect a `write === true` project whose *decrypted* name matches exactly. */
  projectHint?: string;
  /** SM-enabled organizations the account can create secrets in. Never empty — the caller denies
   *  before opening this dialog when there are none. */
  organizations: Organization[];
  userId: UserId;
  /** Session-remembered last choice (in-memory only, held by `DesktopAgentAccessService`), used
   *  to preselect this dialog the same way a returning user would expect — never persisted past
   *  the app session, and never trusted over an explicit user pick. */
  lastOrganizationId?: string;
  lastProjectId?: string;
}

export interface CreateSecretRequestResult {
  approved: boolean;
  organizationId?: string;
  /** Set when an existing project was chosen. Mutually exclusive with `newProjectName`. */
  projectId?: string;
  /** Set when the user typed a name for a brand-new project instead of picking an existing one.
   *  Mutually exclusive with `projectId`. */
  newProjectName?: string;
}

/**
 * Approval dialog for a `secretCreate` request (agent-access-architecture.md, "M4b — secret
 * creation"). Distinct from `ApproveCredentialRequestComponent`: there is nothing to pick from
 * multiple matches here (there's exactly one proposed secret), but there IS a destination to
 * choose — the organization and, usually, the project the new secret is created in.
 *
 * SECURITY: the proposed value is masked by default (reveal toggle, same
 * `bitPasswordInputToggle` pattern used for password fields elsewhere in the component library)
 * — the value already crossed into this process's memory (the native layer holds it in a
 * `Zeroizing` buffer only until Electron needs it to render this dialog), but it should not sit
 * on screen by default just because a dialog is open. Never editable: what the agent proposed is
 * what gets created, or the user denies (agent-access-desktop-plan.md, "What is already
 * correct" — displayed payload = released payload).
 *
 * Grade `change` (agent-access-design-spec.md §2.1, §3.2): this dialog creates vault content but
 * discloses nothing that already existed — the reveal toggle is the one sanctioned exception to
 * "never render a value" (spec §2.3), because the value being shown is one the agent itself just
 * supplied, not something read out of the vault. The `generated` branch is a step further still:
 * a generated value is produced inside this process and never crosses back to the agent at all,
 * so there is nothing to reveal — see the quiet reassurance notice in the template.
 */
@Component({
  selector: "app-create-secret-request",
  templateUrl: "create-secret-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    I18nPipe,
    ButtonModule,
    IconButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    TypographyModule,
    FormFieldModule,
    SelectModule,
    IconComponent,
    AgentAccessRequestDialogComponent,
  ],
})
export class CreateSecretRequestComponent {
  protected readonly NEW_PROJECT_SENTINEL = NEW_PROJECT_SENTINEL;

  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject<DialogRef<CreateSecretRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  private readonly agentAccessSecretsService = inject(AgentAccessSecretsService);
  protected readonly params = inject<CreateSecretRequestParams>(DIALOG_DATA);

  // Same null-safe fallback chain as `ApproveCredentialRequestComponent` — never throws when
  // `requesterFingerprint` is absent (always true for a local-origin request).
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

  /** Always `change` — creating a secret modifies vault contents but discloses nothing that
   *  already existed, regardless of whether the value was agent-supplied or generated in-process
   *  (agent-access-design-spec.md §2.1, §3.2). */
  protected readonly grade: AgentAccessConsequence = AgentAccessConsequence.Change;

  protected readonly consequenceSummary = this.i18nService.t(
    "agentAccessCreateSecretConsequenceSummary",
  );

  private readonly initialOrganizationId = (
    (this.params.lastOrganizationId != null &&
    this.params.organizations.some((org) => org.id === this.params.lastOrganizationId)
      ? this.params.lastOrganizationId
      : undefined) ??
    (this.params.organizations.length === 1 ? this.params.organizations[0].id : undefined)
  )?.toString();

  protected readonly createSecretRequestForm = this.formBuilder.group({
    organizationId: [this.initialOrganizationId ?? null, Validators.required],
    projectId: [null as string | null],
    newProjectName: [""],
  });

  private readonly organizationId = toSignal(
    this.createSecretRequestForm.controls.organizationId.valueChanges,
    { initialValue: this.createSecretRequestForm.controls.organizationId.value },
  );

  protected readonly selectedOrganization = computed(() =>
    this.params.organizations.find((org) => org.id === this.organizationId()),
  );

  /** An admin's project-less secret is still created (server-side relaxation), but it's visible
   *  to organization admins only — the dialog must say so whenever no project is selected under
   *  this relaxation (M4b server facts). */
  protected readonly isAdminRelaxed = computed(() => this.selectedOrganization()?.isAdmin === true);

  private readonly projectIdValue = toSignal(
    this.createSecretRequestForm.controls.projectId.valueChanges,
    { initialValue: this.createSecretRequestForm.controls.projectId.value },
  );

  protected readonly creatingNewProject = computed(
    () => this.projectIdValue() === NEW_PROJECT_SENTINEL,
  );

  /** No project selected at all — legal only when `isAdminRelaxed()`; the template disables
   *  submit otherwise via the dynamic validator below. */
  protected readonly noProjectSelected = computed(
    () => !this.creatingNewProject() && !this.projectIdValue(),
  );

  /** Every `write === true` project in the selected organization, decrypted-name-eligible (M4b:
   *  only a project the user has Write on is a legal creation target). Reloads whenever the
   *  organization selection changes; a project-lookup failure degrades to an empty list rather
   *  than throwing (see `AgentAccessSecretsService.listProjects`, which never throws itself). */
  protected readonly projects = toSignal(
    this.createSecretRequestForm.controls.organizationId.valueChanges.pipe(
      startWith(this.createSecretRequestForm.controls.organizationId.value),
      switchMap((organizationId) =>
        organizationId
          ? from(
              this.agentAccessSecretsService.listProjects(organizationId, this.params.userId),
            ).pipe(map((all) => all.filter((project) => project.write)))
          : of<SmProjectMatch[]>([]),
      ),
    ),
    { initialValue: [] as SmProjectMatch[] },
  );

  constructor() {
    // Preselects a project once, the first time this organization's project list resolves:
    // the session-remembered last project if it's still a legal (write === true) target for
    // this org, else the `projectHint` on an exact decrypted-name match. Never re-applied after
    // the user has made their own choice or switched organizations — `hintApplied` latches after
    // the first non-empty project list, regardless of whether either preselect actually matched.
    let hintApplied = false;
    effect(() => {
      const projects = this.projects();
      if (hintApplied || projects.length === 0) {
        return;
      }
      hintApplied = true;

      const remembered = this.params.lastProjectId
        ? projects.find((project) => project.id === this.params.lastProjectId)
        : undefined;
      const hinted = this.params.projectHint
        ? projects.find((project) => project.name === this.params.projectHint)
        : undefined;
      const preselected = remembered ?? hinted;
      if (preselected != null) {
        this.createSecretRequestForm.controls.projectId.setValue(preselected.id);
      }
    });
  }

  static open(dialogService: DialogService, params: CreateSecretRequestParams) {
    return dialogService.open<CreateSecretRequestResult, CreateSecretRequestParams>(
      CreateSecretRequestComponent,
      { data: params },
    );
  }

  readonly submit = async () => {
    if (this.createSecretRequestForm.invalid) {
      this.createSecretRequestForm.markAllAsTouched();
      return;
    }
    // A project is required unless the selected org's admin relaxation applies — the reactive
    // form's own validators don't know about `isAdminRelaxed()` (it depends on which org is
    // selected), so this is enforced here rather than via a static `Validators.required` on
    // `projectId`.
    if (this.noProjectSelected() && !this.isAdminRelaxed()) {
      this.createSecretRequestForm.markAllAsTouched();
      return;
    }

    const organizationId = this.createSecretRequestForm.value.organizationId ?? undefined;
    const projectIdValue = this.createSecretRequestForm.value.projectId;

    if (projectIdValue === NEW_PROJECT_SENTINEL) {
      const newProjectName = this.createSecretRequestForm.value.newProjectName?.trim();
      if (!newProjectName) {
        this.createSecretRequestForm.markAllAsTouched();
        return;
      }
      await this.dialogRef.close({ approved: true, organizationId, newProjectName });
      return;
    }

    await this.dialogRef.close({
      approved: true,
      organizationId,
      projectId: projectIdValue || undefined,
    });
  };

  readonly deny = async () => {
    await this.dialogRef.close({ approved: false });
  };
}
