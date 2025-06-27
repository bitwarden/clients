import { Injectable, OnDestroy } from "@angular/core";
import { combineLatest, Subject, takeUntil } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

@Injectable({
  providedIn: "root",
})
export class DesktopAutotypeService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private isAutotypeFullyEnabled: boolean;

  constructor(
    private configService: ConfigService,
    private desktopSettingsService: DesktopSettingsService,
    private platformUtilsService: PlatformUtilsService,
  ) {
    this.isAutotypeFullyEnabled = false;
  }

  async init() {
    const isWindows = this.platformUtilsService.getDevice() === DeviceType.WindowsDesktop;

    if (isWindows) {
      combineLatest([
        this.desktopSettingsService.autotypeEnabled$,
        this.configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype),
      ])
        .pipe(takeUntil(this.destroy$))
        .subscribe(([autotypeEnabled, windowsDesktopAutotypeFeatureFlag]) => {
          if (windowsDesktopAutotypeFeatureFlag) {
            if (autotypeEnabled && !this.isAutotypeFullyEnabled) {
              this.enableAutotype();
              this.isAutotypeFullyEnabled = true;
            } else if (!autotypeEnabled && this.isAutotypeFullyEnabled) {
              this.disableAutotype();
              this.isAutotypeFullyEnabled = false;
            }
          } else {
            if (this.isAutotypeFullyEnabled) {
              this.disableAutotype();
              this.isAutotypeFullyEnabled = false;
            }
          }
        });
    }
  }

  private enableAutotype() {
    // eslint-disable-next-line no-console
    console.log("Enabling Autotype...");
  }

  private disableAutotype() {
    // eslint-disable-next-line no-console
    console.log("Disabling Autotype...");
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
