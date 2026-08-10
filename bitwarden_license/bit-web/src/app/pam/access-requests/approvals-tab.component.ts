import { ChangeDetectionStrategy, Component } from "@angular/core";

import { NoItemsModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * "Approvals" tab — reviewing and deciding other members' access requests.
 *
 * Placeholder for now: an approver-facing surface needs an org-scoped SDK read (list the pending
 * requests for collections the caller manages) plus approve/deny, and the pinned commercial SDK
 * exposes only caller-scoped operations (`list_mine`, `activate`, `cancel`). Once that surface
 * lands, this tab renders the pending-approval inbox from the design. Kept as a routed tab so the
 * shell's tab bar matches the design and the route is stable.
 */
@Component({
  selector: "pam-approvals-tab",
  templateUrl: "./approvals-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NoItemsModule, I18nPipe],
})
export class ApprovalsTabComponent {}
