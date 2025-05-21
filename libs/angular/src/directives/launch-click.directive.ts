import { Directive, HostListener, Input } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

@Directive({
  selector: "[appLaunchClick]",
  standalone: false,
})
export class LaunchClickDirective {
  constructor(private platformUtilsService: PlatformUtilsService) {}

  @Input("appLaunchClick") uriToLaunch = "";

  @HostListener("click") onClick() {
    if (!Utils.isNullOrWhitespace(this.uriToLaunch)) {
      this.platformUtilsService.launchUri(this.uriToLaunch);
    }
  }
}
