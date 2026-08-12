import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { CalloutModule, TabsModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DesktopHeaderComponent } from "../../app/layout/header";
import { AgentAccessPageStateService } from "../services/agent-access-page-state.service";

/**
 * Agent Access shell: the header tabs plus the not-running callout, wrapping the routed
 * "Agents" (`AgentAccessAgentsComponent`, inventory-only — connected agents), "Setup"
 * (`AgentAccessSetupComponent`, every path for adding an agent), and "Activity"
 * (`AgentAccessActivityComponent`) tabs. `AgentAccessPageStateService` (provided on the
 * `agent-access` route — see `app-routing.module.ts`) is shared by all three, so the running status
 * this shell reads for its callout stays in sync with what the tabs show.
 *
 * The callout is unconditional whenever the agent isn't running. It used to be suppressed while the
 * Agents tab's setup checklist was showing, because that checklist's first task said the same
 * thing; the checklist is gone (see `AgentAccessAgentsComponent`'s class doc), so this is the one
 * place the state is reported and there's nothing left to coordinate with.
 *
 * This device's own fingerprint and the relay URL are deliberately *not* shown here. They're setup
 * inputs, not monitoring data, so they live in `AgentAccessPairAgentDialogComponent` next to the
 * code being copied — and the fingerprint specifically is already embedded in the PSK pairing
 * token (`<psk_hex>_<fingerprint_hex>`), so it never needs copying on its own.
 *
 * "Device" is intentionally avoided for the paired/remote party throughout this feature — the
 * thing being paired is a remote agent (see `agent_access::CredentialRequestData`'s "a paired
 * remote agent" doc), not a general trusted device like Bitwarden's account-security device
 * management.
 */
@Component({
  selector: "app-agent-access",
  templateUrl: "agent-access.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nPipe, CalloutModule, DesktopHeaderComponent, RouterOutlet, TabsModule],
})
export class AgentAccessComponent implements OnInit {
  protected readonly pageState = inject(AgentAccessPageStateService);

  async ngOnInit() {
    await this.pageState.refreshStatus();
  }
}
