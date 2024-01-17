import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { PolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { Policy } from "../../admin-console/models/domain/policy";
import { TokenService } from "../../auth/abstractions/token.service";
import { UserDecryptionOptionsServiceAbstraction } from "../../auth/abstractions/user-decryption-options.service.abstraction";
import { UserDecryptionOptions } from "../../auth/models/domain/user-decryption-options/user-decryption-options";
import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { StateService } from "../../platform/abstractions/state.service";
import { EncString } from "../../platform/models/domain/enc-string";

import { VaultTimeoutSettingsService } from "./vault-timeout-settings.service";

describe("VaultTimeoutSettingsService", () => {
  let userDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let cryptoService: MockProxy<CryptoService>;
  let tokenService: MockProxy<TokenService>;
  let policyService: MockProxy<PolicyService>;
  let stateService: MockProxy<StateService>;
  let service: VaultTimeoutSettingsService;

  let userDecryptionOptionsSubject: BehaviorSubject<UserDecryptionOptions>;

  beforeEach(() => {
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    cryptoService = mock<CryptoService>();
    tokenService = mock<TokenService>();
    policyService = mock<PolicyService>();
    stateService = mock<StateService>();

    userDecryptionOptionsSubject = new BehaviorSubject(null);
    userDecryptionOptionsService.userDecryptionOptions$ = userDecryptionOptionsSubject;
    userDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
      userDecryptionOptionsSubject,
    );

    service = new VaultTimeoutSettingsService(
      userDecryptionOptionsService,
      cryptoService,
      tokenService,
      policyService,
      stateService,
    );
  });

  describe("availableVaultTimeoutActions$", () => {
    it("always returns LogOut", async () => {
      const result = await firstValueFrom(service.availableVaultTimeoutActions$());

      expect(result).toContain(VaultTimeoutAction.LogOut);
    });

    it("contains Lock when the user has a master password", async () => {
      userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: true }));

      const result = await firstValueFrom(service.availableVaultTimeoutActions$());

      expect(result).toContain(VaultTimeoutAction.Lock);
    });

    it("contains Lock when the user has a persistent PIN configured", async () => {
      stateService.getPinKeyEncryptedUserKey.mockResolvedValue(createEncString());

      const result = await firstValueFrom(service.availableVaultTimeoutActions$());

      expect(result).toContain(VaultTimeoutAction.Lock);
    });

    it("contains Lock when the user has a transient/ephemeral PIN configured", async () => {
      stateService.getProtectedPin.mockResolvedValue("some-key");

      const result = await firstValueFrom(service.availableVaultTimeoutActions$());

      expect(result).toContain(VaultTimeoutAction.Lock);
    });

    it("contains Lock when the user has biometrics configured", async () => {
      stateService.getBiometricUnlock.mockResolvedValue(true);

      const result = await firstValueFrom(service.availableVaultTimeoutActions$());

      expect(result).toContain(VaultTimeoutAction.Lock);
    });

    it("not contains Lock when the user does not have a master password, PIN, or biometrics", async () => {
      userDecryptionOptionsSubject.next(new UserDecryptionOptions({ hasMasterPassword: false }));
      stateService.getPinKeyEncryptedUserKey.mockResolvedValue(null);
      stateService.getProtectedPin.mockResolvedValue(null);
      stateService.getBiometricUnlock.mockResolvedValue(false);

      const result = await firstValueFrom(service.availableVaultTimeoutActions$());

      expect(result).not.toContain(VaultTimeoutAction.Lock);
    });
  });

  describe("vaultTimeoutAction$", () => {
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
          policyService.policyAppliesToUser.mockResolvedValue(policy === null ? false : true);
          policyService.getAll.mockResolvedValue(
            policy === null ? [] : ([{ data: { action: policy } }] as unknown as Policy[]),
          );
          stateService.getVaultTimeoutAction.mockResolvedValue(userPreference);

          const result = await firstValueFrom(service.vaultTimeoutAction$());

          expect(result).toBe(expected);
        },
      );
    });

    describe("given the user does not have a master password", () => {
      it.each`
        unlockMethod | policy                     | userPreference               | expected
        ${false}     | ${null}                    | ${null}                      | ${VaultTimeoutAction.LogOut}
        ${false}     | ${null}                    | ${VaultTimeoutAction.Lock}   | ${VaultTimeoutAction.LogOut}
        ${false}     | ${VaultTimeoutAction.Lock} | ${null}                      | ${VaultTimeoutAction.LogOut}
        ${true}      | ${null}                    | ${null}                      | ${VaultTimeoutAction.LogOut}
        ${true}      | ${null}                    | ${VaultTimeoutAction.Lock}   | ${VaultTimeoutAction.Lock}
        ${true}      | ${VaultTimeoutAction.Lock} | ${null}                      | ${VaultTimeoutAction.Lock}
        ${true}      | ${VaultTimeoutAction.Lock} | ${VaultTimeoutAction.LogOut} | ${VaultTimeoutAction.Lock}
      `(
        "returns $expected when policy is $policy, has unlock method is $unlockMethod, and user preference is $userPreference",
        async ({ unlockMethod, policy, userPreference, expected }) => {
          stateService.getBiometricUnlock.mockResolvedValue(unlockMethod);
          userDecryptionOptionsSubject.next(
            new UserDecryptionOptions({ hasMasterPassword: false }),
          );
          policyService.policyAppliesToUser.mockResolvedValue(policy === null ? false : true);
          policyService.getAll.mockResolvedValue(
            policy === null ? [] : ([{ data: { action: policy } }] as unknown as Policy[]),
          );
          stateService.getVaultTimeoutAction.mockResolvedValue(userPreference);

          const result = await firstValueFrom(service.vaultTimeoutAction$());

          expect(result).toBe(expected);
        },
      );
    });
  });
});

function createEncString() {
  return Symbol() as unknown as EncString;
}
