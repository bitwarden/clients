import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

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
  TableModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { shortenFingerprint } from "../utils/shorten-fingerprint";

export interface ProjectListRequestEntry {
  name: string;
  organizationName?: string;
  write: boolean;
}

export interface ProjectListRequestParams {
  requesterName?: string;
  requesterFingerprint?: string;
  /** Every project name this approval will release, in the exact order the response will list
   *  them — displayed in full so approving means seeing everything that goes out
   *  (agent-access-architecture.md, "M6": "the dialog shows every name being shared"). */
  entries: ProjectListRequestEntry[];
}

export interface ProjectListRequestResult {
  approved: boolean;
}

/**
 * Approval dialog for a `projectList` request (agent-access-architecture.md, "M6-D") — the one
 * list-shaped release in the whole M6 surface (invariant 16). One approval releases every entry
 * shown here, so the dialog enumerates them all rather than summarizing a count: there is no
 * per-item picker downstream the way there is for a credential/secret match list.
 */
@Component({
  selector: "app-project-list-request",
  templateUrl: "project-list-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DialogModule,
    CommonModule,
    I18nPipe,
    ButtonModule,
    AsyncActionsModule,
    CalloutModule,
    TypographyModule,
    TableModule,
  ],
})
export class ProjectListRequestComponent {
  private readonly dialogRef = inject<DialogRef<ProjectListRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  protected readonly params = inject<ProjectListRequestParams>(DIALOG_DATA);

  protected readonly requesterDisplayName =
    this.params.requesterName?.trim() ||
    (this.params.requesterFingerprint
      ? shortenFingerprint(this.params.requesterFingerprint)
      : this.i18nService.t("agentAccessUnknownApplication"));

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
