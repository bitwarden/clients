import { ChangeDetectionStrategy, Component } from "@angular/core";

import { DialogConfig, DialogService } from "@bitwarden/components";

import { SharedModule } from "../../../../shared";
import { PolicyEditDialogData, PolicyEditDialogResult } from "../policy-edit-drawer.component";

import { MultiStepPolicyEditDialogComponent } from "./multi-step-policy-edit-dialog.component";

/**
 * Modal presentation of {@link MultiStepPolicyEditDialogComponent}, for contexts outside the
 * Admin Console policies page where a more attention-grabbing modal is desired instead of a side
 * drawer (e.g. the first-time auto-confirm feature prompt shown from the vault page). Reuses all
 * of the parent's step-handling logic, but renders without the enabled/disabled badge and
 * includes an explicit "Cancel" button, matching the original (pre-drawer) dialog experience.
 */
@Component({
  selector: "app-multi-step-policy-edit-modal",
  templateUrl: "multi-step-policy-edit-modal.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiStepPolicyEditModalComponent extends MultiStepPolicyEditDialogComponent {
  /** Respects the discard-edits guard via the dialog's closePredicate. */
  protected readonly cancel = () => this.dialogRef.close();

  static readonly open = (
    dialogService: DialogService,
    config: DialogConfig<PolicyEditDialogData>,
  ) => {
    return dialogService.open<PolicyEditDialogResult, PolicyEditDialogData>(
      MultiStepPolicyEditModalComponent,
      config,
    );
  };
}
