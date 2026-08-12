import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  CalloutModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AgentAccessResourceType } from "../models/agent-access-resource-type";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

export interface ConfirmDeleteRequestParams {
  requesterName?: string;
  requesterFingerprint?: string;
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
 * the project but are not themselves deleted). Never understates either consequence.
 */
@Component({
  selector: "app-confirm-delete-request",
  templateUrl: "confirm-delete-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DialogModule,
    CommonModule,
    I18nPipe,
    ButtonModule,
    AsyncActionsModule,
    CalloutModule,
    TypographyModule,
  ],
})
export class ConfirmDeleteRequestComponent {
  protected readonly AgentAccessResourceType = AgentAccessResourceType;

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
