import { firstValueFrom } from "rxjs";

import {
  FakeAccountService,
  mockAccountServiceWith,
  FakeStateProvider,
  FakeSingleUserState,
} from "../../../../spec";
import { ApiService } from "../../../abstractions/api.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { UserId } from "../../../types/guid";
import { BillingAccountProfile } from "../../abstractions/account/billing-account-profile-state.service";
import { BillingHistoryResponse } from "../../models/response/billing-history.response";

import {
  BILLING_ACCOUNT_PROFILE_KEY_DEFINITION,
  DefaultBillingAccountProfileStateService,
} from "./billing-account-profile-state.service";

describe("BillingAccountProfileStateService", () => {
  let stateProvider: FakeStateProvider;
  let sut: DefaultBillingAccountProfileStateService;
  let userBillingAccountProfileState: FakeSingleUserState<BillingAccountProfile>;
  let accountService: FakeAccountService;
  let platformUtilsService: jest.Mocked<PlatformUtilsService>;
  let apiService: jest.Mocked<ApiService>;

  const userId = "fakeUserId" as UserId;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    platformUtilsService = {
      isSelfHost: jest.fn(),
    } as any;
    apiService = {
      getUserBillingHistory: jest.fn(),
    } as any;

    sut = new DefaultBillingAccountProfileStateService(
      stateProvider,
      platformUtilsService,
      apiService,
    );

    userBillingAccountProfileState = stateProvider.singleUser.getFake(
      userId,
      BILLING_ACCOUNT_PROFILE_KEY_DEFINITION,
    );
  });

  afterEach(() => {
    return jest.resetAllMocks();
  });

  describe("hasPremiumFromAnyOrganization$", () => {
    it("returns true when they have premium from an organization", async () => {
      userBillingAccountProfileState.nextState({
        hasPremiumPersonally: false,
        hasPremiumFromAnyOrganization: true,
      });

      expect(await firstValueFrom(sut.hasPremiumFromAnyOrganization$(userId))).toBe(true);
    });

    it("return false when they do not have premium from an organization", async () => {
      userBillingAccountProfileState.nextState({
        hasPremiumPersonally: false,
        hasPremiumFromAnyOrganization: false,
      });

      expect(await firstValueFrom(sut.hasPremiumFromAnyOrganization$(userId))).toBe(false);
    });
  });

  describe("hasPremiumPersonally$", () => {
    it("returns true when the user has premium personally", async () => {
      userBillingAccountProfileState.nextState({
        hasPremiumPersonally: true,
        hasPremiumFromAnyOrganization: false,
      });

      expect(await firstValueFrom(sut.hasPremiumPersonally$(userId))).toBe(true);
    });

    it("returns false when the user does not have premium personally", async () => {
      userBillingAccountProfileState.nextState({
        hasPremiumPersonally: false,
        hasPremiumFromAnyOrganization: false,
      });

      expect(await firstValueFrom(sut.hasPremiumPersonally$(userId))).toBe(false);
    });
  });

  describe("hasPremiumFromAnySource$", () => {
    it("returns true when the user has premium personally", async () => {
      userBillingAccountProfileState.nextState({
        hasPremiumPersonally: true,
        hasPremiumFromAnyOrganization: false,
      });

      expect(await firstValueFrom(sut.hasPremiumFromAnySource$(userId))).toBe(true);
    });

    it("returns true when the user has premium from an organization", async () => {
      userBillingAccountProfileState.nextState({
        hasPremiumPersonally: false,
        hasPremiumFromAnyOrganization: true,
      });

      expect(await firstValueFrom(sut.hasPremiumFromAnySource$(userId))).toBe(true);
    });

    it("returns true when they have premium personally AND from an organization", async () => {
      userBillingAccountProfileState.nextState({
        hasPremiumPersonally: true,
        hasPremiumFromAnyOrganization: true,
      });

      expect(await firstValueFrom(sut.hasPremiumFromAnySource$(userId))).toBe(true);
    });
  });

  describe("setHasPremium", () => {
    it("should update the user's state when called", async () => {
      await sut.setHasPremium(true, false, userId);

      expect(await firstValueFrom(sut.hasPremiumFromAnyOrganization$(userId))).toBe(false);
      expect(await firstValueFrom(sut.hasPremiumPersonally$(userId))).toBe(true);
      expect(await firstValueFrom(sut.hasPremiumFromAnySource$(userId))).toBe(true);
    });
  });

  describe("canViewSubscription$", () => {
    beforeEach(() => {
      platformUtilsService.isSelfHost.mockReturnValue(false);
      apiService.getUserBillingHistory.mockResolvedValue(
        new BillingHistoryResponse({ invoices: [], transactions: [] }),
      );
    });

    it("returns true when user has premium personally", async () => {
      userBillingAccountProfileState.nextState({
        hasPremiumPersonally: true,
        hasPremiumFromAnyOrganization: true,
      });

      expect(await firstValueFrom(sut.canViewSubscription$(userId))).toBe(true);
    });

    it("returns true when user has no premium from any source", async () => {
      userBillingAccountProfileState.nextState({
        hasPremiumPersonally: false,
        hasPremiumFromAnyOrganization: false,
      });

      expect(await firstValueFrom(sut.canViewSubscription$(userId))).toBe(true);
    });

    it("returns true when user has billing history in cloud environment", async () => {
      userBillingAccountProfileState.nextState({
        hasPremiumPersonally: false,
        hasPremiumFromAnyOrganization: true,
      });
      platformUtilsService.isSelfHost.mockReturnValue(false);
      apiService.getUserBillingHistory.mockResolvedValue(
        new BillingHistoryResponse({
          invoices: [{ id: "1" }],
          transactions: [{ id: "2" }],
        }),
      );

      expect(await firstValueFrom(sut.canViewSubscription$(userId))).toBe(true);
    });

    it("returns false when user has no premium personally, has org premium, and no billing history", async () => {
      userBillingAccountProfileState.nextState({
        hasPremiumPersonally: false,
        hasPremiumFromAnyOrganization: true,
      });
      platformUtilsService.isSelfHost.mockReturnValue(false);
      apiService.getUserBillingHistory.mockResolvedValue(
        new BillingHistoryResponse({
          invoices: [],
          transactions: [],
        }),
      );

      expect(await firstValueFrom(sut.canViewSubscription$(userId))).toBe(false);
    });

    it("returns false when user has no premium personally, has org premium, in self-hosted environment", async () => {
      userBillingAccountProfileState.nextState({
        hasPremiumPersonally: false,
        hasPremiumFromAnyOrganization: true,
      });
      platformUtilsService.isSelfHost.mockReturnValue(true);

      expect(await firstValueFrom(sut.canViewSubscription$(userId))).toBe(false);
      expect(apiService.getUserBillingHistory).not.toHaveBeenCalled();
    });
  });
});
