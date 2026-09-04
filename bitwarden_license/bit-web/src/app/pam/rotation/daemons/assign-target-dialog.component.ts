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

export type AssignTargetDialogParams = {
  /** The daemon being assigned a target system. */
  daemon: AccessConnector;
  /**
   * The set of active+automatic target systems that are NOT already assigned to
   * this daemon. Callers (the tab component) compute this from
   * `activeAutomaticSystems$` filtered against `daemon.assignedTargetSystemIds`.
   */
  options: TargetSystem[];
  /**
   * True when the organization has no active automatic target system at all, as opposed to
   * having some that are all already assigned to this daemon. Optional: a caller that does not
   * know gets the existing, weaker message.
   */
  noEligibleTargets?: boolean;
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
  protected readonly targetSystemsRoute = [
    "/organizations",
    this.params.daemon.organizationId,
    "pam",
    "rotation",
    "target-systems",
  ];
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
