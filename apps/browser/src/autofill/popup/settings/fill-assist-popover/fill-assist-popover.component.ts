import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { A11yTitleDirective, IconModule, LinkModule, PopoverModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "autofill-fill-assist-popover",
  templateUrl: "./fill-assist-popover.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yTitleDirective, PopoverModule, I18nPipe, LinkModule, IconModule],
})
export class FillAssistPopoverComponent {
  private readonly platformUtilService = inject(PlatformUtilsService);

  openLearnMore(e: Event) {
    e.preventDefault();
    this.platformUtilService.launchUri("https://bitwarden.com/help/fill-assist/");
  }
}
