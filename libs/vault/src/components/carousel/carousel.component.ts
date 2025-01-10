import { FocusKeyManager } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren,
} from "@angular/core";

import { ButtonModule } from "@bitwarden/components";

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
    VaultCarouselContentComponent,
    VaultCarouselButtonComponent,
  ],
})
export class VaultCarouselComponent implements AfterViewInit {
  /**
   * Accessible Label for the carousel
   *
   * @remarks
   * The label should not include the word "carousel", `aria-roledescription="carousel"` is already included.
   */
  @Input({ required: true }) label = "";

  /**
   * Slides that have differing heights can cause the carousel controls to jump.
   * Provide a height value of the tallest slide to prevent this.
   * The value should be in `rem`.
   */
  @Input() height?: `${number}rem` | undefined;

  /**
   * Emits the index of of the newly selected slide.
   */
  @Output() slideChange = new EventEmitter<number>();

  /** All slides within the carousel. */
  @ContentChildren(VaultCarouselSlideComponent) slides!: QueryList<VaultCarouselSlideComponent>;

  /** All buttons that control the carousel */
  @ViewChildren(VaultCarouselButtonComponent)
  carouselButtons!: QueryList<VaultCarouselButtonComponent>;

  /** The currently selected index of the carousel. */
  protected selectedIndex = 0;

  /**
   * Focus key manager for keeping tab controls accessible.
   * https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tablist_role#keyboard_interactions
   */
  protected keyManager: FocusKeyManager<VaultCarouselButtonComponent> | null = null;

  /** Set the selected index of the carousel. */
  protected selectSlide(index: number) {
    this.selectedIndex = index;
    this.slideChange.emit(index);
  }

  ngAfterViewInit(): void {
    this.keyManager = new FocusKeyManager(this.carouselButtons)
      .withHorizontalOrientation("ltr")
      .withWrap()
      .withHomeAndEnd();

    // Set the first carousel button as active, this avoids having to double tab the arrow keys on initial focus.
    this.keyManager.setFirstItemActive();
  }
}
