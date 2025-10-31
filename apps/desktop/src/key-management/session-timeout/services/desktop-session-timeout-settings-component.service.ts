import { defer, from, map, Observable } from "rxjs";

import {
  VaultTimeout,
  VaultTimeoutOption,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SessionTimeoutSettingsComponentService } from "@bitwarden/key-management-ui";

export class DesktopSessionTimeoutSettingsComponentService
  implements SessionTimeoutSettingsComponentService
{
  availableTimeoutOptions$: Observable<VaultTimeoutOption[]> = defer(() =>
    from(ipc.platform.powermonitor.isLockMonitorAvailable()).pipe(
      map((isLockMonitorAvailable) => {
        const options: VaultTimeoutOption[] = [
          { name: this.i18nService.t("oneMinute"), value: 1 },
          { name: this.i18nService.t("fiveMinutes"), value: 5 },
          { name: this.i18nService.t("fifteenMinutes"), value: 15 },
          { name: this.i18nService.t("thirtyMinutes"), value: 30 },
          { name: this.i18nService.t("oneHour"), value: 60 },
          { name: this.i18nService.t("fourHours"), value: 240 },
          { name: this.i18nService.t("onIdle"), value: VaultTimeoutStringType.OnIdle },
          { name: this.i18nService.t("onSleep"), value: VaultTimeoutStringType.OnSleep },
        ];

        if (isLockMonitorAvailable) {
          options.push({
            name: this.i18nService.t("onLocked"),
            value: VaultTimeoutStringType.OnLocked,
          });
        }

        options.push(
          { name: this.i18nService.t("onRestart"), value: VaultTimeoutStringType.OnRestart },
          { name: this.i18nService.t("never"), value: VaultTimeoutStringType.Never },
        );

        return options;
      }),
    ),
  );

  constructor(private readonly i18nService: I18nService) {}

  onTimeoutSave(_: VaultTimeout): void {}
}
