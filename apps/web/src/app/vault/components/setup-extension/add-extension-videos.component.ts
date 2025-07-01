import { CommonModule, DOCUMENT } from "@angular/common";
import { Component, ViewChildren, QueryList, ElementRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { debounceTime, fromEvent } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";

@Component({
  selector: "vault-add-extension-videos",
  templateUrl: "./add-extension-videos.component.html",
  imports: [CommonModule, JslibModule],
})
export class AddExtensionVideosComponent {
  @ViewChildren("video", { read: ElementRef }) protected videoElements!: QueryList<
    ElementRef<HTMLVideoElement>
  >;

  private document = inject(DOCUMENT);

  /** Current viewport size */
  protected variant: "mobile" | "desktop" = "desktop";

  /** Number of videos that have loaded and are ready to play */
  protected numberOfLoadedVideos = 0;

  /** True when the user prefers reduced motion */
  protected prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Returns true when all videos are loaded */
  get allVideosLoaded(): boolean {
    return this.numberOfLoadedVideos >= 3;
  }

  constructor() {
    fromEvent(window, "resize")
      .pipe(takeUntilDestroyed(), debounceTime(25))
      .subscribe(() => this.onResize());
  }

  /** Resets the video states based on the viewport width changes */
  onResize(): void {
    const oldVariant = this.variant;
    this.variant = this.document.documentElement.clientWidth < 768 ? "mobile" : "desktop";

    // When the viewport changes from desktop to mobile, hide all videos except the one that is playing.
    if (this.variant !== oldVariant && this.variant === "mobile") {
      this.videoElements.forEach((video) => {
        if (video.nativeElement.paused) {
          this.hideElement(video.nativeElement.parentElement!);
        } else {
          this.showElement(video.nativeElement.parentElement!);
        }
      });
    }

    // When the viewport changes from mobile to desktop, show all videos.
    if (this.variant !== oldVariant && this.variant === "desktop") {
      this.videoElements.forEach((video) => {
        this.showElement(video.nativeElement.parentElement!);
      });
    }
  }

  /**
   * Increment the number of loaded videos.
   * When all videos are loaded, start the first one.
   */
  protected onVideoLoad() {
    this.numberOfLoadedVideos = this.numberOfLoadedVideos + 1;

    if (this.allVideosLoaded) {
      void this.startVideoSequence(0);
    }
  }

  /** Recursive method to start the video sequence. */
  private async startVideoSequence(i: number): Promise<void> {
    let index = i;
    const endOfVideos = index >= this.videoElements.length;

    // When the user prefers reduced motion, don't play the videos more than once
    if (endOfVideos && this.prefersReducedMotion) {
      return;
    }

    // When the last of the videos has played, loop back to the start
    if (endOfVideos) {
      this.videoElements.forEach((video) => {
        // Reset all videos to the start
        video.nativeElement.currentTime = 0;
      });

      // Loop back to the first video
      index = 0;
    }

    const video = this.videoElements.toArray()[index].nativeElement;
    video.onended = () => {
      void this.startVideoSequence(index + 1);
    };

    this.mobileTransitionIn(index);

    // Set muted via JavaScript, browsers are respecting autoplay consistently over just the  HTML attribute
    video.muted = true;
    await video.play();
  }

  /** For mobile viewports, fades the current video out and the next video in. */
  private mobileTransitionIn(index: number): void {
    // When the viewport is above the tablet breakpoint, all videos are shown at once.
    // No transition is needed.
    if (this.isAboveTabletBreakpoint()) {
      return;
    }

    const currentParent = this.videoElements.toArray()[index].nativeElement.parentElement!;
    const previousIndex = index === 0 ? this.videoElements.length - 1 : index - 1;

    const previousParent = this.videoElements.toArray()[previousIndex].nativeElement.parentElement!;

    // Fade out the previous video
    this.hideElement(previousParent, true);

    // Fade in the current video
    this.showElement(currentParent, true);
  }

  /** Returns true when the viewport width is 768px or above. */
  private isAboveTabletBreakpoint(): boolean {
    const width = this.document.documentElement.clientWidth;
    return width >= 768;
  }

  /** Visually hides the given element. */
  private hideElement(element: HTMLElement, transition = false): void {
    element.style.transition = transition ? "opacity 0.5s linear" : "";
    element.style.opacity = "0";
  }

  /** Visually shows the given element. */
  private showElement(element: HTMLElement, transition = false): void {
    element.style.transition = transition ? "opacity 0.5s linear" : "";
    element.style.opacity = "1";
  }
}
