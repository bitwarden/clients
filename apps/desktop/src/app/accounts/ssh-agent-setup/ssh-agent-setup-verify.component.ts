import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import {
  CalloutModule,
  IconModule,
  SpinnerLockupComponent,
  StatusLockupComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SshAgentSetupDetailsComponent } from "./ssh-agent-setup-details.component";
import { SshAgentVerifyView } from "./ssh-agent-setup-text";

export type SshAgentSetupVerifyPhase = "applying" | "checking" | "result";

/**
 * Progress and outcome of setup in one place, so the single live region announces each change.
 * A success shows a status lockup. A failure is a callout and never carries a success mark.
 */
@Component({
  selector: "app-ssh-agent-setup-verify",
  templateUrl: "ssh-agent-setup-verify.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CalloutModule,
    I18nPipe,
    IconModule,
    SpinnerLockupComponent,
    SshAgentSetupDetailsComponent,
    StatusLockupComponent,
  ],
})
export class SshAgentSetupVerifyComponent {
  readonly phase = input<SshAgentSetupVerifyPhase>("checking");
  readonly view = input<SshAgentVerifyView | null>(null);
  /** True when the check itself could not run. */
  readonly failed = input(false);

  protected readonly state = computed(() => {
    const phase = this.phase();
    const view = this.view();
    return phase !== "result" || view == null
      ? phase
      : this.failed()
        ? "error"
        : view.success
          ? "success"
          : "failure";
  });
}
