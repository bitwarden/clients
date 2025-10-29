import { defer, Observable, of } from "rxjs";

import {
  VaultTimeout,
  VaultTimeoutOption,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SessionTimeoutSettingsComponentService } from "@bitwarden/key-management-ui";

export class WebSessionTimeoutSettingsComponentService extends SessionTimeoutSettingsComponentService {
  constructor(
    private readonly i18nService: I18nService,
    private readonly platformUtilsService: PlatformUtilsService,
  ) {
    super();
  }

  override availableTimeoutOptions$: Observable<VaultTimeoutOption[]> = defer(() => {
    const options: VaultTimeoutOption[] = [
      { name: this.i18nService.t("oneMinute"), value: 1 },
      { name: this.i18nService.t("fiveMinutes"), value: 5 },
      { name: this.i18nService.t("fifteenMinutes"), value: 15 },
      { name: this.i18nService.t("thirtyMinutes"), value: 30 },
      { name: this.i18nService.t("oneHour"), value: 60 },
      { name: this.i18nService.t("fourHours"), value: 240 },
      { name: this.i18nService.t("onRefresh"), value: VaultTimeoutStringType.OnRestart },
    ];

    if (this.platformUtilsService.isDev()) {
      options.push({ name: this.i18nService.t("never"), value: VaultTimeoutStringType.Never });
    }

    return of(options);
  });

  override onTimeoutSave(_: VaultTimeout): void {}
}
