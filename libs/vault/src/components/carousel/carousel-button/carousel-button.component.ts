import { FocusableOption } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from "@angular/core";

import { CarouselIcon } from "@bitwarden/assets/svg";
import { IconModule } from "@bitwarden/components";

import { VaultCarouselSlideComponent } from "../carousel-slide/carousel-slide.component";

@Component({
  selector: "vault-carousel-button",
  templateUrl: "carousel-button.component.html",
  imports: [CommonModule, IconModule],
})
export class VaultCarouselButtonComponent implements FocusableOption {
  /** Slide component that is associated with the individual button */
  @Input({ required: true }) slide!: VaultCarouselSlideComponent;

  @ViewChild("btn", { static: true }) button!: ElementRef<HTMLButtonElement>;
  protected CarouselIcon = CarouselIcon;

  /** When set to true the button is shown in an active state. */
  @Input({ required: true }) isActive!: boolean;

  /** Emits when the button is clicked. */
  @Output() onClick = new EventEmitter<void>();

  /** Focuses the underlying button element. */
  focus(): void {
    this.button.nativeElement.focus();
  }

  protected get dynamicClasses(): string[] {
    const activeClasses = ["[&_rect]:tw-fill-primary-600", "tw-text-primary-600"];

    const inactiveClasses = [
      "tw-text-muted",
      "[&_rect]:hover:tw-fill-text-muted",
      "focus-visible:tw-text-info-700",
    ];

    return this.isActive ? activeClasses : inactiveClasses;
  }
}
