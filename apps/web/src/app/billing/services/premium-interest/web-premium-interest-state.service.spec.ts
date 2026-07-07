import { firstValueFrom } from "rxjs";

import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { newGuid } from "@bitwarden/guid";
import { UserId } from "@bitwarden/user-core";

import {
  PREMIUM_INTEREST_KEY,
  WebPremiumInterestStateService,
} from "./web-premium-interest-state.service";

describe("WebPremiumInterestStateService", () => {
  let service: WebPremiumInterestStateService;
  let stateProvider: FakeStateProvider;
  let accountService: FakeAccountService;

  const mockUserId = newGuid() as UserId;
  const mockUserEmail = "user@example.com";

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId, { email: mockUserEmail });
    stateProvider = new FakeStateProvider(accountService);
    service = new WebPremiumInterestStateService(stateProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getPremiumInterest", () => {
    it("should throw an error when userId is not provided", async () => {
      const promise = service.getPremiumInterest(null);

      await expect(promise).rejects.toThrow("UserId is required. Cannot get 'premiumInterest'.");
    });

    it("should return null when no value is set", async () => {
      const result = await service.getPremiumInterest(mockUserId);

      expect(result).toBeNull();
    });

    it("should return true when value is set to true", async () => {
      await stateProvider.setUserState(PREMIUM_INTEREST_KEY, true, mockUserId);

      const result = await service.getPremiumInterest(mockUserId);

      expect(result).toBe(true);
    });

    it("should return false when value is set to false", async () => {
      await stateProvider.setUserState(PREMIUM_INTEREST_KEY, false, mockUserId);

      const result = await service.getPremiumInterest(mockUserId);

      expect(result).toBe(false);
    });

    it("should use getUserState$ to retrieve the value", async () => {
      const getUserStateSpy = jest.spyOn(stateProvider, "getUserState$");
      await stateProvider.setUserState(PREMIUM_INTEREST_KEY, true, mockUserId);

      await service.getPremiumInterest(mockUserId);

      expect(getUserStateSpy).toHaveBeenCalledWith(PREMIUM_INTEREST_KEY, mockUserId);
    });
  });

  describe("setPremiumInterest", () => {
    it("should throw an error when userId is not provided", async () => {
      const promise = service.setPremiumInterest(null, true);

      await expect(promise).rejects.toThrow("UserId is required. Cannot set 'premiumInterest'.");
    });

    it("should set the value to true", async () => {
      await service.setPremiumInterest(mockUserId, true);

      const result = await firstValueFrom(
        stateProvider.getUserState$(PREMIUM_INTEREST_KEY, mockUserId),
      );

      expect(result).toBe(true);
    });

    it("should set the value to false", async () => {
      await service.setPremiumInterest(mockUserId, false);

      const result = await firstValueFrom(
        stateProvider.getUserState$(PREMIUM_INTEREST_KEY, mockUserId),
      );

      expect(result).toBe(false);
    });

    it("should update an existing value", async () => {
      await service.setPremiumInterest(mockUserId, true);
      await service.setPremiumInterest(mockUserId, false);

      const result = await firstValueFrom(
        stateProvider.getUserState$(PREMIUM_INTEREST_KEY, mockUserId),
      );

      expect(result).toBe(false);
    });

    it("should use setUserState to store the value", async () => {
      const setUserStateSpy = jest.spyOn(stateProvider, "setUserState");

      await service.setPremiumInterest(mockUserId, true);

      expect(setUserStateSpy).toHaveBeenCalledWith(PREMIUM_INTEREST_KEY, true, mockUserId);
    });
  });

  describe("clearPremiumInterest", () => {
    it("should throw an error when userId is not provided", async () => {
      const promise = service.clearPremiumInterest(null);

      await expect(promise).rejects.toThrow("UserId is required. Cannot clear 'premiumInterest'.");
    });

    it("should clear the value by setting it to null", async () => {
      await service.setPremiumInterest(mockUserId, true);
      await service.clearPremiumInterest(mockUserId);

      const result = await firstValueFrom(
        stateProvider.getUserState$(PREMIUM_INTEREST_KEY, mockUserId),
      );

      expect(result).toBeNull();
    });

    it("should use setUserState with null to clear the value", async () => {
      const setUserStateSpy = jest.spyOn(stateProvider, "setUserState");
      await service.setPremiumInterest(mockUserId, true);

      await service.clearPremiumInterest(mockUserId);

      expect(setUserStateSpy).toHaveBeenCalledWith(PREMIUM_INTEREST_KEY, null, mockUserId);
    });
  });
});
