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

  /** CSS variable name tied to the video overlay */
  private cssOverlayVariable = "--overlay-opacity";
  /** CSS variable name tied to the video border */
  private cssBorderVariable = "--border-opacity";

  /** Current viewport size */
  protected variant: "mobile" | "desktop" = "desktop";

  /** Number of videos that have loaded and are ready to play */
  protected numberOfLoadedVideos = 0;

  /** True when the user prefers reduced motion */
  protected prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** CSS classes for the video container, pulled into the class only for readability. */
  protected videoContainerClass = [
    "tw-absolute tw-left-0 tw-top-0 tw-w-[15rem] tw-opacity-0 md:tw-opacity-100 md:tw-relative lg:tw-w-[17rem] tw-max-w-full tw-aspect-[0.807]",
    `[--overlay-opacity:0.7] after:tw-absolute after:tw-top-0 after:tw-left-0 after:tw-size-full after:tw-bg-primary-100 after:tw-content-[''] after:tw-rounded-lg after:tw-opacity-[--overlay-opacity]`,
    `[--border-opacity:0] before:tw-absolute before:tw-top-0 before:tw-left-0 before:tw-w-full before:tw-h-2 before:tw-bg-primary-600 before:tw-content-[''] before:tw-rounded-t-lg before:tw-opacity-[--border-opacity]`,
    "after:tw-transition-opacity after:tw-duration-400 after:tw-ease-linear",
    "before:tw-transition-opacity before:tw-duration-400 before:tw-ease-linear",
  ].join(" ");

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
      void this.addPausedStyles(video);
    };

    this.mobileTransitionIn(index);

    // Browsers are not respecting autoplay consistently with just the HTML attribute, set via JavaScript as well.
    video.muted = true;
    this.addPlayingStyles(video);
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

  /**
   * Add styles to the video that is moving to the paused/completed state.
   * Fade in the overlay and fade out the border.
   */
  private addPausedStyles(video: HTMLVideoElement): void {
    const parentElement = video.parentElement;
    if (!parentElement) {
      return;
    }

    // The border opacity transitions from 1 to 0 based on the percent complete.
    parentElement.style.setProperty(this.cssBorderVariable, "0");
    // The opacity transitions from 0 to 0.7 based on the percent complete.
    parentElement.style.setProperty(this.cssOverlayVariable, "0.7");
  }

  /**
   * Add styles to the video that is moving to the playing state.
   * Fade out the overlay and fade in the border.
   */
  private addPlayingStyles(video: HTMLVideoElement): void {
    const parentElement = video.parentElement;
    if (!parentElement) {
      return;
    }

    // The border opacity transitions from 0 to 1 based on the percent complete.
    parentElement.style.setProperty(this.cssBorderVariable, "1");
    // The opacity transitions from 0.7 to 0 based on the percent complete.
    parentElement.style.setProperty(this.cssOverlayVariable, "0");
  }
}
