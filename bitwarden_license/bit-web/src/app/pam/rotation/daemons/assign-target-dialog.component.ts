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

import { RotationDaemonResponse } from "../responses/rotation-daemon.response";
import { TargetSystemResponse } from "../responses/target-system.response";

export type AssignTargetDialogParams = {
  /** The daemon being assigned a target system. */
  daemon: RotationDaemonResponse;
  /**
   * The set of active+automatic target systems that are NOT already assigned to
   * this daemon. Callers (the tab component) compute this from
   * `activeAutomaticSystems$` filtered against `daemon.assignments`.
   */
  options: TargetSystemResponse[];
};

/**
 * Closed with the selected `targetSystemId` on confirm, or `undefined` on dismiss.
 */
export type AssignTargetDialogResult = string | undefined;

/**
 * Simple select-and-confirm dialog for assigning an active automatic target
 * system to a daemon.
 */
@Component({
  selector: "app-assign-target-dialog",
  templateUrl: "./assign-target-dialog.component.html",
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
export class AssignTargetDialogComponent {
  protected readonly params = inject<AssignTargetDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<AssignTargetDialogResult>>(DialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    targetSystemId: ["", [Validators.required]],
  });

  protected confirm(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    void this.dialogRef.close(this.form.controls.targetSystemId.value);
  }

  protected cancel(): void {
    void this.dialogRef.close(undefined);
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<AssignTargetDialogParams>,
  ): DialogRef<AssignTargetDialogResult> {
    return dialogService.open<AssignTargetDialogResult, AssignTargetDialogParams>(
      AssignTargetDialogComponent,
      config,
    );
  }
}
