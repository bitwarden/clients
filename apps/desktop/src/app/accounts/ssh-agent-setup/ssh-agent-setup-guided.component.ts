import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import {
  ButtonModule,
  CalloutModule,
  CopyClickDirective,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  SshAgentSetupEnvironment,
  SshAgentSetupPlan,
  SshAgentSetupPlatform,
} from "../../../autofill/models/ssh-agent-setup";

import { guidedCommandKey, guidedReasonKey } from "./ssh-agent-setup-text";

/**
 * Copy-ready steps for devices where the app cannot (or must not) write the setup itself.
 * The app never runs these commands; the user copies and runs each one.
 */
@Component({
  selector: "app-ssh-agent-setup-guided",
  templateUrl: "ssh-agent-setup-guided.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, CalloutModule, CopyClickDirective, I18nPipe, TypographyModule],
})
export class SshAgentSetupGuidedComponent {
  readonly environment = input.required<SshAgentSetupEnvironment>();
  readonly commands = input.required<SshAgentSetupPlan["guidedCommands"]>();

  protected readonly reasonKey = computed(() =>
    guidedReasonKey(this.environment().guidedReasonKey),
  );
  protected readonly windows = computed(
    () => this.environment().platform === SshAgentSetupPlatform.Windows,
  );
  protected readonly rows = computed(() =>
    this.commands().map((command) => ({
      ...command,
      descriptionKey: guidedCommandKey(command.descriptionKey),
    })),
  );
}
