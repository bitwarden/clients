import { FocusKeyManager } from "@angular/cdk/a11y";
import { CdkPortalOutlet } from "@angular/cdk/portal";
import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  Output,
  QueryList,
  ViewChild,
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
    CdkPortalOutlet,
    CommonModule,
    ButtonModule,
    VaultCarouselContentComponent,
    VaultCarouselButtonComponent,
  ],
})
export class VaultCarouselComponent implements AfterViewInit {
  private changeDetectorRef = inject(ChangeDetectorRef);
  /**
   * Accessible Label for the carousel
   *
   * @remarks
   * The label should not include the word "carousel", `aria-roledescription="carousel"` is already included.
   */
  @Input({ required: true }) label = "";

  /**
   * Emits the index of of the newly selected slide.
   */
  @Output() slideChange = new EventEmitter<number>();

  /** All slides within the carousel. */
  @ContentChildren(VaultCarouselSlideComponent) slides!: QueryList<VaultCarouselSlideComponent>;

  /** All buttons that control the carousel */
  @ViewChildren(VaultCarouselButtonComponent)
  carouselButtons!: QueryList<VaultCarouselButtonComponent>;

  /** Wrapping container for the carousel content and buttons */
  @ViewChild("container") carouselContainer!: ElementRef<HTMLElement>;

  /** Container for the carousel buttons */
  @ViewChild("carouselButtonWrapper") carouselButtonWrapper!: ElementRef<HTMLDivElement>;

  /** Temporary container containing `tempSlideOutlet` */
  @ViewChild("tempSlideContainer") tempSlideContainer!: ElementRef<HTMLDivElement>;

  /** Outlet to temporary render each slide within */
  @ViewChild(CdkPortalOutlet) tempSlideOutlet!: CdkPortalOutlet;

  /** The currently selected index of the carousel. */
  protected selectedIndex = 0;

  /**
   * Slides that have differing heights can cause the carousel controls to jump.
   * Set the min height based on the tallest slide.
   */
  protected minHeight: `${number}px` | null = null;

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

  async ngAfterViewInit() {
    this.keyManager = new FocusKeyManager(this.carouselButtons)
      .withHorizontalOrientation("ltr")
      .withWrap()
      .withHomeAndEnd();

    // Set the first carousel button as active, this avoids having to double tab the arrow keys on initial focus.
    this.keyManager.setFirstItemActive();

    await this.setMinHeightOfCarousel();
  }

  /**
   * Slides of differing height can cause the carousel to jump in height.
   * Render each slide in a temporary portal outlet to get the height of each slide
   * and store the tallest slide height.
   */
  private async setMinHeightOfCarousel() {
    // Store the height of the carousel button element.
    const heightOfButtonsPx = this.carouselButtonWrapper.nativeElement.offsetHeight;

    // Get the width of the carousel so we know how much space each slide can render within.
    const containerWidth = this.carouselContainer.nativeElement.offsetWidth;
    const containerHeight = this.carouselContainer.nativeElement.offsetHeight;

    // Set the width of the temp container to render each slide inside of.
    this.tempSlideContainer.nativeElement.style.width = `${containerWidth}px`;

    // The first slide is already rendered at this point, use the height of the container
    // to determine the height of the first slide.
    let tallestSlideHeightPx = containerHeight - heightOfButtonsPx;

    for (let i = 0; i < this.slides.length; i++) {
      if (i === this.selectedIndex) {
        continue;
      }
      this.tempSlideOutlet.attach(this.slides.get(i)!.content);

      // Wait for the slide to render. Otherwise, the previous slide may not have been removed from the DOM yet.
      await new Promise(requestAnimationFrame);

      // Store the height of the current slide if is larger than the current stored height;
      if (this.tempSlideContainer.nativeElement.offsetHeight > tallestSlideHeightPx) {
        tallestSlideHeightPx = this.tempSlideContainer.nativeElement.offsetHeight;
      }

      // cleanup the outlet
      this.tempSlideOutlet.detach();
    }
    // Set the min height of the entire carousel based on the largest slide.
    this.minHeight = `${tallestSlideHeightPx + heightOfButtonsPx}px`;
    this.changeDetectorRef.detectChanges();
  }
}
