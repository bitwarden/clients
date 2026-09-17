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
  /** The access connector being assigned a target system. */
  accessConnector: AccessConnector;
  /**
   * The set of automatic target systems that are NOT already assigned to this access connector,
   * including disabled ones. Callers (the tab component) compute this from
   * `automaticSystems$` filtered against `accessConnector.assignedTargetSystemIds`.
   */
  options: TargetSystem[];
  /**
   * True when the organization has no active automatic target system at all, as opposed to
   * having some that are all already assigned to this access connector.
   */
  noActiveAutomaticSystems: boolean;
};

/**
 * Closed with the selected `targetSystemId` on confirm, or `undefined` on dismiss.
 */
export type AssignTargetDialogResult = string | undefined;

/**
 * Simple select-and-confirm dialog for assigning an automatic target
 * system to an access connector.
 */
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
