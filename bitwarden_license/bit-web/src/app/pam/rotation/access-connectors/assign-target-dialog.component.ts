import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ReactiveFormsModule, Validators, FormBuilder } from "@angular/forms";
import { RouterLink } from "@angular/router";

import {
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  LinkModule,
  SelectModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessConnector, TargetSystem } from "../rotation";
import { ROTATION_TABS, rotationLink } from "../rotation-links";

export type AssignTargetDialogParams = {
  accessConnector: AccessConnector;
  /** The automatic target systems not yet assigned to this access connector, disabled included. */
  options: TargetSystem[];
  /**
   * True when the organization has no automatic target system at all, rather than all of them
   * being assigned already. Status is not considered.
   */
  noActiveAutomaticSystems: boolean;
};

/** The selected `targetSystemId` on confirm, or `undefined` on dismiss. */
export type AssignTargetDialogResult = string | undefined;
@Component({
  selector: "app-assign-target-dialog",
  templateUrl: "./assign-target-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    FormFieldModule,
    LinkModule,
    SelectModule,
    I18nPipe,
  ],
})
export class AssignTargetDialogComponent {
  protected readonly params = inject<AssignTargetDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<AssignTargetDialogResult>>(DialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly targetSystemsRoute = rotationLink(
    String(this.params.accessConnector.organizationId),
    ROTATION_TABS.targetSystems,
  );

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
