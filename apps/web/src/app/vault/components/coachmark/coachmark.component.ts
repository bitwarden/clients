import { A11yModule } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  IconButtonModule,
  LinkModule,
  PopoverModule,
  TypographyModule,
} from "@bitwarden/components";

/**
 * Coachmark component that displays a tour step popover.
 * Uses the same styling as bit-popover for visual consistency.
 */
@Component({
  selector: "app-coachmark",
  standalone: true,
  imports: [
    CommonModule,
    A11yModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    LinkModule,
    PopoverModule,
    TypographyModule,
  ],
  templateUrl: "coachmark.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "bit-popover",
  },
})
export class CoachmarkComponent {
  readonly title = input("");
  readonly description = input("");
  readonly currentStep = input(1);
  readonly totalSteps = input(1);
  readonly learnMoreUrl = input<string | undefined>(undefined);
  readonly position = input("below-center");

  readonly closed = output<void>();
  readonly back = output<void>();
  readonly next = output<void>();
}
