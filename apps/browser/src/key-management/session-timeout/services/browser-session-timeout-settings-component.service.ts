import { defer, Observable, of } from "rxjs";

import {
  VaultTimeout,
  VaultTimeoutOption,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SessionTimeoutSettingsComponentService } from "@bitwarden/key-management-ui";

export class BrowserSessionTimeoutSettingsComponentService
  implements SessionTimeoutSettingsComponentService
{
  availableTimeoutOptions$: Observable<VaultTimeoutOption[]> = defer(() => {
    const options: VaultTimeoutOption[] = [
      { name: this.i18nService.t("immediately"), value: 0 },
      { name: this.i18nService.t("oneMinute"), value: 1 },
      { name: this.i18nService.t("fiveMinutes"), value: 5 },
      { name: this.i18nService.t("fifteenMinutes"), value: 15 },
      { name: this.i18nService.t("thirtyMinutes"), value: 30 },
      { name: this.i18nService.t("oneHour"), value: 60 },
      { name: this.i18nService.t("fourHours"), value: 240 },
    ];

    const showOnLocked =
      !this.platformUtilsService.isFirefox() &&
      !this.platformUtilsService.isSafari() &&
      !(this.platformUtilsService.isOpera() && navigator.platform === "MacIntel");

    if (showOnLocked) {
      options.push({
        name: this.i18nService.t("onLocked"),
        value: VaultTimeoutStringType.OnLocked,
      });
    }

    options.push(
      { name: this.i18nService.t("onRestart"), value: VaultTimeoutStringType.OnRestart },
      { name: this.i18nService.t("never"), value: VaultTimeoutStringType.Never },
    );

    return of(options);
  });

  constructor(
    private readonly i18nService: I18nService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly messagingService: MessagingService,
  ) {}

  onTimeoutSave(timeout: VaultTimeout): void {
    if (timeout === VaultTimeoutStringType.Never) {
      this.messagingService.send("bgReseedStorage");
    }
  }
}
