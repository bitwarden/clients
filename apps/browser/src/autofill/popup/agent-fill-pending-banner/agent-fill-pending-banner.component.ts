import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BannerModule } from "@bitwarden/components";

import { AgentFillPendingRequestService } from "../../services/agent-fill-pending-request.service";

/**
 * Shows that an AI agent's fill request is waiting for the user's approval in the Bitwarden desktop
 * app. It is view-only on purpose: an agent driving the browser can click anything in the popup, so
 * approving or denying is only possible in the desktop app.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BannerModule, JslibModule],
  selector: "agent-fill-pending-banner",
  templateUrl: "agent-fill-pending-banner.component.html",
})
export class AgentFillPendingBannerComponent {
  protected readonly pendingRequest = toSignal(
    inject(AgentFillPendingRequestService).pendingRequest$,
    { initialValue: null },
  );
}
