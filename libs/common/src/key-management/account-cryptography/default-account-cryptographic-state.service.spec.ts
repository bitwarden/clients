import { firstValueFrom } from "rxjs";

import { WrappedAccountCryptographicState } from "@bitwarden/sdk-internal";
import { FakeStateProvider } from "@bitwarden/state-test-utils";
import { UserId } from "@bitwarden/user-core";

import { FakeAccountService, mockAccountServiceWith } from "../../../spec";

import {
  ACCOUNT_CRYPTOGRAPHIC_STATE,
  DefaultAccountCryptographicStateService,
} from "./default-account-cryptographic-state.service";

describe("DefaultAccountCryptographicStateService", () => {
  let service: DefaultAccountCryptographicStateService;
  let stateProvider: FakeStateProvider;
  let accountService: FakeAccountService;

  const mockUserId = "user-id" as UserId;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);
    service = new DefaultAccountCryptographicStateService(stateProvider);
  });

  describe("accountCryptographicState$", () => {
    it("returns null when no state is set", async () => {
      const result = await firstValueFrom(service.accountCryptographicState$(mockUserId));
      expect(result).toBeNull();
    });

    it("returns the account cryptographic state when set (V1)", async () => {
      const mockState: WrappedAccountCryptographicState = {
        V1: {
          private_key: "test-wrapped-state" as any,
        },
      };
      await stateProvider.setUserState(ACCOUNT_CRYPTOGRAPHIC_STATE, mockState, mockUserId);
      const result = await firstValueFrom(service.accountCryptographicState$(mockUserId));
      expect(result).toEqual(mockState);
    });

    it("returns the account cryptographic state when set (V2)", async () => {
      const mockState: WrappedAccountCryptographicState = {
        V2: {
          private_key: "test-wrapped-private-key" as any,
          signing_key: "test-wrapped-signing-key" as any,
          signed_public_key: "test-signed-public-key" as any,
          security_state: "test-security-state",
        },
      };
      await stateProvider.setUserState(ACCOUNT_CRYPTOGRAPHIC_STATE, mockState, mockUserId);
      const result = await firstValueFrom(service.accountCryptographicState$(mockUserId));
      expect(result).toEqual(mockState);
    });

    it("emits updated state when state changes", async () => {
      const mockState1: any = {
        V1: {
          private_key: "test-state-1" as any,
        },
      };
      const mockState2: any = {
        V1: {
          private_key: "test-state-2" as any,
        },
      };

      await stateProvider.setUserState(ACCOUNT_CRYPTOGRAPHIC_STATE, mockState1, mockUserId);

      const observable = service.accountCryptographicState$(mockUserId);
      const results: (WrappedAccountCryptographicState | null)[] = [];
      const subscription = observable.subscribe((state) => results.push(state));

      await stateProvider.setUserState(ACCOUNT_CRYPTOGRAPHIC_STATE, mockState2, mockUserId);

      subscription.unsubscribe();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(mockState1);
      expect(results[1]).toEqual(mockState2);
    });
  });

  describe("setAccountCryptographicState", () => {
    it("sets the account cryptographic state", async () => {
      const mockState: WrappedAccountCryptographicState = {
        V1: {
          private_key: "test-wrapped-state" as any,
        },
      };

      await service.setAccountCryptographicState(mockState, mockUserId);

      const result = await firstValueFrom(service.accountCryptographicState$(mockUserId));

      expect(result).toEqual(mockState);
    });

    it("overwrites existing state", async () => {
      const mockState1: WrappedAccountCryptographicState = {
        V1: {
          private_key: "test-state-1" as any,
        },
      };
      const mockState2: WrappedAccountCryptographicState = {
        V1: {
          private_key: "test-state-2" as any,
        },
      };

      await service.setAccountCryptographicState(mockState1, mockUserId);
      await service.setAccountCryptographicState(mockState2, mockUserId);

      const result = await firstValueFrom(service.accountCryptographicState$(mockUserId));

      expect(result).toEqual(mockState2);
    });
  });

  describe("ACCOUNT_CRYPTOGRAPHIC_STATE key definition", () => {
    it("deserializer returns object as-is", () => {
      const mockState: any = {
        V1: {
          private_key: "test" as any,
        },
      };
      const result = ACCOUNT_CRYPTOGRAPHIC_STATE.deserializer(mockState);
      expect(result).toBe(mockState);
    });
  });
});
