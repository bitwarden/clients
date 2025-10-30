import { firstValueFrom } from "rxjs";

import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { newGuid } from "@bitwarden/guid";
import { UserId } from "@bitwarden/user-core";

import {
  PREMIUM_SETUP_INTENT_KEY,
  WebPremiumSetupIntentService,
} from "./web-premium-setup-intent-state.service";

describe("WebPremiumSetupIntentService", () => {
  let service: WebPremiumSetupIntentService;
  let stateProvider: FakeStateProvider;
  let accountService: FakeAccountService;

  const mockUserId = newGuid() as UserId;
  const mockUserEmail = "user@example.com";

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId, { email: mockUserEmail });
    stateProvider = new FakeStateProvider(accountService);
    service = new WebPremiumSetupIntentService(stateProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getPremiumSetupIntent", () => {
    it("should throw an error when userId is not provided", async () => {
      const promise = service.getPremiumSetupIntent(null);

      await expect(promise).rejects.toThrow("UserId is required. Cannot get 'premiumSetupIntent'.");
    });

    it("should return null when no value is set", async () => {
      const result = await service.getPremiumSetupIntent(mockUserId);

      expect(result).toBeNull();
    });

    it("should return true when value is set to true", async () => {
      await stateProvider.setUserState(PREMIUM_SETUP_INTENT_KEY, true, mockUserId);

      const result = await service.getPremiumSetupIntent(mockUserId);

      expect(result).toBe(true);
    });

    it("should return false when value is set to false", async () => {
      await stateProvider.setUserState(PREMIUM_SETUP_INTENT_KEY, false, mockUserId);

      const result = await service.getPremiumSetupIntent(mockUserId);

      expect(result).toBe(false);
    });

    it("should use getUserState$ to retrieve the value", async () => {
      const getUserStateSpy = jest.spyOn(stateProvider, "getUserState$");
      await stateProvider.setUserState(PREMIUM_SETUP_INTENT_KEY, true, mockUserId);

      await service.getPremiumSetupIntent(mockUserId);

      expect(getUserStateSpy).toHaveBeenCalledWith(PREMIUM_SETUP_INTENT_KEY, mockUserId);
    });
  });

  describe("setPremiumSetupIntent", () => {
    it("should throw an error when userId is not provided", async () => {
      const promise = service.setPremiumSetupIntent(null, true);

      await expect(promise).rejects.toThrow("UserId is required. Cannot set 'premiumSetupIntent'.");
    });

    it("should set the value to true", async () => {
      await service.setPremiumSetupIntent(mockUserId, true);

      const result = await firstValueFrom(
        stateProvider.getUserState$(PREMIUM_SETUP_INTENT_KEY, mockUserId),
      );

      expect(result).toBe(true);
    });

    it("should set the value to false", async () => {
      await service.setPremiumSetupIntent(mockUserId, false);

      const result = await firstValueFrom(
        stateProvider.getUserState$(PREMIUM_SETUP_INTENT_KEY, mockUserId),
      );

      expect(result).toBe(false);
    });

    it("should update an existing value", async () => {
      await service.setPremiumSetupIntent(mockUserId, true);
      await service.setPremiumSetupIntent(mockUserId, false);

      const result = await firstValueFrom(
        stateProvider.getUserState$(PREMIUM_SETUP_INTENT_KEY, mockUserId),
      );

      expect(result).toBe(false);
    });

    it("should use setUserState to store the value", async () => {
      const setUserStateSpy = jest.spyOn(stateProvider, "setUserState");

      await service.setPremiumSetupIntent(mockUserId, true);

      expect(setUserStateSpy).toHaveBeenCalledWith(PREMIUM_SETUP_INTENT_KEY, true, mockUserId);
    });
  });

  describe("clearPremiumSetupIntent", () => {
    it("should throw an error when userId is not provided", async () => {
      const promise = service.clearPremiumSetupIntent(null);

      await expect(promise).rejects.toThrow(
        "UserId is required. Cannot clear 'premiumSetupIntent'.",
      );
    });

    it("should clear the value by setting it to null", async () => {
      await service.setPremiumSetupIntent(mockUserId, true);
      await service.clearPremiumSetupIntent(mockUserId);

      const result = await firstValueFrom(
        stateProvider.getUserState$(PREMIUM_SETUP_INTENT_KEY, mockUserId),
      );

      expect(result).toBeNull();
    });

    it("should use setUserState with null to clear the value", async () => {
      const setUserStateSpy = jest.spyOn(stateProvider, "setUserState");
      await service.setPremiumSetupIntent(mockUserId, true);

      await service.clearPremiumSetupIntent(mockUserId);

      expect(setUserStateSpy).toHaveBeenCalledWith(PREMIUM_SETUP_INTENT_KEY, null, mockUserId);
    });
  });
});
