import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";
import { TypographyModule } from "../typography";

@Component({
  selector: "bit-spotlight",
  templateUrl: "spotlight.component.html",
  standalone: true,
  providers: [I18nPipe],
  imports: [ButtonModule, CommonModule, IconButtonModule, I18nPipe, TypographyModule],
})
export class SpotlightComponent {
  @Input({ required: true }) title: string | null = null;
  @Input({ required: true }) subtitle: string | null = null;
  @Input() buttonText?: string;
  @Input() indismissable = false;
  @Output() onDismiss = new EventEmitter<void>();

  handleDismiss(): void {
    this.onDismiss.emit();
  }
}
