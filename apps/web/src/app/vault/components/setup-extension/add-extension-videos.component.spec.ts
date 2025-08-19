import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { AddExtensionVideosComponent } from "./add-extension-videos.component";

describe("AddExtensionVideosComponent", () => {
  let fixture: ComponentFixture<AddExtensionVideosComponent>;
  let component: AddExtensionVideosComponent;

  // Mock HTMLMediaElement load to stop the video file from being loaded
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    value: jest.fn(),
    writable: true,
  });

  const play = jest.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.play = play;

  beforeEach(async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addListener() {},
        removeListener() {},
      })),
    });
    play.mockClear();

    await TestBed.configureTestingModule({
      imports: [AddExtensionVideosComponent, RouterModule.forRoot([])],
      providers: [
        provideNoopAnimations(),
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddExtensionVideosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("loading pulse", () => {
    it("shows loading spinner when all videos are not loaded", () => {
      const loadingSpinners = fixture.debugElement.queryAll(By.css("[data-testid='video-pulse']"));
      expect(loadingSpinners.length).toBe(3);
    });

    it("shows all pulses until all videos are loaded", () => {
      let loadingSpinners = fixture.debugElement.queryAll(By.css("[data-testid='video-pulse']"));
      expect(loadingSpinners.length).toBe(3);

      // Simulate two video loaded
      component["videoElements"].get(0)?.nativeElement.dispatchEvent(new Event("loadeddata"));
      component["videoElements"].get(1)?.nativeElement.dispatchEvent(new Event("loadeddata"));

      loadingSpinners = fixture.debugElement.queryAll(By.css("[data-testid='video-pulse']"));

      expect(component["numberOfLoadedVideos"]).toBe(2);
      expect(loadingSpinners.length).toBe(3);
    });
  });

  describe("window resizing", () => {
    beforeEach(() => {
      component["numberOfLoadedVideos"] = 3;
      fixture.detectChanges();
    });

    it("shows all videos when window is resized to desktop viewport", fakeAsync(() => {
      component["variant"] = "mobile";
      Object.defineProperty(component["document"].documentElement, "clientWidth", {
        configurable: true,
        value: 1000,
      });

      window.dispatchEvent(new Event("resize"));

      fixture.detectChanges();
      tick(50);

      expect(
        Array.from(component["videoElements"]).every(
          (video) => video.nativeElement.parentElement?.style.opacity === "1",
        ),
      ).toBe(true);
    }));

    it("shows only the playing video when window is resized to mobile viewport", fakeAsync(() => {
      component["variant"] = "desktop";
      // readonly property needs redefining
      Object.defineProperty(component["document"].documentElement, "clientWidth", {
        value: 500,
      });

      const video1 = component["videoElements"].get(1);
      Object.defineProperty(video1!.nativeElement, "paused", {
        value: false,
      });

      window.dispatchEvent(new Event("resize"));

      fixture.detectChanges();
      tick(50);

      expect(component["videoElements"].get(0)?.nativeElement.parentElement?.style.opacity).toBe(
        "0",
      );
      expect(component["videoElements"].get(1)?.nativeElement.parentElement?.style.opacity).toBe(
        "1",
      );
      expect(component["videoElements"].get(2)?.nativeElement.parentElement?.style.opacity).toBe(
        "0",
      );
    }));
  });

  describe("video sequence", () => {
    let firstVideo: HTMLVideoElement;
    let secondVideo: HTMLVideoElement;
    let thirdVideo: HTMLVideoElement;

    beforeEach(() => {
      component["numberOfLoadedVideos"] = 2;
      component["onVideoLoad"]();

      firstVideo = component["videoElements"].get(0)!.nativeElement;
      secondVideo = component["videoElements"].get(1)!.nativeElement;
      thirdVideo = component["videoElements"].get(2)!.nativeElement;
    });

    it("starts the video sequence when all videos are loaded", () => {
      expect(firstVideo.play).toHaveBeenCalled();
    });

    it("plays videos in sequence", () => {
      play.mockClear();
      firstVideo.onended!(new Event("ended")); // trigger next video

      expect(secondVideo.play).toHaveBeenCalledTimes(1);

      play.mockClear();
      secondVideo.onended!(new Event("ended")); // trigger next video

      expect(thirdVideo.play).toHaveBeenCalledTimes(1);
    });

    it("doesn't play videos again when the user prefers no motion", () => {
      component["prefersReducedMotion"] = true;

      firstVideo.onended!(new Event("ended"));

      secondVideo.onended!(new Event("ended"));

      play.mockClear();

      thirdVideo.onended!(new Event("ended")); // trigger first video again

      expect(play).toHaveBeenCalledTimes(0);
    });
  });
});
