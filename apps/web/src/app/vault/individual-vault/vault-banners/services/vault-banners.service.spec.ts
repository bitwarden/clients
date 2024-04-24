import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { KdfType } from "@bitwarden/common/platform/enums";
import { StateProvider } from "@bitwarden/common/platform/state";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import {
  PREMIUM_BANNER_REPROMPT_KEY,
  VaultBannersService,
  VisibleVaultBanner,
} from "./vault-banners.service";

describe("VaultBannersService", () => {
  let service: VaultBannersService;
  const isSelfHost = jest.fn().mockReturnValue(false);
  const hasPremiumFromAnySource$ = new BehaviorSubject<boolean>(false);
  const fakeStateProvider = new FakeStateProvider(mockAccountServiceWith("user-id" as UserId));
  const getEmailVerified = jest.fn().mockResolvedValue(true);
  const hasMasterPassword = jest.fn().mockResolvedValue(true);
  const getKdfType = jest.fn().mockResolvedValue(KdfType.PBKDF2_SHA256);
  const getKdfConfig = jest.fn().mockResolvedValue({ iterations: 600000 });

  beforeEach(() => {
    isSelfHost.mockClear();
    isSelfHost.mockClear();
    getEmailVerified.mockClear().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        VaultBannersService,
        {
          provide: PlatformUtilsService,
          useValue: { isSelfHost },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$: hasPremiumFromAnySource$ },
        },
        {
          provide: StateProvider,
          useValue: fakeStateProvider,
        },
        {
          provide: PlatformUtilsService,
          useValue: { isSelfHost },
        },
        {
          provide: TokenService,
          useValue: { getEmailVerified },
        },
        {
          provide: UserVerificationService,
          useValue: { hasMasterPassword },
        },
        {
          provide: StateService,
          useValue: { getKdfType, getKdfConfig },
        },
      ],
    });
  });

  describe("Premium", () => {
    it("shows premium banner when not self hosted and no premium", async () => {
      hasPremiumFromAnySource$.next(false);
      isSelfHost.mockReturnValue(false);

      service = TestBed.inject(VaultBannersService);

      expect(await service.shouldShowPremiumBanner()).toBe(true);
    });

    describe("dismissing", () => {
      beforeEach(async () => {
        jest.useFakeTimers();
        const date = new Date("2023-06-08");
        date.setHours(0, 0, 0, 0);
        jest.setSystemTime(date.getTime());

        service = TestBed.inject(VaultBannersService);
        await service.dismissBanner(VisibleVaultBanner.Premium);
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it("updates state on first dismiss", async () => {
        const state = await firstValueFrom(
          fakeStateProvider.getActive(PREMIUM_BANNER_REPROMPT_KEY).state$,
        );

        const oneWeekLater = new Date("2023-06-15");
        oneWeekLater.setHours(0, 0, 0, 0);

        expect(state).toEqual({
          numberOfDismissals: 1,
          nextPromptDate: oneWeekLater.getTime(),
        });
      });

      it("updates state on second dismiss", async () => {
        const state = await firstValueFrom(
          fakeStateProvider.getActive(PREMIUM_BANNER_REPROMPT_KEY).state$,
        );

        const oneMonthLater = new Date("2023-07-08");
        oneMonthLater.setHours(0, 0, 0, 0);

        expect(state).toEqual({
          numberOfDismissals: 2,
          nextPromptDate: oneMonthLater.getTime(),
        });
      });

      it("updates state on third dismiss", async () => {
        const state = await firstValueFrom(
          fakeStateProvider.getActive(PREMIUM_BANNER_REPROMPT_KEY).state$,
        );

        const oneYearLater = new Date("2024-06-08");
        oneYearLater.setHours(0, 0, 0, 0);

        expect(state).toEqual({
          numberOfDismissals: 3,
          nextPromptDate: oneYearLater.getTime(),
        });
      });
    });
  });

  describe("KDFSettings", () => {
    beforeEach(async () => {
      hasMasterPassword.mockResolvedValue(true);
      getKdfType.mockResolvedValue(KdfType.PBKDF2_SHA256);
      getKdfConfig.mockResolvedValue({ iterations: 599999 });
    });

    it("shows low KDF iteration banner", async () => {
      service = TestBed.inject(VaultBannersService);

      expect(await service.shouldShowLowKDFBanner()).toBe(true);
    });

    it("does not show low KDF iteration banner if KDF type is not PBKDF2_SHA256", async () => {
      getKdfType.mockResolvedValue(KdfType.Argon2id);

      service = TestBed.inject(VaultBannersService);

      expect(await service.shouldShowLowKDFBanner()).toBe(false);
    });

    it("does not show low KDF for iterations about 600,000", async () => {
      getKdfConfig.mockResolvedValue({ iterations: 600001 });

      service = TestBed.inject(VaultBannersService);

      expect(await service.shouldShowLowKDFBanner()).toBe(false);
    });

    it("dismisses low KDF iteration banner", async () => {
      service = TestBed.inject(VaultBannersService);

      expect(await service.shouldShowLowKDFBanner()).toBe(true);

      await service.dismissBanner(VisibleVaultBanner.KDFSettings);

      expect(await service.shouldShowLowKDFBanner()).toBe(false);
    });
  });

  describe("OutdatedBrowser", () => {
    beforeEach(async () => {
      // Hardcode `MSIE` in userAgent string
      const userAgent = "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 MSIE";
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        get: () => userAgent,
      });
    });

    it("shows outdated browser banner", async () => {
      service = TestBed.inject(VaultBannersService);

      expect(await service.shouldShowUpdateBrowserBanner()).toBe(true);
    });

    it("dismisses outdated browser banner", async () => {
      service = TestBed.inject(VaultBannersService);

      expect(await service.shouldShowUpdateBrowserBanner()).toBe(true);

      await service.dismissBanner(VisibleVaultBanner.OutdatedBrowser);

      expect(await service.shouldShowUpdateBrowserBanner()).toBe(false);
    });
  });

  describe("VerifyEmail", () => {
    beforeEach(async () => {
      getEmailVerified.mockResolvedValue(false);
    });

    it("shows verify email banner", async () => {
      service = TestBed.inject(VaultBannersService);

      expect(await service.shouldShowVerifyEmailBanner()).toBe(true);
    });

    it("dismisses verify email banner", async () => {
      service = TestBed.inject(VaultBannersService);

      expect(await service.shouldShowVerifyEmailBanner()).toBe(true);

      await service.dismissBanner(VisibleVaultBanner.VerifyEmail);

      expect(await service.shouldShowVerifyEmailBanner()).toBe(false);
    });
  });
});
