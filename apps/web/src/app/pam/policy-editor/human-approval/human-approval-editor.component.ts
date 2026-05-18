import { ChangeDetectionStrategy, Component, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LinkModule } from "@bitwarden/components";
import { LeasingPolicy } from "@bitwarden/pam";

/**
 * Mode editor for the `human_approval` leasing policy.
 *
 * No form fields — this mode has no configurable state. The component renders
 * a description and emits `{ kind: "human_approval" }` when the host calls
 * {@link buildPolicy}. The host (collection-leasing-tab) is responsible for
 * wiring the manageMembersClicked output to switch the dialog to its Access tab.
 */
@Component({
  selector: "pam-human-approval-editor",
  templateUrl: "./human-approval-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, LinkModule],
})
export class HumanApprovalEditorComponent {
  /**
   * Emitted when the user clicks the "Manage who can approve" link.
   * The host should switch to the Access tab in response.
   */
  readonly manageMembersClicked = output<void>();

  protected onManageMembersClicked(): void {
    this.manageMembersClicked.emit();
  }

  /** Returns the policy this editor represents. Always succeeds — no validation needed. */
  buildPolicy(): LeasingPolicy {
    return { kind: "human_approval" };
  }
}
