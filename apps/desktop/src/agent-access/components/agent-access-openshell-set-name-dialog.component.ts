import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OPENSHELL_MAX_NAME_CHARS } from "../models/openshell-environments";
import {
  OpenShellManagementError,
  OpenShellManagementResult,
} from "../models/openshell-management";

export interface AgentAccessOpenShellSetNameDialogParams {
  /** i18n key of the dialog title. */
  titleKey: string;
  initialName: string;
  /** Saves under the name. The dialog closes with `true` on success and shows the failure otherwise. */
  save: (name: string) => Promise<OpenShellManagementResult<unknown>>;
}

/**
 * Asks for one name (a secret set being saved from a sandbox, or renamed) and saves it. Only the
 * name is typed here; what the set holds is decided by the caller.
 */
@Component({
  selector: "app-agent-access-openshell-set-name-dialog",
  templateUrl: "agent-access-openshell-set-name-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    ReactiveFormsModule,
  ],
})
export class AgentAccessOpenShellSetNameDialogComponent {
  private readonly params = inject<AgentAccessOpenShellSetNameDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly i18nService = inject(I18nService);

  protected readonly titleKey = this.params.titleKey;
  protected readonly maxChars = OPENSHELL_MAX_NAME_CHARS;
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).group({
    name: [
      this.params.initialName,
      [Validators.required, Validators.maxLength(OPENSHELL_MAX_NAME_CHARS)],
    ],
  });

  static open(dialogService: DialogService, params: AgentAccessOpenShellSetNameDialogParams) {
    return dialogService.open<boolean, AgentAccessOpenShellSetNameDialogParams>(
      AgentAccessOpenShellSetNameDialogComponent,
      { data: params },
    );
  }

  protected readonly submit = async () => {
    this.errorMessage.set(null);
    const name = (this.form.controls.name.value ?? "").trim();
    if (name === "") {
      this.form.markAllAsTouched();
      return;
    }
    const result = await this.params.save(name);
    if (!result.ok) {
      this.errorMessage.set(result.message?.trim() || this.fallbackMessage(result.error));
      return;
    }
    await this.dialogRef.close(true);
  };

  private fallbackMessage(error: OpenShellManagementError): string {
    switch (error) {
      case "alreadyExists":
        return this.i18nService.t("agentAccessOsEnvErrorNameTaken");
      case "unsupported":
        return this.i18nService.t("agentAccessOsPageErrorUnsupported");
      default:
        return this.i18nService.t("agentAccessOsEnvErrorSave");
    }
  }
}
