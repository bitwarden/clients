import { combineLatest, defer, map, Observable } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import {
  MaximumSessionTimeoutPolicyData,
  SessionTimeoutTypeService,
} from "@bitwarden/common/key-management/session-timeout";
import {
  VaultTimeout,
  VaultTimeoutOption,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import {
  isVaultTimeoutTypeNumeric,
  VaultTimeoutNumberType,
} from "@bitwarden/common/key-management/vault-timeout/types/vault-timeout.type";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/user-core";

export class SessionTimeoutSettingsComponentService {
  private readonly availableTimeoutOptions$: Observable<VaultTimeoutOption[]>;

  constructor(
    protected readonly i18nService: I18nService,
    protected readonly sessionTimeoutTypeService: SessionTimeoutTypeService,
    protected readonly policyService: PolicyService,
  ) {
    this.availableTimeoutOptions$ = defer(async () => {
      const allOptions = this.getAllTimeoutOptions();
      const availableOptions: VaultTimeoutOption[] = [];

      for (const option of allOptions) {
        if (await this.sessionTimeoutTypeService.isAvailable(option.value)) {
          availableOptions.push(option);
        }
      }

      return availableOptions;
    });
  }

  onTimeoutSave(_timeout: VaultTimeout): void {
    // Default implementation does nothing, but other clients might want to override this
  }

  policyFilteredTimeoutOptions$(userId: UserId): Observable<VaultTimeoutOption[]> {
    return combineLatest([
      this.availableTimeoutOptions$,
      this.policyService
        .policiesByType$(PolicyType.MaximumVaultTimeout, userId)
        .pipe(getFirstPolicy),
    ]).pipe(
      map(([options, policy]) => {
        if (policy == null) {
          return options;
        }

        const policyData = policy.data as MaximumSessionTimeoutPolicyData;
        const policyType = policyData.type;

        return options.filter((option) => {
          switch (policyType) {
            case "immediately": {
              // Policy requires immediate lock. If "immediately" is available, use it.
              // Otherwise, fall back to the lowest available option (1 minute)
              const hasImmediately = options.some(
                (opt) => opt.value === VaultTimeoutNumberType.Immediately,
              );
              if (hasImmediately) {
                return option.value === VaultTimeoutNumberType.Immediately;
              }
              return option.value === VaultTimeoutNumberType.OnMinute;
            }

            case "onSystemLock":
              // Allow immediately, numeric values, custom, and any system lock-related options
              if (
                option.value === VaultTimeoutNumberType.Immediately ||
                isVaultTimeoutTypeNumeric(option.value) ||
                option.value === VaultTimeoutStringType.Custom
              ) {
                return true;
              }

              return (
                option.value === VaultTimeoutStringType.OnLocked ||
                option.value === VaultTimeoutStringType.OnIdle ||
                option.value === VaultTimeoutStringType.OnSleep ||
                option.value === VaultTimeoutStringType.OnRestart
              );

            case "onAppRestart":
              // Allow immediately, numeric values, custom, and on app restart
              return (
                option.value === VaultTimeoutNumberType.Immediately ||
                isVaultTimeoutTypeNumeric(option.value) ||
                option.value === VaultTimeoutStringType.Custom ||
                option.value === VaultTimeoutStringType.OnRestart
              );

            case "custom":
            case null:
            case undefined:
              // Allow immediately, custom, and numeric values within policy limit
              return (
                option.value === VaultTimeoutNumberType.Immediately ||
                option.value === VaultTimeoutStringType.Custom ||
                (isVaultTimeoutTypeNumeric(option.value) &&
                  (option.value as number) <= policyData.minutes)
              );

            case "never":
              // No policy restriction
              return true;

            default:
              throw Error(`Unsupported policy type: ${policyType}`);
          }
        });
      }),
    );
  }

  private getAllTimeoutOptions(): VaultTimeoutOption[] {
    return [
      { name: "immediately", value: VaultTimeoutNumberType.Immediately },
      { name: "oneMinute", value: VaultTimeoutNumberType.OnMinute },
      { name: "fiveMinutes", value: 5 },
      { name: "fifteenMinutes", value: 15 },
      { name: "thirtyMinutes", value: 30 },
      { name: "oneHour", value: 60 },
      { name: "fourHours", value: 240 },
      { name: "onIdle", value: VaultTimeoutStringType.OnIdle },
      { name: "onSleep", value: VaultTimeoutStringType.OnSleep },
      { name: "onLocked", value: VaultTimeoutStringType.OnLocked },
      { name: "sessionTimeoutOnRestart", value: VaultTimeoutStringType.OnRestart },
      { name: "never", value: VaultTimeoutStringType.Never },
      { name: "custom", value: VaultTimeoutStringType.Custom },
    ];
  }
}
