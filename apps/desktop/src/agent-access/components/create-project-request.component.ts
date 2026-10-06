import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconComponent,
  TypographyModule,
  FormFieldModule,
  SelectModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AGENT_LOGOS } from "../icons";
import { AgentAccessConsequence } from "../models/agent-access-consequence";
import { resolveAgentBrand } from "../utils/agent-brand.util";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

import { AgentAccessRequestDialogComponent } from "./shared/agent-access-request-dialog.component";
import { AgentAccessRequesterView } from "./shared/agent-access-requester.component";

export interface CreateProjectRequestParams {
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
  /** `"create"` (default) shows an organization picker for a brand-new project.
   *  `"rename"` shows a from -> to summary for an existing project already in a known org — no
   *  organization picker, since the project's org never changes on a rename. */
  mode?: "create" | "rename";
  /** `create` mode: the agent's proposed name. `rename` mode: the project's CURRENT name. */
  projectName: string;
  /** `rename` mode only: the agent's proposed new name. */
  newProjectName?: string;
  /** `create` mode only: SM-enabled organizations to create in. Never empty — the caller denies
   *  before opening this dialog when there are none. Ignored (and may be empty) in `rename`
   *  mode. */
  organizations: Organization[];
  lastOrganizationId?: string;
  userId: UserId;
}

export interface CreateProjectRequestResult {
  approved: boolean;
  /** `create` mode only — the organization the new project was approved into. */
  organizationId?: string;
}

/**
 * Approval dialog for a `projectCreate` request, and (via `mode: "rename"`) for a `projectUpdate`
 * rename request — one component for both (agent-access-architecture.md, "M6-D": "D's choice, but
 * ONE simple component for both is preferred over a fourth dialog"), since a rename is just a
 * create with the organization already fixed and a from -> to summary instead of a picker.
 *
 * Grade `change` in both modes (agent-access-design-spec.md §2.1, §3.2): creating or renaming a
 * project modifies vault contents but discloses nothing that already existed. The two modes still
 * differ in copy and submit-gating below — creating chooses a destination organization and gates
 * on form validity; renaming has no organization to pick (a project's org never changes) and
 * approves unconditionally.
 */
@Component({
  selector: "app-create-project-request",
  templateUrl: "create-project-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    I18nPipe,
    ButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    IconComponent,
    TypographyModule,
    FormFieldModule,
    SelectModule,
    AgentAccessRequestDialogComponent,
  ],
})
export class CreateProjectRequestComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject<DialogRef<CreateProjectRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  protected readonly params = inject<CreateProjectRequestParams>(DIALOG_DATA);

  protected readonly requesterDisplayName =
    this.params.requesterName?.trim() ||
    (this.params.requesterFingerprint
      ? shortenFingerprint(this.params.requesterFingerprint)
      : this.i18nService.t("agentAccessUnknownApplication"));

  protected readonly isRename = computed(() => this.params.mode === "rename");

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

  /** Always `change` — creating or renaming a project modifies vault contents but discloses
   *  nothing that already existed (agent-access-design-spec.md §2.1, §3.2). */
  protected readonly grade: AgentAccessConsequence = AgentAccessConsequence.Change;

  protected readonly dialogTitle = this.i18nService.t(
    this.isRename()
      ? "agentAccessProjectRenameRequestTitle"
      : "agentAccessProjectCreateRequestTitle",
  );

  protected readonly consequenceSummary = this.i18nService.t(
    this.isRename()
      ? "agentAccessProjectRenameConsequenceSummary"
      : "agentAccessProjectCreateConsequenceSummary",
  );

  private readonly initialOrganizationId = (
    (this.params.lastOrganizationId != null &&
    this.params.organizations.some((org) => org.id === this.params.lastOrganizationId)
      ? this.params.lastOrganizationId
      : undefined) ??
    (this.params.organizations.length === 1 ? this.params.organizations[0].id : undefined)
  )?.toString();

  protected readonly createProjectRequestForm = this.formBuilder.group({
    organizationId: [
      this.isRename() ? null : (this.initialOrganizationId ?? null),
      this.isRename() ? [] : [Validators.required],
    ],
  });

  protected readonly organizationIdValue = toSignal(
    this.createProjectRequestForm.controls.organizationId.valueChanges,
    { initialValue: this.createProjectRequestForm.controls.organizationId.value },
  );

  static open(dialogService: DialogService, params: CreateProjectRequestParams) {
    return dialogService.open<CreateProjectRequestResult, CreateProjectRequestParams>(
      CreateProjectRequestComponent,
      { data: params },
    );
  }

  readonly submit = async () => {
    if (this.isRename()) {
      await this.dialogRef.close({ approved: true });
      return;
    }

    if (this.createProjectRequestForm.invalid) {
      this.createProjectRequestForm.markAllAsTouched();
      return;
    }

    await this.dialogRef.close({
      approved: true,
      organizationId: this.createProjectRequestForm.value.organizationId ?? undefined,
    });
  };

  readonly deny = async () => {
    await this.dialogRef.close({ approved: false });
  };
}
