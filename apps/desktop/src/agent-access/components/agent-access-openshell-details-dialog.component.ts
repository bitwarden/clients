import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

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
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  OPENSHELL_MAX_PURPOSE_CHARS,
  OPENSHELL_META_COLORS,
  OpenShellMetaColor,
  OpenShellSandboxMeta,
} from "../models/openshell-environments";
import {
  OPENSHELL_META_COLOR_CLASS,
  OPENSHELL_META_COLOR_KEY,
} from "../utils/openshell-environments.util";

export interface AgentAccessOpenShellDetailsDialogParams {
  sandboxName: string;
  meta: OpenShellSandboxMeta | null;
}

/**
 * Edits what the user knows about a sandbox: a one-line purpose and an accent color, kept by this
 * app (never on the gateway). Saving both empty clears the entry. Closes with the saved metadata
 * (`null` when cleared) or `undefined` when cancelled.
 */
@Component({
  selector: "app-agent-access-openshell-details-dialog",
  templateUrl: "agent-access-openshell-details-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    ReactiveFormsModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellDetailsDialogComponent {
  private readonly params = inject<AgentAccessOpenShellDetailsDialogParams>(DIALOG_DATA);
  private readonly dialogRef =
    inject<DialogRef<OpenShellSandboxMeta | null | undefined>>(DialogRef);
  private readonly i18nService = inject(I18nService);

  protected readonly sandboxName = this.params.sandboxName;
  protected readonly maxChars = OPENSHELL_MAX_PURPOSE_CHARS;
  protected readonly colors = OPENSHELL_META_COLORS;
  protected readonly colorClass = OPENSHELL_META_COLOR_CLASS;
  protected readonly colorKey = OPENSHELL_META_COLOR_KEY;

  protected readonly color = signal<OpenShellMetaColor | null>(this.params.meta?.color ?? null);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).group({
    purpose: [this.params.meta?.purpose ?? ""],
  });

  static open(dialogService: DialogService, params: AgentAccessOpenShellDetailsDialogParams) {
    return dialogService.open<
      OpenShellSandboxMeta | null | undefined,
      AgentAccessOpenShellDetailsDialogParams
    >(AgentAccessOpenShellDetailsDialogComponent, { data: params });
  }

  protected setColor(color: OpenShellMetaColor | null): void {
    this.color.set(color);
  }

  protected readonly submit = async () => {
    this.errorMessage.set(null);
    const purpose = this.form.controls.purpose.value ?? "";
    const color = this.color();
    const result = await ipc.agentAccess.setOpenShellSandboxMeta({
      name: this.sandboxName,
      purpose,
      color,
    });
    if (!result.ok) {
      this.errorMessage.set(
        result.message?.trim() || this.i18nService.t("agentAccessOsMetaErrorSave"),
      );
      return;
    }
    // Main cleans the text; the dialog reports what it sent, the caller re-reads to show the clean one.
    const cleaned = purpose.replace(/\s+/g, " ").trim().slice(0, OPENSHELL_MAX_PURPOSE_CHARS);
    await this.dialogRef.close(
      cleaned === "" && color == null ? null : { name: this.sandboxName, purpose: cleaned, color },
    );
  };
}
