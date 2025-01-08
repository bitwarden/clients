import { CommonModule } from "@angular/common";
import { Component, ContentChildren, Input, QueryList } from "@angular/core";

import { ButtonModule } from "@bitwarden/components";

import { IconModule } from "../../../../components/src/icon/icon.module";

import { VaultCarouselButtonComponent } from "./carousel-button/carousel-button.component";
import { VaultCarouselContentComponent } from "./carousel-content/carousel-content.component";
import { VaultCarouselSlideComponent } from "./carousel-slide/carousel-slide.component";

@Component({
  selector: "vault-carousel",
  templateUrl: "./carousel.component.html",
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    IconModule,
    VaultCarouselContentComponent,
    VaultCarouselButtonComponent,
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
