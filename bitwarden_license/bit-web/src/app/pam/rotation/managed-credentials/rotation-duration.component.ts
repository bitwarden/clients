import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { DurationParts } from "./rotation-job-row";

/** How long a rotation job or attempt took, stated in the largest unit that carries information. */
@Component({
  selector: "pam-rotation-duration",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nPipe],
  template: `
    @if (parts().hours > 0) {
      {{ "pamRotationDurationHours" | i18n: parts().hours : parts().minutes }}
    } @else if (parts().minutes > 0) {
      {{ "pamRotationDurationMinutes" | i18n: parts().minutes : parts().seconds }}
    } @else {
      {{ "pamRotationDurationSeconds" | i18n: parts().seconds }}
    }
  `,
})
export class RotationDurationComponent {
  readonly parts = input.required<DurationParts>();
}
