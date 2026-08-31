import { CommonModule } from "@angular/common";
import { Component, Input, OnInit, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ButtonType, IconButtonModule } from "@bitwarden/components";

import BrowserPopupUtils from "../../browser/browser-popup-utils";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-pop-out",
  templateUrl: "pop-out.component.html",
  imports: [CommonModule, JslibModule, IconButtonModule],
})
export class PopOutComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() show = true;

  /**
   * TODO: remove with the VFO1Foundation flag.
   *
   * Optional so that reading the flag doesn't force a `ConfigService` stub into every spec that
   * renders a page header. Always present in the running extension.
   */
  private readonly configService = inject(ConfigService, { optional: true });

  /** TODO: remove with the VFO1Foundation flag. */
  private readonly vfo1Enabled = toSignal(
    this.configService?.getFeatureFlag$(FeatureFlag.VFO1Foundation) ?? of(false),
    { initialValue: false },
  );

  /**
   * Every usage projects into the header's `end` slot, which the flag moves onto the dark app bar.
   * Only `side-nav` is legible against that background.
   */
  protected readonly buttonType = computed<ButtonType>(() =>
    this.vfo1Enabled() ? "side-nav" : "primaryGhost",
  );

  constructor(private platformUtilsService: PlatformUtilsService) {}

  async ngOnInit() {
    if (this.show) {
      if (
        (BrowserPopupUtils.inSidebar(window) && this.platformUtilsService.isFirefox()) ||
        BrowserPopupUtils.inPopout(window)
      ) {
        this.show = false;
      }
    }
  }

  async expand() {
    await BrowserPopupUtils.openCurrentPagePopout(window);
  }
}
