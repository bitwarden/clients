import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId, CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";

import { PremiumUpsellService } from "./premium-upsell.service";

describe("PremiumUpsellService", () => {
  let service: PremiumUpsellService;
  let billingAccountService: MockProxy<BillingAccountProfileStateService>;
  let configService: MockProxy<ConfigService>;
  let cipherService: MockProxy<CipherService>;

  let hasPremiumSubject: BehaviorSubject<boolean>;
  let accountAgeThresholdSubject: BehaviorSubject<number>;
  let ciphersSubject: BehaviorSubject<Record<CipherId, CipherData>>;

  const userId = "user-id" as UserId;
  // Jan 1 creation date; tests run with system time set to Feb 15 = 45 days old
  const creationDate = new Date("2024-01-01T00:00:00.000Z");
  const currentDate = new Date("2024-02-15T00:00:00.000Z");
  const accountAgeInDays = 45;

  const makeCiphers = (count: number): Record<CipherId, CipherData> => {
    const ciphers = {} as Record<CipherId, CipherData>;
    for (let i = 0; i < count; i++) {
      ciphers[`cipher-${i}` as CipherId] = {} as CipherData;
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
    accountAgeThresholdSubject = new BehaviorSubject<number>(30);
    ciphersSubject = new BehaviorSubject<Record<CipherId, CipherData>>(makeCiphers(5));

    billingAccountService = mock<BillingAccountProfileStateService>();
    configService = mock<ConfigService>();
    cipherService = mock<CipherService>();

    billingAccountService.hasPremiumFromAnySource$.mockReturnValue(hasPremiumSubject);
    configService.getFeatureFlag$.mockReturnValue(accountAgeThresholdSubject);
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
      accountAgeThresholdSubject.next(accountAgeInDays + 1);
      expect(service.showUpsell()).toBe(false);
    });

    it("returns true when account age equals the feature flag threshold", () => {
      accountAgeThresholdSubject.next(accountAgeInDays);
      expect(service.showUpsell()).toBe(true);
    });

    it("returns true when account age exceeds the feature flag threshold", () => {
      accountAgeThresholdSubject.next(accountAgeInDays - 1);
      expect(service.showUpsell()).toBe(true);
    });

    it("returns false when all conditions fail", () => {
      hasPremiumSubject.next(true);
      ciphersSubject.next(makeCiphers(4));
      accountAgeThresholdSubject.next(accountAgeInDays + 1);

      expect(service.showUpsell()).toBe(false);
    });

    describe("account has no creation date", () => {
      beforeEach(() => {
        service = createService({ creationDate: undefined });
      });

      it("treats account age as 0 and returns false when feature flag threshold is greater than 0", () => {
        expect(service.showUpsell()).toBe(false);
      });

      it("returns true when feature flag threshold is 0", () => {
        accountAgeThresholdSubject.next(0);
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
