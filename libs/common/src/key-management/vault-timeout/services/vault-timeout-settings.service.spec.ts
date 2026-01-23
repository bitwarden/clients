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
import { SessionTimeoutTypeService } from "../../session-timeout";
import { VaultTimeoutSettingsService as VaultTimeoutSettingsServiceAbstraction } from "../abstractions/vault-timeout-settings.service";
import { VaultTimeoutAction } from "../enums/vault-timeout-action.enum";
import {
  VaultTimeout,
  VaultTimeoutNumberType,
  VaultTimeoutStringType,
} from "../types/vault-timeout.type";

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

  const defaultVaultTimeout: VaultTimeout = 15; // default web vault timeout
  const mockUserId = Utils.newGuid() as UserId;
  let stateProvider: FakeStateProvider;
  let logService: MockProxy<LogService>;
  let sessionTimeoutTypeService: MockProxy<SessionTimeoutTypeService>;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    pinStateService = mock<PinStateServiceAbstraction>();
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    keyService = mock<KeyService>();
    tokenService = mock<TokenService>();
    policyService = mock<PolicyService>();

    userDecryptionOptionsSubject = new BehaviorSubject(null);
    userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
      userDecryptionOptionsSubject,
    );
    userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(
      userDecryptionOptionsSubject.pipe(map((options) => options?.hasMasterPassword ?? false)),
    );
    userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
      userDecryptionOptionsSubject,
    );

    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    logService = mock<LogService>();
    sessionTimeoutTypeService = mock<SessionTimeoutTypeService>();

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

    it("should return only LogOut when userId is not provided and there is no active account", async () => {
      // Set up accountService to return null for activeAccount
      accountService.activeAccount$ = of(null);
      pinStateService.isPinSet.mockResolvedValue(false);
      biometricStateService.biometricUnlockEnabled$ = of(false);

      // Call availableVaultTimeoutActions$ which internally calls userHasMasterPassword without a userId
      const result = await firstValueFrom(
        vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
      );

      // Since there's no active account, userHasMasterPassword returns false,
      // meaning no master password is available, so Lock should not be available
      expect(result).toEqual([VaultTimeoutAction.LogOut]);
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
    beforeEach(() => {
      // Return the input value unchanged
      sessionTimeoutTypeService.getOrPromoteToAvailable.mockImplementation(
        async (timeout) => timeout,
      );
    });

    it("should throw an error if no user id is provided", async () => {
      expect(() => vaultTimeoutSettingsService.getVaultTimeoutByUserId$(null)).toThrow(
        "User id required. Cannot get vault timeout.",
      );
    });

    describe("no policy", () => {
      it("when vault timeout is null, returns default", async () => {
        userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
        policyService.policiesByType$.mockReturnValue(of([]));

        await stateProvider.setUserState(VAULT_TIMEOUT, null, mockUserId);

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          defaultVaultTimeout,
        );
        expect(result).toBe(defaultVaultTimeout);
      });

      it.each([
        VaultTimeoutNumberType.Immediately,
        VaultTimeoutNumberType.OnMinute,
        VaultTimeoutNumberType.EightHours,
        VaultTimeoutStringType.Never,
        VaultTimeoutStringType.OnRestart,
        VaultTimeoutStringType.OnLocked,
        VaultTimeoutStringType.OnSleep,
        VaultTimeoutStringType.OnIdle,
      ])("when vault timeout is %s, returns unchanged", async (vaultTimeout) => {
        userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
        policyService.policiesByType$.mockReturnValue(of([]));

        await stateProvider.setUserState(VAULT_TIMEOUT, vaultTimeout, mockUserId);

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          vaultTimeout,
        );
        expect(result).toBe(vaultTimeout);
      });

      it("promotes timeout when unavailable on client", async () => {
        const determinedTimeout = VaultTimeoutNumberType.OnMinute;
        const promotedValue = VaultTimeoutStringType.OnRestart;

        sessionTimeoutTypeService.getOrPromoteToAvailable.mockResolvedValue(promotedValue);
        userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
        policyService.policiesByType$.mockReturnValue(of([]));

        await stateProvider.setUserState(VAULT_TIMEOUT, determinedTimeout, mockUserId);

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          determinedTimeout,
        );
        expect(result).toBe(promotedValue);
      });
    });

    describe("policy type: custom", () => {
      const policyMinutes = 30;

      it.each([
        VaultTimeoutNumberType.EightHours,
        VaultTimeoutStringType.Never,
        VaultTimeoutStringType.OnRestart,
        VaultTimeoutStringType.OnLocked,
        VaultTimeoutStringType.OnSleep,
        VaultTimeoutStringType.OnIdle,
      ])(
        "when vault timeout is %s and exceeds policy max, returns policy minutes",
        async (vaultTimeout) => {
          userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
          policyService.policiesByType$.mockReturnValue(
            of([{ data: { type: "custom", minutes: policyMinutes } }] as unknown as Policy[]),
          );

          await stateProvider.setUserState(VAULT_TIMEOUT, vaultTimeout, mockUserId);

          const result = await firstValueFrom(
            vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
          );

          expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
            policyMinutes,
          );
          expect(result).toBe(policyMinutes);
        },
      );

      it.each([VaultTimeoutNumberType.OnMinute, policyMinutes])(
        "when vault timeout is %s and within policy max, returns unchanged",
        async (vaultTimeout) => {
          userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
          policyService.policiesByType$.mockReturnValue(
            of([{ data: { type: "custom", minutes: policyMinutes } }] as unknown as Policy[]),
          );

          await stateProvider.setUserState(VAULT_TIMEOUT, vaultTimeout, mockUserId);

          const result = await firstValueFrom(
            vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
          );

          expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
            vaultTimeout,
          );
          expect(result).toBe(vaultTimeout);
        },
      );

      it("when vault timeout is Immediately, returns Immediately", async () => {
        userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
        policyService.policiesByType$.mockReturnValue(
          of([{ data: { type: "custom", minutes: policyMinutes } }] as unknown as Policy[]),
        );

        await stateProvider.setUserState(
          VAULT_TIMEOUT,
          VaultTimeoutNumberType.Immediately,
          mockUserId,
        );

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          VaultTimeoutNumberType.Immediately,
        );
        expect(result).toBe(VaultTimeoutNumberType.Immediately);
      });

      it("promotes policy minutes when unavailable on client", async () => {
        const promotedValue = VaultTimeoutStringType.Never;

        sessionTimeoutTypeService.getOrPromoteToAvailable.mockResolvedValue(promotedValue);
        userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));
        policyService.policiesByType$.mockReturnValue(
          of([{ data: { type: "custom", minutes: policyMinutes } }] as unknown as Policy[]),
        );

        await stateProvider.setUserState(
          VAULT_TIMEOUT,
          VaultTimeoutNumberType.EightHours,
          mockUserId,
        );

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          policyMinutes,
        );
        expect(result).toBe(promotedValue);
      });
    });

    describe("policy type: immediately", () => {
      it.each([
        VaultTimeoutStringType.Never,
        VaultTimeoutStringType.OnRestart,
        VaultTimeoutStringType.OnLocked,
        VaultTimeoutStringType.OnIdle,
        VaultTimeoutStringType.OnSleep,
        VaultTimeoutNumberType.Immediately,
        VaultTimeoutNumberType.OnMinute,
        VaultTimeoutNumberType.EightHours,
      ])(
        "when current timeout is %s, returns immediately or promoted value",
        async (currentTimeout) => {
          const expectedTimeout = VaultTimeoutNumberType.Immediately;
          policyService.policiesByType$.mockReturnValue(
            of([{ data: { type: "immediately" } }] as unknown as Policy[]),
          );

          await stateProvider.setUserState(VAULT_TIMEOUT, currentTimeout, mockUserId);

          const result = await firstValueFrom(
            vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
          );

          expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
            VaultTimeoutNumberType.Immediately,
          );
          expect(result).toBe(expectedTimeout);
        },
      );

      it("promotes immediately when unavailable on client", async () => {
        const promotedValue = VaultTimeoutNumberType.OnMinute;

        sessionTimeoutTypeService.getOrPromoteToAvailable.mockResolvedValue(promotedValue);
        policyService.policiesByType$.mockReturnValue(
          of([{ data: { type: "immediately" } }] as unknown as Policy[]),
        );

        await stateProvider.setUserState(VAULT_TIMEOUT, VaultTimeoutStringType.Never, mockUserId);

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          VaultTimeoutNumberType.Immediately,
        );
        expect(result).toBe(promotedValue);
      });
    });

    describe("policy type: onSystemLock", () => {
      it.each([
        VaultTimeoutStringType.Never,
        VaultTimeoutStringType.OnRestart,
        VaultTimeoutStringType.OnLocked,
        VaultTimeoutStringType.OnIdle,
        VaultTimeoutStringType.OnSleep,
      ])(
        "when current timeout is %s, returns onLocked or promoted value",
        async (currentTimeout) => {
          const expectedTimeout = VaultTimeoutStringType.OnLocked;
          policyService.policiesByType$.mockReturnValue(
            of([{ data: { type: "onSystemLock" } }] as unknown as Policy[]),
          );

          await stateProvider.setUserState(VAULT_TIMEOUT, currentTimeout, mockUserId);

          const result = await firstValueFrom(
            vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
          );

          expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
            VaultTimeoutStringType.OnLocked,
          );
          expect(result).toBe(expectedTimeout);
        },
      );

      it.each([
        VaultTimeoutNumberType.Immediately,
        VaultTimeoutNumberType.OnMinute,
        VaultTimeoutNumberType.EightHours,
      ])("when current timeout is numeric %s, returns unchanged", async (currentTimeout) => {
        policyService.policiesByType$.mockReturnValue(
          of([{ data: { type: "onSystemLock" } }] as unknown as Policy[]),
        );

        await stateProvider.setUserState(VAULT_TIMEOUT, currentTimeout, mockUserId);

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          currentTimeout,
        );
        expect(result).toBe(currentTimeout);
      });

      it("promotes onLocked when unavailable on client", async () => {
        const promotedValue = VaultTimeoutStringType.OnRestart;

        sessionTimeoutTypeService.getOrPromoteToAvailable.mockResolvedValue(promotedValue);
        policyService.policiesByType$.mockReturnValue(
          of([{ data: { type: "onSystemLock" } }] as unknown as Policy[]),
        );

        await stateProvider.setUserState(VAULT_TIMEOUT, VaultTimeoutStringType.Never, mockUserId);

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          VaultTimeoutStringType.OnLocked,
        );
        expect(result).toBe(promotedValue);
      });
    });

    describe("policy type: onAppRestart", () => {
      it.each([
        VaultTimeoutStringType.Never,
        VaultTimeoutStringType.OnLocked,
        VaultTimeoutStringType.OnIdle,
        VaultTimeoutStringType.OnSleep,
      ])("when current timeout is %s, returns onRestart", async (currentTimeout) => {
        policyService.policiesByType$.mockReturnValue(
          of([{ data: { type: "onAppRestart" } }] as unknown as Policy[]),
        );

        await stateProvider.setUserState(VAULT_TIMEOUT, currentTimeout, mockUserId);

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          VaultTimeoutStringType.OnRestart,
        );
        expect(result).toBe(VaultTimeoutStringType.OnRestart);
      });

      it.each([
        VaultTimeoutStringType.OnRestart,
        VaultTimeoutNumberType.Immediately,
        VaultTimeoutNumberType.OnMinute,
        VaultTimeoutNumberType.EightHours,
      ])("when current timeout is %s, returns unchanged", async (currentTimeout) => {
        policyService.policiesByType$.mockReturnValue(
          of([{ data: { type: "onAppRestart" } }] as unknown as Policy[]),
        );

        await stateProvider.setUserState(VAULT_TIMEOUT, currentTimeout, mockUserId);

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          currentTimeout,
        );
        expect(result).toBe(currentTimeout);
      });

      it("promotes onRestart when unavailable on client", async () => {
        const promotedValue = VaultTimeoutStringType.Never;

        sessionTimeoutTypeService.getOrPromoteToAvailable.mockResolvedValue(promotedValue);
        policyService.policiesByType$.mockReturnValue(
          of([{ data: { type: "onAppRestart" } }] as unknown as Policy[]),
        );

        await stateProvider.setUserState(
          VAULT_TIMEOUT,
          VaultTimeoutStringType.OnLocked,
          mockUserId,
        );

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          VaultTimeoutStringType.OnRestart,
        );
        expect(result).toBe(promotedValue);
      });
    });

    describe("policy type: never", () => {
      it.each([
        VaultTimeoutStringType.Never,
        VaultTimeoutStringType.OnRestart,
        VaultTimeoutStringType.OnLocked,
        VaultTimeoutStringType.OnIdle,
        VaultTimeoutStringType.OnSleep,
        VaultTimeoutNumberType.Immediately,
        VaultTimeoutNumberType.OnMinute,
        VaultTimeoutNumberType.EightHours,
      ])("when current timeout is %s, returns unchanged", async (currentTimeout) => {
        policyService.policiesByType$.mockReturnValue(
          of([{ data: { type: "never" } }] as unknown as Policy[]),
        );

        await stateProvider.setUserState(VAULT_TIMEOUT, currentTimeout, mockUserId);

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          currentTimeout,
        );
        expect(result).toBe(currentTimeout);
      });

      it("promotes timeout when unavailable on client", async () => {
        const determinedTimeout = VaultTimeoutStringType.Never;
        const promotedValue = VaultTimeoutStringType.OnRestart;

        sessionTimeoutTypeService.getOrPromoteToAvailable.mockResolvedValue(promotedValue);
        policyService.policiesByType$.mockReturnValue(
          of([{ data: { type: "never" } }] as unknown as Policy[]),
        );

        await stateProvider.setUserState(VAULT_TIMEOUT, determinedTimeout, mockUserId);

        const result = await firstValueFrom(
          vaultTimeoutSettingsService.getVaultTimeoutByUserId$(mockUserId),
        );

        expect(sessionTimeoutTypeService.getOrPromoteToAvailable).toHaveBeenCalledWith(
          determinedTimeout,
        );
        expect(result).toBe(promotedValue);
      });
    });
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
      sessionTimeoutTypeService,
    );
  }
});
