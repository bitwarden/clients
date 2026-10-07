import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { IconComponent, SvgComponent } from "@bitwarden/components";

import { AGENT_LOGOS } from "../icons";
import { OpenShellProgram } from "../utils/openshell-program-catalog.util";

/** The logo of an agent program (Claude Code, Codex), otherwise a generic icon. Decorative. */
@Component({
  selector: "app-agent-access-openshell-program-icon",
  template: `
    <span
      class="tw-flex tw-size-6 tw-shrink-0 tw-items-center tw-justify-center tw-rounded tw-border tw-border-solid tw-border-border-base tw-bg-bg-secondary tw-p-0.5 tw-text-muted"
    >
      @if (program().agent; as agent) {
        <bit-svg [content]="logos[agent]" class="tw-w-full"></bit-svg>
      } @else {
        <bit-icon [name]="program().icon"></bit-icon>
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SvgComponent],
})
export class AgentAccessOpenShellProgramIconComponent {
  readonly program = input.required<OpenShellProgram>();

  protected readonly logos = AGENT_LOGOS;
}
