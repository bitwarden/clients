import { CommonModule } from "@angular/common";
import { Component, ContentChildren, Input, QueryList } from "@angular/core";

import { ButtonModule } from "@bitwarden/components";

import { BitIconComponent } from "../../../../components/src/icon/icon.component";
import { IconModule } from "../../../../components/src/icon/icon.module";

import { VaultCarouselContentComponent } from "./carousel-content/carousel-content.component";
import { VaultCarouselSlideComponent } from "./carousel-slide/carousel-slide.component";
import { ActiveCarouselIcon } from "./icons/active-carousel";
import { InactiveCarouselIcon } from "./icons/inactive-carousel";

@Component({
  selector: "vault-carousel",
  templateUrl: "./carousel.component.html",
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    IconModule,
    BitIconComponent,
    VaultCarouselContentComponent,
  ],
})
export class VaultCarouselComponent {
  protected ActiveCarouselIcon = ActiveCarouselIcon;
  protected InactiveCarouselIcon = InactiveCarouselIcon;

  /** The currently selected index of the carousel. */
  protected selectedIndex = 0;

  /**
   * Accessible Label for the carousel
   *
   * @remarks
   * The label should not include the word "carousel", `aria-roledescription="carousel"` is already included.
   */
  @Input({ required: true }) label = "";

  /**  All slides within the carousel. */
  @ContentChildren(VaultCarouselSlideComponent) slides!: QueryList<VaultCarouselSlideComponent>;

  /** Set the selected index of the carousel. */
  protected selectSlide(index: number) {
    this.selectedIndex = index;
  }
}
