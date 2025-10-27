import { Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { LinkModule, PopoverModule } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-permit-cipher-details-popover",
  templateUrl: "./permit-cipher-details-popover.component.html",
  imports: [PopoverModule, JslibModule, LinkModule],
})
export class PermitCipherDetailsPopoverComponent {
  private platformUtilService = inject(PlatformUtilsService);

  openLearnMore(e: Event) {
    e.preventDefault();
    this.platformUtilService.launchUri("https://bitwarden.com/help/website-icons/");
  }
}
