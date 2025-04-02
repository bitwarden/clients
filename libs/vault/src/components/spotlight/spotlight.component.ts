import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { ButtonModule, IconButtonModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "bit-spotlight",
  templateUrl: "spotlight.component.html",
  standalone: true,
  imports: [ButtonModule, CommonModule, IconButtonModule, I18nPipe, TypographyModule],
})
export class SpotlightComponent {
  // The title of the component
  @Input({ required: true }) title: string | null = null;
  // The subtitle of the component
  @Input({ required: true }) subtitle: string | null = null;
  // The text to display on the button
  @Input() buttonText?: string;
  // Wheter the component can be dismissed, if true, the component will not show a close button
  @Input() persistent = false;
  @Output() onDismiss = new EventEmitter<void>();
  @Output() onButtonClick = new EventEmitter<void>();

  handleButtonClick(): void {
    this.onButtonClick.emit();
  }

  handleDismiss(): void {
    this.onDismiss.emit();
  }
}
