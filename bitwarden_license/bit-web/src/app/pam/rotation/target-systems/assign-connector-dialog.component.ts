import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ReactiveFormsModule, Validators, FormBuilder } from "@angular/forms";

import {
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  SelectModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessConnector, TargetSystem } from "../rotation";

export type AssignConnectorDialogParams = {
  targetSystem: TargetSystem;
  /** The enabled access connectors not yet assigned to this target system. */
  options: AccessConnector[];
  /**
   * True when the org has no enabled access connector at all, rather than all of them being
   * assigned already. Both arrive as an empty `options`; omitted, the dialog assumes the weaker
   * all-assigned reading.
   */
  noneEligible?: boolean;
};

/** The selected `accessConnectorId` on confirm, or `undefined` on dismiss. */
export type AssignConnectorDialogResult = string | undefined;

@Component({
  selector: "app-assign-connector-dialog",
  templateUrl: "./assign-connector-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    FormFieldModule,
    SelectModule,
    I18nPipe,
  ],
})
export class AssignConnectorDialogComponent {
  protected readonly params = inject<AssignConnectorDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<AssignConnectorDialogResult>>(DialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    accessConnectorId: ["", [Validators.required]],
  });

  protected confirm(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    void this.dialogRef.close(this.form.controls.accessConnectorId.value);
  }

  protected cancel(): void {
    void this.dialogRef.close(undefined);
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<AssignConnectorDialogParams>,
  ): DialogRef<AssignConnectorDialogResult> {
    return dialogService.open<AssignConnectorDialogResult, AssignConnectorDialogParams>(
      AssignConnectorDialogComponent,
      config,
    );
  }
}
