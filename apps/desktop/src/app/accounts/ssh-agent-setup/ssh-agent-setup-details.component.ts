import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import {
  DisclosureComponent,
  DisclosureTriggerForDirective,
  LinkModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SshAgentDetailLine } from "./ssh-agent-setup-text";

/** Renders text unchanged but lets long paths wrap after each slash instead of inside a name. */
@Component({
  selector: "app-ssh-agent-setup-path",
  template: `@for (part of parts(); track $index) {
    <ng-container>{{ part }}</ng-container
    ><wbr />
  }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SshAgentSetupPathComponent {
  readonly text = input.required<string>();
  protected readonly parts = computed(() => this.text().split(/(?<=\/)/));
}

/** A collapsed "Technical details" disclosure with one wrapped line per detail. */
@Component({
  selector: "app-ssh-agent-setup-details",
  templateUrl: "ssh-agent-setup-details.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DisclosureComponent,
    DisclosureTriggerForDirective,
    I18nPipe,
    LinkModule,
    SshAgentSetupPathComponent,
    TypographyModule,
  ],
})
export class SshAgentSetupDetailsComponent {
  readonly lines = input.required<SshAgentDetailLine[]>();
  /** Keeps element ids unique when several disclosures are on screen. */
  readonly scope = input.required<string>();
}
