import { firstValueFrom } from "rxjs";

import { BillingAccountProfile } from "@bitwarden/common/billing/abstractions";

import {
  FakeAccountService,
  mockAccountServiceWith,
  FakeStateProvider,
  FakeSingleUserState,
} from "../../../../spec";
import { UserId } from "../../../types/guid";

import {
  BILLING_ACCOUNT_PROFILE_KEY_DEFINITION,
  DefaultBillingAccountProfileStateService,
} from "./billing-account-profile-state.service";

describe("BillingAccountProfileStateService", () => {
  let stateProvider: FakeStateProvider;
  let sut: DefaultBillingAccountProfileStateService;
  let userBillingAccountProfileState: FakeSingleUserState<BillingAccountProfile>;
  let accountService: FakeAccountService;

  const userId = "fakeUserId" as UserId;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);

    sut = new DefaultBillingAccountProfileStateService(stateProvider);

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
});
