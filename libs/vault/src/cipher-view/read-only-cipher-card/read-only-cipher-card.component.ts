import { ChangeDetectionStrategy, Component } from "@angular/core";

import { CardComponent } from "@bitwarden/components";

@Component({
  selector: "read-only-cipher-card",
  templateUrl: "./read-only-cipher-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
})
/**
 * A thin wrapper around the `bit-card` component.
 */
export class ReadOnlyCipherCardComponent {}
