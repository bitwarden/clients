import { Component, OnInit, signal } from "@angular/core";

import { ButtonModule, DialogModule, TypographyModule } from "@bitwarden/components";
import { VaultCarouselModule } from "@bitwarden/vault";

@Component({
  selector: "app-intro-carousel",
  templateUrl: "./intro-carousel.component.html",
  imports: [VaultCarouselModule, ButtonModule, DialogModule, TypographyModule],
  standalone: true,
})
export class IntroCarouselComponent implements OnInit {
  protected dismissBtnEnabled = signal(false);
  ngOnInit() {
    // console.log("%c Intro Carousel Initialized", "color: red");
  }

  protected onSlideChange(slideIndex: number) {
    if (slideIndex === 4) {
      this.dismissBtnEnabled.set(true);
    }
  }
}
