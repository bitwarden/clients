import { FocusableOption } from "@angular/cdk/a11y";
import { NgIf } from "@angular/common";
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from "@angular/core";

import { BitIconComponent } from "@bitwarden/components/src/icon/icon.component";

import { ActiveCarouselIcon } from "../icons/active-carousel";
import { InactiveCarouselIcon } from "../icons/inactive-carousel";

@Component({
  selector: "vault-carousel-button",
  templateUrl: "carousel-button.component.html",
  standalone: true,
  imports: [NgIf, BitIconComponent],
})
export class VaultCarouselButtonComponent implements FocusableOption {
  @ViewChild("btn", { static: true }) button!: ElementRef<HTMLButtonElement>;
  protected ActiveCarouselIcon = ActiveCarouselIcon;
  protected InactiveCarouselIcon = InactiveCarouselIcon;

  /** When set to true the button is shown in an active state. */
  @Input({ required: true }) isActive!: boolean;

  /** Emits when the button is clicked. */
  @Output() onClick = new EventEmitter<void>();

  /** Focuses the underlying button element. */
  focus(): void {
    this.button.nativeElement.focus();
  }
}
