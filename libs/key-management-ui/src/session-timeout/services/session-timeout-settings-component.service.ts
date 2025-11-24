import { combineLatest, concatMap, defer, map, Observable } from "rxjs";

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
      const availabilityResults = await Promise.all(
        allOptions.map(async (option) => ({
          option,
          available: await this.sessionTimeoutTypeService.isAvailable(option.value),
        })),
      );

      return availabilityResults
        .filter((result) => result.available)
        .map((result) => result.option);
    });
  }

  onTimeoutSave(_timeout: VaultTimeout): void {
    // Default implementation does nothing, but other clients might want to override this
  }

  policyFilteredTimeoutOptions$(userId: UserId): Observable<VaultTimeoutOption[]> {
    const policyData$ = this.policyService
      .policiesByType$(PolicyType.MaximumVaultTimeout, userId)
      .pipe(
        getFirstPolicy,
        map((policy) => (policy?.data ?? null) as MaximumSessionTimeoutPolicyData | null),
      );

    return combineLatest([
      this.availableTimeoutOptions$,
      policyData$,
      policyData$.pipe(
        concatMap(async (policyData) => {
          if (policyData == null) {
            return null;
          }
          switch (policyData.type) {
            case "immediately":
              return await this.sessionTimeoutTypeService.getOrPromoteToAvailable(
                VaultTimeoutNumberType.Immediately,
              );
            case "onSystemLock":
              return await this.sessionTimeoutTypeService.getOrPromoteToAvailable(
                VaultTimeoutStringType.OnLocked,
              );
          }

          return null;
        }),
      ),
    ]).pipe(
      concatMap(
        async ([availableOptions, policyData, highestAvailableEnforcedByPolicyTimeoutType]) => {
          if (policyData == null) {
            return availableOptions;
          }

          return availableOptions.filter((option) => {
            switch (policyData.type) {
              case "immediately": {
                // Policy requires immediate lock.
                return option.value === highestAvailableEnforcedByPolicyTimeoutType;
              }

              case "onSystemLock": {
                // Allow immediately, numeric values, custom, and any system lock-related options.
                if (
                  option.value === VaultTimeoutNumberType.Immediately ||
                  isVaultTimeoutTypeNumeric(option.value) ||
                  option.value === VaultTimeoutStringType.Custom ||
                  option.value === VaultTimeoutStringType.OnLocked ||
                  option.value === VaultTimeoutStringType.OnIdle ||
                  option.value === VaultTimeoutStringType.OnSleep
                ) {
                  return true;
                }

                // When on locked is not supported, fallback.
                return option.value === highestAvailableEnforcedByPolicyTimeoutType;
              }

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
                throw Error(`Unsupported policy type: ${policyData.type}`);
            }
          });
        },
      ),
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
