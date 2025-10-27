import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { ButtonModule, IconButtonModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-spotlight",
  templateUrl: "spotlight.component.html",
  imports: [ButtonModule, CommonModule, IconButtonModule, I18nPipe, TypographyModule],
})
export class SpotlightComponent {
  // The title of the component
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) title: string | null = null;
  // The subtitle of the component
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() subtitle?: string | null = null;
  // The text to display on the button
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() buttonText?: string;
  // Wheter the component can be dismissed, if true, the component will not show a close button
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() persistent = false;
  // Optional icon to display on the button
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() buttonIcon: string | null = null;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onDismiss = new EventEmitter<void>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onButtonClick = new EventEmitter();

  handleButtonClick(event: MouseEvent): void {
    this.onButtonClick.emit(event);
  }

  handleDismiss(): void {
    this.onDismiss.emit();
  }
}
