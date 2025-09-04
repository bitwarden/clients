// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  EMPTY,
  Observable,
  catchError,
  combineLatest,
  defer,
  distinctUntilChanged,
  firstValueFrom,
  from,
  shareReplay,
  switchMap,
  tap,
} from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { BiometricStateService, KeyService } from "@bitwarden/key-management";

import { PolicyService } from "../../../admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../../admin-console/enums";
import { Policy } from "../../../admin-console/models/domain/policy";
import { getFirstPolicy } from "../../../admin-console/services/policy/default-policy.service";
import { AccountService } from "../../../auth/abstractions/account.service";
import { TokenService } from "../../../auth/abstractions/token.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { PinServiceAbstraction } from "../../pin/pin.service.abstraction";
import { VaultTimeoutSettingsService as VaultTimeoutSettingsServiceAbstraction } from "../abstractions/vault-timeout-settings.service";
import { VaultTimeoutAction } from "../enums/vault-timeout-action.enum";
import { VaultTimeout, VaultTimeoutStringType } from "../types/vault-timeout.type";

import { VAULT_TIMEOUT, VAULT_TIMEOUT_ACTION } from "./vault-timeout-settings.state";

export class VaultTimeoutSettingsService implements VaultTimeoutSettingsServiceAbstraction {
  constructor(
    private accountService: AccountService,
    private pinService: PinServiceAbstraction,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private keyService: KeyService,
    private tokenService: TokenService,
    private policyService: PolicyService,
    private biometricStateService: BiometricStateService,
    private stateProvider: StateProvider,
    private logService: LogService,
    private defaultVaultTimeout: VaultTimeout,
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

    // We swap these tokens from being on disk for lock actions, and in memory for logout actions
    // Get them here to set them to their new location after changing the timeout action and clearing if needed
    const accessToken = await this.tokenService.getAccessToken(userId);
    const refreshToken = await this.tokenService.getRefreshToken(userId);
    const clientId = await this.tokenService.getClientId(userId);
    const clientSecret = await this.tokenService.getClientSecret(userId);

    await this.setVaultTimeout(userId, timeout);

    if (timeout != VaultTimeoutStringType.Never && action === VaultTimeoutAction.LogOut) {
      // if we have a vault timeout and the action is log out, reset tokens
      // as the tokens were stored on disk and now should be stored in memory
      await this.tokenService.clearTokens(userId);
    }

    await this.setVaultTimeoutAction(userId, action);

    await this.tokenService.setTokens(accessToken, action, timeout, refreshToken, [
      clientId,
      clientSecret,
    ]);

    await this.keyService.refreshAdditionalKeys(userId);
  }

  availableVaultTimeoutActions$(userId?: string): Observable<VaultTimeoutAction[]> {
    return defer(() => this.getAvailableVaultTimeoutActions(userId));
  }

  async canLock(userId: UserId): Promise<boolean> {
    const availableVaultTimeoutActions: VaultTimeoutAction[] = await firstValueFrom(
      this.availableVaultTimeoutActions$(userId),
    );
    return availableVaultTimeoutActions?.includes(VaultTimeoutAction.Lock) || false;
  }

  async isBiometricLockSet(userId?: string): Promise<boolean> {
    const biometricUnlockPromise =
      userId == null
        ? firstValueFrom(this.biometricStateService.biometricUnlockEnabled$)
        : this.biometricStateService.getBiometricUnlockEnabled(userId as UserId);
    return await biometricUnlockPromise;
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
      this.getMaxVaultTimeoutPolicyByUserId$(userId),
    ]).pipe(
      switchMap(([currentVaultTimeout, maxVaultTimeoutPolicy]) => {
        return from(this.determineVaultTimeout(currentVaultTimeout, maxVaultTimeoutPolicy)).pipe(
          tap((vaultTimeout: VaultTimeout) => {
            // As a side effect, set the new value determined by determineVaultTimeout into state if it's different from the current
            if (vaultTimeout !== currentVaultTimeout) {
              return this.stateProvider.setUserState(VAULT_TIMEOUT, vaultTimeout, userId);
            }
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
    maxVaultTimeoutPolicy: Policy | null,
  ): Promise<VaultTimeout | null> {
    // if current vault timeout is null, apply the client specific default
    currentVaultTimeout = currentVaultTimeout ?? this.defaultVaultTimeout;

    // If no policy applies, return the current vault timeout
    if (!maxVaultTimeoutPolicy) {
      return currentVaultTimeout;
    }

    // User is subject to a max vault timeout policy
    const maxVaultTimeoutPolicyData = maxVaultTimeoutPolicy.data;

    // If the current vault timeout is not numeric, change it to the policy compliant value
    if (typeof currentVaultTimeout === "string") {
      return maxVaultTimeoutPolicyData.minutes;
    }

    // For numeric vault timeouts, ensure they are smaller than maximum allowed value according to policy
    const policyCompliantTimeout = Math.min(currentVaultTimeout, maxVaultTimeoutPolicyData.minutes);

    return policyCompliantTimeout;
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
      this.getMaxVaultTimeoutPolicyByUserId$(userId),
    ]).pipe(
      switchMap(([currentVaultTimeoutAction, maxVaultTimeoutPolicy]) => {
        return from(
          this.determineVaultTimeoutAction(
            userId,
            currentVaultTimeoutAction,
            maxVaultTimeoutPolicy,
          ),
        ).pipe(
          tap((vaultTimeoutAction: VaultTimeoutAction) => {
            // As a side effect, set the new value determined by determineVaultTimeout into state if it's different from the current
            // We want to avoid having a null timeout action always so we set it to the default if it is null
            // and if the user becomes subject to a policy that requires a specific action, we set it to that
            if (vaultTimeoutAction !== currentVaultTimeoutAction) {
              return this.stateProvider.setUserState(
                VAULT_TIMEOUT_ACTION,
                vaultTimeoutAction,
                userId,
              );
            }
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

  private async determineVaultTimeoutAction(
    userId: string,
    currentVaultTimeoutAction: VaultTimeoutAction | null,
    maxVaultTimeoutPolicy: Policy | null,
  ): Promise<VaultTimeoutAction> {
    const availableVaultTimeoutActions = await this.getAvailableVaultTimeoutActions(userId);
    if (availableVaultTimeoutActions.length === 1) {
      return availableVaultTimeoutActions[0];
    }

    if (
      maxVaultTimeoutPolicy?.data?.action &&
      availableVaultTimeoutActions.includes(maxVaultTimeoutPolicy.data.action)
    ) {
      // return policy defined vault timeout action
      return maxVaultTimeoutPolicy.data.action;
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

  private getMaxVaultTimeoutPolicyByUserId$(userId: UserId): Observable<Policy | null> {
    if (!userId) {
      throw new Error("User id required. Cannot get max vault timeout policy.");
    }

    return this.policyService
      .policiesByType$(PolicyType.MaximumVaultTimeout, userId)
      .pipe(getFirstPolicy);
  }

  private async getAvailableVaultTimeoutActions(userId?: string): Promise<VaultTimeoutAction[]> {
    userId ??= (await firstValueFrom(this.accountService.activeAccount$))?.id;

    const availableActions = [VaultTimeoutAction.LogOut];

    const canLock =
      (await this.userHasMasterPassword(userId)) ||
      (await this.pinService.isPinSet(userId as UserId)) ||
      (await this.isBiometricLockSet(userId));

    if (canLock) {
      availableActions.push(VaultTimeoutAction.Lock);
    }

    return availableActions;
  }

  private async userHasMasterPassword(userId: string): Promise<boolean> {
    if (userId) {
      const decryptionOptions = await firstValueFrom(
        this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
      );

      return !!decryptionOptions?.hasMasterPassword;
    } else {
      return await firstValueFrom(this.userDecryptionOptionsService.hasMasterPassword$);
    }
  }
}
