// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, map, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  FakeUserDecryptionOptions as UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { BiometricStateService, KeyService } from "@bitwarden/key-management";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { PolicyService } from "../../../admin-console/abstractions/policy/policy.service.abstraction";
import { Policy } from "../../../admin-console/models/domain/policy";
import { TokenService } from "../../../auth/services/token.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";
import { PinStateServiceAbstraction } from "../../pin/pin-state.service.abstraction";
import { VaultTimeoutSettingsService as VaultTimeoutSettingsServiceAbstraction } from "../abstractions/vault-timeout-settings.service";
import { VaultTimeoutAction } from "../enums/vault-timeout-action.enum";
import { VaultTimeout, VaultTimeoutStringType } from "../types/vault-timeout.type";

import { VaultTimeoutSettingsService } from "./vault-timeout-settings.service";
import { VAULT_TIMEOUT, VAULT_TIMEOUT_ACTION } from "./vault-timeout-settings.state";

describe("VaultTimeoutSettingsService", () => {
  let accountService: FakeAccountService;
  let pinStateService: MockProxy<PinStateServiceAbstraction>;
  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let keyService: MockProxy<KeyService>;
  let tokenService: MockProxy<TokenService>;
  let policyService: MockProxy<PolicyService>;
  const biometricStateService = mock<BiometricStateService>();
  let vaultTimeoutSettingsService: VaultTimeoutSettingsServiceAbstraction;

  let userDecryptionOptionsSubject: BehaviorSubject<UserDecryptionOptions>;

  const mockUserId = Utils.newGuid() as UserId;
  let stateProvider: FakeStateProvider;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    pinStateService = mock<PinStateServiceAbstraction>();
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    keyService = mock<KeyService>();
    tokenService = mock<TokenService>();
    policyService = mock<PolicyService>();

    userDecryptionOptionsSubject = new BehaviorSubject(null);
    userDecryptionOptionsService.userDecryptionOptions$ = userDecryptionOptionsSubject;
    userDecryptionOptionsService.hasMasterPassword$ = userDecryptionOptionsSubject.pipe(
      map((options) => options?.hasMasterPassword ?? false),
    );
    userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
      userDecryptionOptionsSubject,
    );

    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    logService = mock<LogService>();

    const defaultVaultTimeout: VaultTimeout = 15; // default web vault timeout
    vaultTimeoutSettingsService = createVaultTimeoutSettingsService(defaultVaultTimeout);

    biometricStateService.biometricUnlockEnabled$ = of(false);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("availableVaultTimeoutActions$", () => {
    it("always returns LogOut", async () => {
      const result = await firstValueFrom(
        vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
      );

      expect(result).toContain(VaultTimeoutAction.LogOut);
    });

    it("contains Lock when the user has a master password", async () => {
      userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));

      const result = await firstValueFrom(
        vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
      );

      expect(result).toContain(VaultTimeoutAction.Lock);
    });

    it("contains Lock when the user has either a persistent or ephemeral PIN configured", async () => {
      pinStateService.isPinSet.mockResolvedValue(true);

      const result = await firstValueFrom(
        vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
      );

      expect(result).toContain(VaultTimeoutAction.Lock);
    });

    it("contains Lock when the user has biometrics configured", async () => {
      biometricStateService.biometricUnlockEnabled$ = of(true);
      biometricStateService.getBiometricUnlockEnabled.mockResolvedValue(true);

      const result = await firstValueFrom(
        vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
      );

      expect(result).toContain(VaultTimeoutAction.Lock);
    });

    it("not contains Lock when the user does not have a master password, PIN, or biometrics", async () => {
      userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: false }));
      pinStateService.isPinSet.mockResolvedValue(false);
      biometricStateService.biometricUnlockEnabled$ = of(false);

      const result = await firstValueFrom(
        vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
      );

      expect(result).not.toContain(VaultTimeoutAction.Lock);
    });
  });

  describe("canLock", () => {
    it("returns true if the user can lock", async () => {
      jest
        .spyOn(vaultTimeoutSettingsService, "availableVaultTimeoutActions$")
        .mockReturnValue(of([VaultTimeoutAction.Lock]));

      const result = await vaultTimeoutSettingsService.canLock("userId" as UserId);

      expect(result).toBe(true);
    });

    it("returns false if the user only has the log out vault timeout action", async () => {
      jest
        .spyOn(vaultTimeoutSettingsService, "availableVaultTimeoutActions$")
        .mockReturnValue(of([VaultTimeoutAction.LogOut]));

      const result = await vaultTimeoutSettingsService.canLock("userId" as UserId);

      expect(result).toBe(false);
    });

    it("returns false if the user has no vault timeout actions", async () => {
      jest
        .spyOn(vaultTimeoutSettingsService, "availableVaultTimeoutActions$")
        .mockReturnValue(of([]));

      const result = await vaultTimeoutSettingsService.canLock("userId" as UserId);

      expect(result).toBe(false);
    });
  });

  describe("getVaultTimeoutActionByUserId$", () => {
    it("should throw an error if no user id is provided", async () => {
      expect(() => vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(null)).toThrow(
        "User id required. Cannot get vault timeout action.",
      );
    });

    describe("given the user has a master password", () => {
      it.each`
        policy                       | userPreference               | expected
        ${null}                      | ${null}                      | ${VaultTimeoutAction.Lock}
        ${null}                      | ${VaultTimeoutAction.LogOut} | ${VaultTimeoutAction.LogOut}
        ${VaultTimeoutAction.LogOut} | ${null}                      | ${VaultTimeoutAction.LogOut}
        ${VaultTimeoutAction.LogOut} | ${VaultTimeoutAction.Lock}   | ${VaultTimeoutAction.LogOut}
      `(
        "returns $expected when policy is $policy, and user preference is $userPreference",
        async ({ policy, userPreference, expected }) => {
          userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
          policyService.policiesByType$.mockReturnValue(
            of(policy === null ? [] : ([{ data: { action: policy } }] as unknown as Policy[])),
          );

          await stateProvider.setUserState(VAULT_TIMEOUT_ACTION, userPreference, mockUserId);

          const result = await firstValueFrom(
            vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(mockUserId),
          );

          expect(result).toBe(expected);
        },
      );
    });

    describe("given the user does not have a master password", () => {
      it.each`
        hasPinUnlock | hasBiometricUnlock | policy                     | userPreference               | expected
        ${false}     | ${false}           | ${null}                    | ${null}                      | ${VaultTimeoutAction.LogOut}
        ${false}     | ${false}           | ${null}                    | ${VaultTimeoutAction.Lock}   | ${VaultTimeoutAction.LogOut}
        ${false}     | ${false}           | ${VaultTimeoutAction.Lock} | ${null}                      | ${VaultTimeoutAction.LogOut}
        ${false}     | ${true}            | ${null}                    | ${null}                      | ${VaultTimeoutAction.Lock}
        ${false}     | ${true}            | ${null}                    | ${VaultTimeoutAction.Lock}   | ${VaultTimeoutAction.Lock}
        ${false}     | ${true}            | ${VaultTimeoutAction.Lock} | ${null}                      | ${VaultTimeoutAction.Lock}
        ${false}     | ${true}            | ${VaultTimeoutAction.Lock} | ${VaultTimeoutAction.LogOut} | ${VaultTimeoutAction.Lock}
        ${true}      | ${false}           | ${null}                    | ${null}                      | ${VaultTimeoutAction.Lock}
        ${true}      | ${false}           | ${null}                    | ${VaultTimeoutAction.Lock}   | ${VaultTimeoutAction.Lock}
        ${true}      | ${false}           | ${VaultTimeoutAction.Lock} | ${null}                      | ${VaultTimeoutAction.Lock}
        ${true}      | ${false}           | ${VaultTimeoutAction.Lock} | ${VaultTimeoutAction.LogOut} | ${VaultTimeoutAction.Lock}
      `(
        "returns $expected when policy is $policy, has PIN unlock method: $hasPinUnlock or Biometric unlock method: $hasBiometricUnlock, and user preference is $userPreference",
        async ({ hasPinUnlock, hasBiometricUnlock, policy, userPreference, expected }) => {
          biometricStateService.getBiometricUnlockEnabled.mockResolvedValue(hasBiometricUnlock);
          pinStateService.isPinSet.mockResolvedValue(hasPinUnlock);

          userDecryptionOptionsSubject.next(
            new UserDecryptionOptions({ hasMasterPassword: false }),
          );
          policyService.policiesByType$.mockReturnValue(
            of(policy === null ? [] : ([{ data: { action: policy } }] as unknown as Policy[])),
          );

          await stateProvider.setUserState(VAULT_TIMEOUT_ACTION, userPreference, mockUserId);

          const result = await firstValueFrom(
            vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(mockUserId),
          );

          expect(result).toBe(expected);
        },
      );
    });
  });

  describe("getVaultTimeoutByUserId$", () => {
    it("should throw an error if no user id is provided", async () => {
      expect(() => vaultTimeoutSettingsService.getVaultTimeoutByUserId$(null)).toThrow(
        "User id required. Cannot get vault timeout.",
      );
    });

    it.each([
      // policy, vaultTimeout, expected
      [null, null, 15], // no policy, no vault timeout, falls back to default
      [30, 90, 30], // policy overrides vault timeout
      [30, 15, 15], // policy doesn't override vault timeout when it's within acceptable range
      [90, VaultTimeoutStringType.Never, 90], // policy overrides vault timeout when it's "never"
      [null, VaultTimeoutStringType.Never, VaultTimeoutStringType.Never], // no policy, persist "never" vault timeout
      [90, 0, 0], // policy doesn't override vault timeout when it's 0 (immediate)
      [null, 0, 0], // no policy, persist 0 (immediate) vault timeout
      [90, VaultTimeoutStringType.OnRestart, 90], // policy overrides vault timeout when it's "onRestart"
      [null, VaultTimeoutStringType.OnRestart, VaultTimeoutStringType.OnRestart], // no policy, persist "onRestart" vault timeout
      [90, VaultTimeoutStringType.OnLocked, 90], // policy overrides vault timeout when it's "onLocked"
      [null, VaultTimeoutStringType.OnLocked, VaultTimeoutStringType.OnLocked], // no policy, persist "onLocked" vault timeout
      [90, VaultTimeoutStringType.OnSleep, 90], // policy overrides vault timeout when it's "onSleep"
      [null, VaultTimeoutStringType.OnSleep, VaultTimeoutStringType.OnSleep], // no policy, persist "onSleep" vault timeout
      [90, VaultTimeoutStringType.OnIdle, 90], // policy overrides vault timeout when it's "onIdle"
      [null, VaultTimeoutStringType.OnIdle, VaultTimeoutStringType.OnIdle], // no policy, persist "onIdle" vault timeout
    ])(
      "when policy is %s, and vault timeout is %s, returns %s",
      async (policy, vaultTimeout, expected) => {
        userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
        policyService.policiesByType$.mockReturnValue(
          of(policy === null ? [] : ([{ data: { minutes: policy } }] as unknown as Policy[])),
        );

        await stateProvider.setUserState(VAULT_TIMEOUT, vaultTimeout, mockUserId);

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(result).toBe(expected);
      },
    );
  });

  describe("setVaultTimeoutOptions", () => {
    const mockAccessToken = "mockAccessToken";
    const mockRefreshToken = "mockRefreshToken";
    const mockClientId = "mockClientId";
    const mockClientSecret = "mockClientSecret";

    it("should throw an error if no user id is provided", async () => {
      // note: don't await here because we want to test the error
      const result = vaultTimeoutSettingsService.setVaultTimeoutOptions(null, null, null);
      // Assert
      await expect(result).rejects.toThrow("User id required. Cannot set vault timeout settings.");
    });

    it("should not throw an error if 0 is provided as the timeout", async () => {
      // note: don't await here because we want to test the error
      const result = vaultTimeoutSettingsService.setVaultTimeoutOptions(
        mockUserId,
        0,
        VaultTimeoutAction.Lock,
      );
      // Assert
      await expect(result).resolves.not.toThrow();
    });

    it("should throw an error if a null vault timeout is provided", async () => {
      // note: don't await here because we want to test the error
      const result = vaultTimeoutSettingsService.setVaultTimeoutOptions(mockUserId, null, null);
      // Assert
      await expect(result).rejects.toThrow("Vault Timeout cannot be null.");
    });

    it("should throw an error if a null vault timout action is provided", async () => {
      // note: don't await here because we want to test the error
      const result = vaultTimeoutSettingsService.setVaultTimeoutOptions(mockUserId, 30, null);
      // Assert
      await expect(result).rejects.toThrow("Vault Timeout Action cannot be null.");
    });

    it("should set the vault timeout options for the given user", async () => {
      // Arrange
      tokenService.getAccessToken.mockResolvedValue(mockAccessToken);
      tokenService.getRefreshToken.mockResolvedValue(mockRefreshToken);
      tokenService.getClientId.mockResolvedValue(mockClientId);
      tokenService.getClientSecret.mockResolvedValue(mockClientSecret);

      const action = VaultTimeoutAction.Lock;
      const timeout = 30;

      // Act
      await vaultTimeoutSettingsService.setVaultTimeoutOptions(mockUserId, timeout, action);

      // Assert
      expect(tokenService.setTokens).toHaveBeenCalledWith(
        mockAccessToken,
        action,
        timeout,
        mockRefreshToken,
        [mockClientId, mockClientSecret],
      );

      expect(
        stateProvider.singleUser.getFake(mockUserId, VAULT_TIMEOUT_ACTION).nextMock,
      ).toHaveBeenCalledWith(action);

      expect(
        stateProvider.singleUser.getFake(mockUserId, VAULT_TIMEOUT).nextMock,
      ).toHaveBeenCalledWith(timeout);

      expect(keyService.refreshAdditionalKeys).toHaveBeenCalled();
    });

    it("should clear the tokens when the timeout is not never and the action is log out", async () => {
      // Arrange
      const action = VaultTimeoutAction.LogOut;
      const timeout = 30;

      // Act
      await vaultTimeoutSettingsService.setVaultTimeoutOptions(mockUserId, timeout, action);

      // Assert
      expect(tokenService.clearTokens).toHaveBeenCalled();
    });

    it("should not clear the tokens when the timeout is never and the action is log out", async () => {
      // Arrange
      const action = VaultTimeoutAction.LogOut;
      const timeout = VaultTimeoutStringType.Never;

      // Act
      await vaultTimeoutSettingsService.setVaultTimeoutOptions(mockUserId, timeout, action);

      // Assert
      expect(tokenService.clearTokens).not.toHaveBeenCalled();
    });
  });

  function createVaultTimeoutSettingsService(
    defaultVaultTimeout: VaultTimeout,
  ): VaultTimeoutSettingsService {
    return new VaultTimeoutSettingsService(
      accountService,
      pinStateService,
      userDecryptionOptionsService,
      keyService,
      tokenService,
      policyService,
      biometricStateService,
      stateProvider,
      logService,
      defaultVaultTimeout,
    );
  }
});
