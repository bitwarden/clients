// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  catchError,
  combineLatest,
  concatMap,
  distinctUntilChanged,
  EMPTY,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { BiometricStateService, KeyService } from "@bitwarden/key-management";

import { PolicyService } from "../../../admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../../admin-console/enums";
import { getFirstPolicy } from "../../../admin-console/services/policy/default-policy.service";
import { AccountService } from "../../../auth/abstractions/account.service";
import { TokenService } from "../../../auth/abstractions/token.service";
import { getUserId } from "../../../auth/services/account.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { PinStateServiceAbstraction } from "../../pin/pin-state.service.abstraction";
import { MaximumSessionTimeoutPolicyData, SessionTimeoutTypeService } from "../../session-timeout";
import { VaultTimeoutSettingsService as VaultTimeoutSettingsServiceAbstraction } from "../abstractions/vault-timeout-settings.service";
import { VaultTimeoutAction } from "../enums/vault-timeout-action.enum";
import {
  isVaultTimeoutTypeNumeric,
  VaultTimeout,
  VaultTimeoutNumberType,
  VaultTimeoutStringType,
} from "../types/vault-timeout.type";

import {
  VAULT_TIMEOUT,
  VAULT_TIMEOUT_ACTION,
  VAULT_TIMEOUT_SUPPRESSED_UNTIL,
} from "./vault-timeout-settings.state";

export class VaultTimeoutSettingsService implements VaultTimeoutSettingsServiceAbstraction {
  constructor(
    private accountService: AccountService,
    private pinStateService: PinStateServiceAbstraction,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private keyService: KeyService,
    private tokenService: TokenService,
    private policyService: PolicyService,
    private biometricStateService: BiometricStateService,
    private stateProvider: StateProvider,
    private logService: LogService,
    private defaultVaultTimeout: VaultTimeout,
    private sessionTimeoutTypeService: SessionTimeoutTypeService,
  ) {}

  async setVaultTimeoutOptions(
    userId: UserId,
    timeout: VaultTimeout,
    action: VaultTimeoutAction,
  ): Promise<void> {
    if (!userId) {
      throw new Error("User id required. Cannot set vault timeout settings.");
    }

    if (timeout == null) {
      throw new Error("Vault Timeout cannot be null.");
    }

    if (action == null) {
      throw new Error("Vault Timeout Action cannot be null.");
    }

    await this.setVaultTimeout(userId, timeout);

    await this.setVaultTimeoutAction(userId, action);

    await this.migrateTokenStorage(userId, action, timeout);

    await this.keyService.refreshAdditionalKeys(userId);
  }

  availableVaultTimeoutActions$(userId?: UserId): Observable<VaultTimeoutAction[]> {
    const userId$ =
      userId != null
        ? of(userId)
        : // TODO remove with https://bitwarden.atlassian.net/browse/PM-10647
          getUserId(this.accountService.activeAccount$);

    return userId$.pipe(
      switchMap((userId) =>
        combineLatest([
          this.userDecryptionOptionsService.hasMasterPasswordById$(userId),
          this.biometricStateService.biometricUnlockEnabled$(userId),
          this.pinStateService.pinSet$(userId),
        ]),
      ),
      map(([haveMasterPassword, biometricUnlockEnabled, isPinSet]) => {
        const canLock = haveMasterPassword || biometricUnlockEnabled || isPinSet;
        if (canLock) {
          return [VaultTimeoutAction.LogOut, VaultTimeoutAction.Lock];
        }
        return [VaultTimeoutAction.LogOut];
      }),
    );
  }

  async canLock(userId: UserId): Promise<boolean> {
    const availableVaultTimeoutActions: VaultTimeoutAction[] = await firstValueFrom(
      this.availableVaultTimeoutActions$(userId),
    );
    return availableVaultTimeoutActions?.includes(VaultTimeoutAction.Lock) || false;
  }

  async isBiometricLockSet(userId?: UserId): Promise<boolean> {
    return await firstValueFrom(this.biometricStateService.biometricUnlockEnabled$(userId));
  }

  private async setVaultTimeout(userId: UserId, timeout: VaultTimeout): Promise<void> {
    if (!userId) {
      throw new Error("User id required. Cannot set vault timeout.");
    }

    if (timeout == null) {
      throw new Error("Vault Timeout cannot be null.");
    }

    await this.stateProvider.setUserState(VAULT_TIMEOUT, timeout, userId);
  }

  getVaultTimeoutByUserId$(userId: UserId): Observable<VaultTimeout> {
    if (!userId) {
      throw new Error("User id required. Cannot get vault timeout.");
    }

    return combineLatest([
      this.stateProvider.getUserState$(VAULT_TIMEOUT, userId),
      this.getMaxSessionTimeoutPolicyDataByUserId$(userId),
    ]).pipe(
      switchMap(([currentVaultTimeout, maxSessionTimeoutPolicyData]) => {
        this.logService.debug(
          "[VaultTimeoutSettingsService] Current vault timeout is %o for user id %s, max session policy %o",
          currentVaultTimeout,
          userId,
          maxSessionTimeoutPolicyData,
        );
        return from(
          this.determineVaultTimeout(currentVaultTimeout, maxSessionTimeoutPolicyData),
        ).pipe(
          concatMap(async (vaultTimeout: VaultTimeout) => {
            this.logService.debug(
              "[VaultTimeoutSettingsService] Determined vault timeout is %o for user id %s",
              vaultTimeout,
              userId,
            );

            // As a side effect, set the new value determined by determineVaultTimeout into state if it's different from the current
            if (vaultTimeout !== currentVaultTimeout) {
              await this.stateProvider.setUserState(VAULT_TIMEOUT, vaultTimeout, userId);
            }
            return vaultTimeout;
          }),
          catchError((error: unknown) => {
            // Protect outer observable from canceling on error by catching and returning EMPTY
            this.logService.error(`Error getting vault timeout: ${error}`);
            return EMPTY;
          }),
        );
      }),
      distinctUntilChanged(), // Avoid having the set side effect trigger a new emission of the same action
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  private async determineVaultTimeout(
    currentVaultTimeout: VaultTimeout | null,
    maxSessionTimeoutPolicyData: MaximumSessionTimeoutPolicyData | null,
  ): Promise<VaultTimeout> {
    const determinedTimeout = await this.determineVaultTimeoutInternal(
      currentVaultTimeout,
      maxSessionTimeoutPolicyData,
    );

    // Ensures the timeout is available on this client
    return await this.sessionTimeoutTypeService.getOrPromoteToAvailable(determinedTimeout);
  }

  private async determineVaultTimeoutInternal(
    currentVaultTimeout: VaultTimeout | null,
    maxSessionTimeoutPolicyData: MaximumSessionTimeoutPolicyData | null,
  ): Promise<VaultTimeout> {
    // if current vault timeout is null, apply the client specific default
    currentVaultTimeout = currentVaultTimeout ?? this.defaultVaultTimeout;

    // If no policy applies, return the current vault timeout
    if (maxSessionTimeoutPolicyData == null) {
      return currentVaultTimeout;
    }

    switch (maxSessionTimeoutPolicyData.type) {
      case "immediately":
        return VaultTimeoutNumberType.Immediately;
      case "custom":
      case null:
      case undefined:
        if (currentVaultTimeout === VaultTimeoutNumberType.Immediately) {
          return currentVaultTimeout;
        }
        if (isVaultTimeoutTypeNumeric(currentVaultTimeout)) {
          return Math.min(currentVaultTimeout as number, maxSessionTimeoutPolicyData.minutes);
        }
        return maxSessionTimeoutPolicyData.minutes;
      case "onSystemLock":
        if (
          currentVaultTimeout === VaultTimeoutStringType.Never ||
          currentVaultTimeout === VaultTimeoutStringType.OnRestart ||
          currentVaultTimeout === VaultTimeoutStringType.OnLocked ||
          currentVaultTimeout === VaultTimeoutStringType.OnIdle ||
          currentVaultTimeout === VaultTimeoutStringType.OnSleep
        ) {
          return VaultTimeoutStringType.OnLocked;
        }
        break;
      case "onAppRestart":
        if (
          currentVaultTimeout === VaultTimeoutStringType.Never ||
          currentVaultTimeout === VaultTimeoutStringType.OnLocked ||
          currentVaultTimeout === VaultTimeoutStringType.OnIdle ||
          currentVaultTimeout === VaultTimeoutStringType.OnSleep
        ) {
          return VaultTimeoutStringType.OnRestart;
        }
        break;
      case "never":
        // Policy doesn't override user preference for "never"
        break;
    }
    return currentVaultTimeout;
  }

  /**
   * Re-stores tokens in the correct location (memory vs disk) for the given action and timeout.
   */
  private async migrateTokenStorage(
    userId: UserId,
    action: VaultTimeoutAction,
    timeout: VaultTimeout,
  ): Promise<void> {
    // Read tokens before any clearing so they can be re-stored in the new location
    const accessToken = await this.tokenService.getAccessToken(userId);
    const refreshToken = await this.tokenService.getRefreshToken(userId);
    const clientId = await this.tokenService.getClientId(userId);
    const clientSecret = await this.tokenService.getClientSecret(userId);

    if (!accessToken) {
      return;
    }

    await this.tokenService.setTokens(accessToken, action, timeout, refreshToken, [
      clientId,
      clientSecret,
    ]);
  }

  private async setVaultTimeoutAction(userId: UserId, action: VaultTimeoutAction): Promise<void> {
    if (!userId) {
      throw new Error("User id required. Cannot set vault timeout action.");
    }

    if (!action) {
      throw new Error("Vault Timeout Action cannot be null");
    }

    await this.stateProvider.setUserState(VAULT_TIMEOUT_ACTION, action, userId);
  }

  getVaultTimeoutActionByUserId$(userId: UserId): Observable<VaultTimeoutAction> {
    if (!userId) {
      throw new Error("User id required. Cannot get vault timeout action.");
    }

    return combineLatest([
      this.stateProvider.getUserState$(VAULT_TIMEOUT_ACTION, userId),
      this.getMaxSessionTimeoutPolicyDataByUserId$(userId),
      this.availableVaultTimeoutActions$(userId),
      this.getVaultTimeoutByUserId$(userId),
    ]).pipe(
      concatMap(
        async ([
          currentVaultTimeoutAction,
          maxSessionTimeoutPolicyData,
          availableVaultTimeoutActions,
          vaultTimeout,
        ]) => {
          const vaultTimeoutAction = this.determineVaultTimeoutAction(
            availableVaultTimeoutActions,
            currentVaultTimeoutAction,
            maxSessionTimeoutPolicyData,
          );

          // As a side effect, persist the determined action back to state when needed.
          const oneActionAvailable = availableVaultTimeoutActions.length === 1;
          if (oneActionAvailable) {
            const availableAction = availableVaultTimeoutActions[0];
            // Always reset to null when only one action is available — even if the stored action
            // matches. Ensures the default (Lock) is used when an unlock method (e.g. PIN) is
            // re-enabled later.
            if (currentVaultTimeoutAction !== null) {
              await this.stateProvider.setUserState(VAULT_TIMEOUT_ACTION, null, userId);
              // Only migrate tokens if the actual action changes (e.g. Lock → LogOut).
              // No migration needed when stored action already matches the only available one.
              if (currentVaultTimeoutAction !== availableAction) {
                await this.migrateTokenStorage(userId, availableAction, vaultTimeout);
              }
            }
          } else if (vaultTimeoutAction !== currentVaultTimeoutAction) {
            await this.stateProvider.setUserState(VAULT_TIMEOUT_ACTION, vaultTimeoutAction, userId);

            // Migrate tokens when effective action changes from LogOut (memory) to Lock (disk).
            // currentVaultTimeoutAction is null when forced LogOut was reset to null by the
            // side effect (no unlock methods) or the state migrator.
            if (
              currentVaultTimeoutAction === null &&
              vaultTimeoutAction === VaultTimeoutAction.Lock
            ) {
              await this.migrateTokenStorage(userId, vaultTimeoutAction, vaultTimeout);
            }
          }

          return vaultTimeoutAction;
        },
      ),
      catchError((error: unknown) => {
        // Protect outer observable from canceling on error by catching and returning EMPTY
        this.logService.error(`Error getting vault timeout: ${error}`);
        return EMPTY;
      }),
      distinctUntilChanged(), // Avoid having the set side effect trigger a new emission of the same action
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  private determineVaultTimeoutAction(
    availableVaultTimeoutActions: VaultTimeoutAction[],
    currentVaultTimeoutAction: VaultTimeoutAction | null,
    maxSessionTimeoutPolicyData: MaximumSessionTimeoutPolicyData | null,
  ): VaultTimeoutAction {
    if (availableVaultTimeoutActions.length === 1) {
      return availableVaultTimeoutActions[0];
    }

    if (
      maxSessionTimeoutPolicyData?.action &&
      availableVaultTimeoutActions.includes(
        maxSessionTimeoutPolicyData.action as VaultTimeoutAction,
      )
    ) {
      // return policy defined session timeout action
      return maxSessionTimeoutPolicyData.action as VaultTimeoutAction;
    }

    // No policy applies from here on
    // If the current vault timeout is null and lock is an option, set it as the default
    if (
      currentVaultTimeoutAction == null &&
      availableVaultTimeoutActions.includes(VaultTimeoutAction.Lock)
    ) {
      return VaultTimeoutAction.Lock;
    }

    return currentVaultTimeoutAction;
  }

  private getMaxSessionTimeoutPolicyDataByUserId$(
    userId: UserId,
  ): Observable<MaximumSessionTimeoutPolicyData | null> {
    if (!userId) {
      throw new Error("User id required. Cannot get max session timeout policy.");
    }

    return this.policyService.policiesByType$(PolicyType.MaximumVaultTimeout, userId).pipe(
      getFirstPolicy,
      map((policy) => (policy?.data ?? null) as MaximumSessionTimeoutPolicyData | null),
    );
  }

  vaultTimeoutSuppressedUntil$(userId: UserId): Observable<number | null> {
    if (!userId) {
      throw new Error("User id required. Cannot get vault timeout suppressed until.");
    }

    return this.stateProvider.getUserState$(VAULT_TIMEOUT_SUPPRESSED_UNTIL, userId);
  }

  isVaultTimeoutSuppressed$(userId: UserId): Observable<boolean> {
    return this.vaultTimeoutSuppressedUntil$(userId).pipe(
      map((until) => until != null && Date.now() < until),
    );
  }

  async isVaultTimeoutSuppressed(userId: UserId): Promise<boolean> {
    return await firstValueFrom(this.isVaultTimeoutSuppressed$(userId));
  }

  async suppressVaultTimeout(until: number, userId: UserId): Promise<void> {
    if (!userId) {
      throw new Error("User id required. Cannot suppress vault timeout.");
    }

    await this.stateProvider.getUser(userId, VAULT_TIMEOUT_SUPPRESSED_UNTIL).update(() => until);
  }

  async clearVaultTimeoutSuppression(userId: UserId): Promise<void> {
    if (!userId) {
      throw new Error("User id required. Cannot clear vault timeout suppression.");
    }

    await this.stateProvider.getUser(userId, VAULT_TIMEOUT_SUPPRESSED_UNTIL).update(() => null);
  }
}
