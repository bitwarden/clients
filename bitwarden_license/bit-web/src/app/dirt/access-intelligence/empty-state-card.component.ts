import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, isDevMode, OnInit } from "@angular/core";

import { BitSvg } from "@bitwarden/assets/svg";
import { ButtonModule, SvgModule } from "@bitwarden/components";

@Component({
  selector: "empty-state-card",
  templateUrl: "./empty-state-card.component.html",
  imports: [CommonModule, SvgModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateCardComponent implements OnInit {
  readonly icon = input<BitSvg | null>(null);
  readonly videoSrc = input<string | null>(null);
  readonly title = input<string>("");
  readonly description = input<string>("");
  readonly benefits = input<[string, string][]>([]);
  readonly buttonText = input<string>("");
  readonly buttonAction = input<(() => void) | null>(null);
  readonly buttonIcon = input<string | undefined>(undefined);

  ngOnInit(): void {
    if (!this.title() && isDevMode()) {
      // eslint-disable-next-line no-console
      console.warn("EmptyStateCardComponent: title is required for proper display");
    }
  }
}
