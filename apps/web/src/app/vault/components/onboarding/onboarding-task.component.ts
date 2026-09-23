import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { RouterModule } from "@angular/router";

import { BadgeComponent, BitwardenIcon, ButtonComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-onboarding-task",
  templateUrl: "./onboarding-task.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, BadgeComponent, ButtonComponent, I18nPipe],
  host: {
    class:
      "tw-block tw-py-4 -tw-mx-4 tw-px-4 tw-border-b tw-border-solid tw-border-border-base first:tw-pt-0",
    role: "listitem",
  },
})
export class OnboardingTaskComponent {
  readonly completed = input(false);
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly route = input<string | unknown[]>();
  readonly ctaText = input<string>();
  readonly ctaIcon = input<BitwardenIcon>();
  readonly isDisabled = input(false);

  readonly ctaClick = output<void>();
}
