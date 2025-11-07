import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { ButtonModule, IconButtonModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "bit-spotlight",
  templateUrl: "spotlight.component.html",
  imports: [ButtonModule, CommonModule, IconButtonModule, I18nPipe, TypographyModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpotlightComponent {
  // The title of the component
  readonly title = input<string | null>(null);
  // The subtitle of the component
  readonly subtitle = input<string | null>(null);
  // The text to display on the button
  readonly buttonText = input<string | null>(null);
  // Whether the component can be dismissed, if true, the component will not show a close button
  readonly persistent = input(false);
  // Optional icon to display on the button
  readonly buttonIcon = input<string | null>(null);
  readonly onDismiss = output<void>();
  readonly onButtonClick = output<MouseEvent>();

  handleButtonClick(event: MouseEvent): void {
    this.onButtonClick.emit(event);
  }

  handleDismiss(): void {
    this.onDismiss.emit();
  }
}
