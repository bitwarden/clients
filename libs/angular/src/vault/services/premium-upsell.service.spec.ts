import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { mockAccountServiceWith } from "../../../../../libs/common/spec";

import { PremiumUpsellService } from "./premium-upsell.service";

describe("PremiumUpsellService", () => {
  let service: PremiumUpsellService;
  let billingAccountService: MockProxy<BillingAccountProfileStateService>;
  let configService: MockProxy<ConfigService>;
  let cipherService: MockProxy<CipherService>;

  let hasPremiumSubject: BehaviorSubject<boolean>;
  let featureFlagSubject: BehaviorSubject<number>;
  let ciphersSubject: BehaviorSubject<Record<string, unknown>>;

  const userId = "user-id" as UserId;
  // Jan 1 creation date; tests run with system time set to Feb 15 = 45 days old
  const creationDate = new Date("2024-01-01T00:00:00.000Z");
  const currentDate = new Date("2024-02-15T00:00:00.000Z");
  const accountAgeInDays = 45;

  const makeCiphers = (count: number): Record<string, unknown> => {
    const ciphers: Record<string, unknown> = {};
    for (let i = 0; i < count; i++) {
      ciphers[`cipher-${i}`] = {};
    }
    return ciphers;
  };

  const createService = (options: { creationDate?: Date | undefined } = {}) => {
    const accountService = mockAccountServiceWith(userId, {
      creationDate: "creationDate" in options ? options.creationDate : creationDate,
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: BillingAccountProfileStateService, useValue: billingAccountService },
        { provide: ConfigService, useValue: configService },
        { provide: CipherService, useValue: cipherService },
      ],
    });

    return TestBed.runInInjectionContext(() => new PremiumUpsellService());
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(currentDate);

    hasPremiumSubject = new BehaviorSubject<boolean>(false);
    featureFlagSubject = new BehaviorSubject<number>(30);
    ciphersSubject = new BehaviorSubject<Record<string, unknown>>(makeCiphers(5));

    billingAccountService = mock<BillingAccountProfileStateService>();
    configService = mock<ConfigService>();
    cipherService = mock<CipherService>();

    billingAccountService.hasPremiumFromAnySource$.mockReturnValue(hasPremiumSubject);
    configService.getFeatureFlag$.mockReturnValue(featureFlagSubject);
    cipherService.ciphers$.mockReturnValue(ciphersSubject);

    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("showUpsell", () => {
    it("returns true when account is old enough, has 5+ ciphers, and does not have premium", () => {
      expect(service.showUpsell()).toBe(true);
    });

    it("returns false when user has premium", () => {
      hasPremiumSubject.next(true);
      expect(service.showUpsell()).toBe(false);
    });

    it("returns false when cipher count is less than 5", () => {
      ciphersSubject.next(makeCiphers(4));
      expect(service.showUpsell()).toBe(false);
    });

    it("returns true when cipher count is exactly 5", () => {
      ciphersSubject.next(makeCiphers(5));
      expect(service.showUpsell()).toBe(true);
    });

    it("returns true when cipher count is greater than 5", () => {
      ciphersSubject.next(makeCiphers(10));
      expect(service.showUpsell()).toBe(true);
    });

    it("returns false when account age is less than the feature flag threshold", () => {
      featureFlagSubject.next(accountAgeInDays + 1);
      expect(service.showUpsell()).toBe(false);
    });

    it("returns true when account age equals the feature flag threshold", () => {
      featureFlagSubject.next(accountAgeInDays);
      expect(service.showUpsell()).toBe(true);
    });

    it("returns true when account age exceeds the feature flag threshold", () => {
      featureFlagSubject.next(accountAgeInDays - 1);
      expect(service.showUpsell()).toBe(true);
    });

    it("returns false when all conditions fail", () => {
      hasPremiumSubject.next(true);
      ciphersSubject.next(makeCiphers(4));
      featureFlagSubject.next(accountAgeInDays + 1);

      expect(service.showUpsell()).toBe(false);
    });

    describe("account has no creation date", () => {
      beforeEach(() => {
        service = createService({ creationDate: undefined });
      });

      it("treats account age as 0 and returns false when feature flag threshold is greater than 0", () => {
        // featureFlagSubject defaults to 30, so 0 >= 30 is false
        expect(service.showUpsell()).toBe(false);
      });

      it("returns true when feature flag threshold is 0", () => {
        featureFlagSubject.next(0);
        expect(service.showUpsell()).toBe(true);
      });
    });

    it("verifies ciphers$ is called with the active user id", () => {
      expect(cipherService.ciphers$).toHaveBeenCalledWith(userId);
    });

    it("verifies hasPremiumFromAnySource$ is called with the active user id", () => {
      expect(billingAccountService.hasPremiumFromAnySource$).toHaveBeenCalledWith(userId);
    });

    it("verifies getFeatureFlag$ is called with the PM32180PremiumUpsellAccountAge flag", () => {
      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.PM32180PremiumUpsellAccountAge,
      );
    });
  });
});
