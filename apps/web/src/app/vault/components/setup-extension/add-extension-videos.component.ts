import { CommonModule } from "@angular/common";
import { Component, ViewChildren, QueryList, ElementRef } from "@angular/core";

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

  /** Number of videos that have loaded and are ready to play */
  protected numberOfLoadedVideos = 0;

  /** True when the user prefers reduced motion */
  protected prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  /** Returns true when all videos are loaded */
  get allVideosLoaded(): boolean {
    return this.numberOfLoadedVideos >= 3;
  }

  /** Starts the video given the index. */
  protected async startVideoSequence(i: number): Promise<void> {
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

    await video.play();
  }
}
