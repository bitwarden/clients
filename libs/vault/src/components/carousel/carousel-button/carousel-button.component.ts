import { FocusableOption } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from "@angular/core";

import { BitIconComponent } from "@bitwarden/components/src/icon/icon.component";

import { CarouselIcon } from "../carousel-icons/carousel-icon";
import { VaultCarouselSlideComponent } from "../carousel-slide/carousel-slide.component";

@Component({
  selector: "vault-carousel-button",
  templateUrl: "carousel-button.component.html",
  standalone: true,
  imports: [CommonModule, BitIconComponent],
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

  protected get dynamicClasses() {
    const activeClasses = ["[&_rect]:tw-fill-primary-600", "[&_rect]:tw-stroke-primary-600"];

    const inactiveClasses = ["[&_rect]:tw-stroke-text-muted", "[&_rect]:hover:tw-fill-text-muted"];

    return this.isActive ? activeClasses : inactiveClasses;
  }
}
