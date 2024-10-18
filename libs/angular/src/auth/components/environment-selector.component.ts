import { animate, state, style, transition, trigger } from "@angular/animations";
import { ConnectedPosition } from "@angular/cdk/overlay";
import { Component, EventEmitter, Output } from "@angular/core";
import { Router } from "@angular/router";
import { Observable, map } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  EnvironmentService,
  Region,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

@Component({
  selector: "environment-selector",
  templateUrl: "environment-selector.component.html",
  animations: [
    trigger("transformPanel", [
      state(
        "void",
        style({
          opacity: 0,
        }),
      ),
      transition(
        "void => open",
        animate(
          "100ms linear",
          style({
            opacity: 1,
          }),
        ),
      ),
      transition("* => void", animate("100ms linear", style({ opacity: 0 }))),
    ]),
  ],
})
export class EnvironmentSelectorComponent {
  @Output() onOpenSelfHostedSettings = new EventEmitter();
  protected isOpen = false;
  protected accessingString: string;
  protected ServerEnvironmentType = Region;
  protected overlayPosition: ConnectedPosition[] = [
    {
      originX: "start",
      originY: "bottom",
      overlayX: "start",
      overlayY: "top",
    },
  ];

  protected availableRegions = this.environmentService.availableRegions();
  protected selectedRegion$: Observable<RegionConfig | undefined> =
    this.environmentService.environment$.pipe(
      map((e) => e.getRegion()),
      map((r) => this.availableRegions.find((ar) => ar.key === r)),
    );

  constructor(
    protected environmentService: EnvironmentService,
    protected configService: ConfigService,
    protected router: Router,
    protected logService: LogService,
    private i18nService: I18nService,
  ) {
    this.setAccessingString().catch((e) => {
      this.logService.error(e);
    });
  }

  /**
   * Set the text in front of the dropdown to either "Accessing" or "Logging In On" based on whether the
   * UnauthenticatedExtensionUIRefresh feature flag is set.
   */
  private async setAccessingString() {
    const isUnauthenticatedExtensionUIRefreshEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.UnauthenticatedExtensionUIRefresh,
    );
    const translationKey = isUnauthenticatedExtensionUIRefreshEnabled ? "accessing" : "loggingInOn";
    this.accessingString = this.i18nService.t(translationKey);
  }

  async toggle(option: Region) {
    this.isOpen = !this.isOpen;
    if (option === null) {
      return;
    }

    if (option === Region.SelfHosted) {
      this.onOpenSelfHostedSettings.emit();
      return;
    }

    await this.environmentService.setEnvironment(option);
  }

  close() {
    this.isOpen = false;
  }
}
