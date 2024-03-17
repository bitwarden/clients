import { firstValueFrom } from "rxjs";

import {
  FakeAccountService,
  FakeActiveUserStateProvider,
  mockAccountServiceWith,
  FakeActiveUserState,
  trackEmissions,
} from "../../../../spec";
import { UserId } from "../../../types/guid";
import { BillingAccountProfile } from "../../abstractions/account/billing-account-profile-state.service";

import {
  BILLING_ACCOUNT_PROFILE_KEY_DEFINITION,
  DefaultBillingAccountProfileStateService,
} from "./billing-account-profile-state.service";

describe("BillingAccountProfileStateService", () => {
  let activeUserStateProvider: FakeActiveUserStateProvider;
  let sut: DefaultBillingAccountProfileStateService;
  let billingAccountProfileState: FakeActiveUserState<BillingAccountProfile>;
  let accountService: FakeAccountService;

  const userId = "fakeUserId" as UserId;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    activeUserStateProvider = new FakeActiveUserStateProvider(accountService);

    sut = new DefaultBillingAccountProfileStateService(activeUserStateProvider);

    billingAccountProfileState = activeUserStateProvider.getFake(
      BILLING_ACCOUNT_PROFILE_KEY_DEFINITION,
    );
  });

  afterEach(() => {
    return jest.resetAllMocks();
  });

  describe("accountHasPremiumFromAnyOrganization$", () => {
    it("should emit changes in hasPremiumFromAnyOrganization", async () => {
      billingAccountProfileState.nextState({
        hasPremiumPersonally: false,
        hasPremiumFromAnyOrganization: true,
      });

      expect(await firstValueFrom(sut.hasPremiumFromAnyOrganization$)).toBe(true);
    });

    it("should emit once when calling setHasPremium once", async () => {
      const emissions = trackEmissions(sut.hasPremiumFromAnyOrganization$);
      const startingEmissionCount = emissions.length;

      await sut.setHasPremium(true, true);

      const endingEmissionCount = emissions.length;
      expect(endingEmissionCount - startingEmissionCount).toBe(1);
    });
  });

  describe("hasPremiumPersonally$", () => {
    it("should emit changes in hasPremiumPersonally", async () => {
      billingAccountProfileState.nextState({
        hasPremiumPersonally: true,
        hasPremiumFromAnyOrganization: false,
      });

      expect(await firstValueFrom(sut.hasPremiumPersonally$)).toBe(true);
    });

    it("should emit once when calling setHasPremium once", async () => {
      const emissions = trackEmissions(sut.hasPremiumPersonally$);
      const startingEmissionCount = emissions.length;

      await sut.setHasPremium(true, true);

      const endingEmissionCount = emissions.length;
      expect(endingEmissionCount - startingEmissionCount).toBe(1);
    });
  });

  describe("canAccessPremium$", () => {
    it("should emit changes in hasPremiumPersonally", async () => {
      billingAccountProfileState.nextState({
        hasPremiumPersonally: true,
        hasPremiumFromAnyOrganization: false,
      });

      expect(await firstValueFrom(sut.hasPremiumFromAnySource$)).toBe(true);
    });

    it("should emit changes in hasPremiumFromAnyOrganization", async () => {
      billingAccountProfileState.nextState({
        hasPremiumPersonally: false,
        hasPremiumFromAnyOrganization: true,
      });

      expect(await firstValueFrom(sut.hasPremiumFromAnySource$)).toBe(true);
    });

    it("should emit changes in both hasPremiumPersonally and hasPremiumFromAnyOrganization", async () => {
      billingAccountProfileState.nextState({
        hasPremiumPersonally: true,
        hasPremiumFromAnyOrganization: true,
      });

      expect(await firstValueFrom(sut.hasPremiumFromAnySource$)).toBe(true);
    });

    it("should emit once when calling setHasPremium once", async () => {
      const emissions = trackEmissions(sut.hasPremiumFromAnySource$);
      const startingEmissionCount = emissions.length;

      await sut.setHasPremium(true, true);

      const endingEmissionCount = emissions.length;
      expect(endingEmissionCount - startingEmissionCount).toBe(1);
    });
  });

  describe("setHasPremium", () => {
    it("should have `hasPremiumPersonally$` emit `true` when passing `true` as an argument for hasPremiumPersonally", async () => {
      await sut.setHasPremium(true, false);

      expect(await firstValueFrom(sut.hasPremiumPersonally$)).toBe(true);
    });

    it("should have `hasPremiumFromAnyOrganization$` emit `true` when passing `true` as an argument for hasPremiumFromAnyOrganization", async () => {
      await sut.setHasPremium(false, true);

      expect(await firstValueFrom(sut.hasPremiumFromAnyOrganization$)).toBe(true);
    });

    it("should have `hasPremiumPersonally$` emit `false` when passing `false` as an argument for hasPremiumPersonally", async () => {
      await sut.setHasPremium(false, false);

      expect(await firstValueFrom(sut.hasPremiumPersonally$)).toBe(false);
    });

    it("should have `hasPremiumFromAnyOrganization$` emit `false` when passing `false` as an argument for hasPremiumFromAnyOrganization", async () => {
      await sut.setHasPremium(false, false);

      expect(await firstValueFrom(sut.hasPremiumFromAnyOrganization$)).toBe(false);
    });

    it("should have `canAccessPremium$` emit `true` when passing `true` as an argument for hasPremiumPersonally", async () => {
      await sut.setHasPremium(true, false);

      expect(await firstValueFrom(sut.hasPremiumFromAnySource$)).toBe(true);
    });

    it("should have `canAccessPremium$` emit `true` when passing `true` as an argument for hasPremiumFromAnyOrganization", async () => {
      await sut.setHasPremium(false, true);

      expect(await firstValueFrom(sut.hasPremiumFromAnySource$)).toBe(true);
    });

    it("should have `canAccessPremium$` emit `false` when passing `false` for all arguments", async () => {
      await sut.setHasPremium(false, false);

      expect(await firstValueFrom(sut.hasPremiumFromAnySource$)).toBe(false);
    });
  });
});
