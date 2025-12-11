import { Component, ChangeDetectionStrategy, inject, input } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Component({
  selector: "bit-landing-layout-component",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-layout.component.html",
})
export class LandingLayoutComponent {
  readonly hideBackgroundIllustration = input<boolean>(false);
  
  protected readonly clientType: string;
  private readonly platformUtilsService: PlatformUtilsService = inject(PlatformUtilsService);

  constructor() {
    this.clientType = this.platformUtilsService.getClientType();
  }
}