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
  /** The target system being assigned an access connector. */
  targetSystem: TargetSystem;
  /**
   * The set of enabled access connectors that are NOT already assigned to this
   * target system. Callers (the tab component) compute this from `daemons$`
   * filtered against the target's own assignment membership.
   */
  options: AccessConnector[];
};

/**
 * Closed with the selected `accessConnectorId` on confirm, or `undefined` on dismiss.
 */
export type AssignConnectorDialogResult = string | undefined;

/**
 * Simple select-and-confirm dialog for assigning an enabled access connector to a
 * target system — the mirror of {@link AssignTargetDialogComponent}, called from
 * the target-systems tab rather than the access-connectors tab. Both dialogs
 * resolve to the same underlying `DaemonsService.assign` call.
 */
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
