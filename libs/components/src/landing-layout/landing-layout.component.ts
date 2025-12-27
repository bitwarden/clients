import { Component, ChangeDetectionStrategy, inject, input } from "@angular/core";

import { BackgroundLeftIllustration, BackgroundRightIllustration } from "@bitwarden/assets/svg";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { IconModule } from "../icon";

@Component({
  selector: "bit-landing-layout",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-layout.component.html",
  imports: [IconModule],
})
export class LandingLayoutComponent {
  readonly hideBackgroundIllustration = input<boolean>(false);

  protected readonly clientType: string;
  protected readonly leftIllustration = BackgroundLeftIllustration;
  protected readonly rightIllustration = BackgroundRightIllustration;

  private readonly platformUtilsService: PlatformUtilsService = inject(PlatformUtilsService);

  constructor() {
    this.clientType = this.platformUtilsService.getClientType();
  }
}
