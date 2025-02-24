import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { NewDeviceVerificationNoticeService } from "@bitwarden/vault";

import { VaultProfileService } from "../services/vault-profile.service";

import { NewDeviceVerificationNoticeGuard } from "./new-device-verification-notice.guard";

describe("NewDeviceVerificationNoticeGuard", () => {
  const _state = Object.freeze({}) as RouterStateSnapshot;
  const emptyRoute = Object.freeze({ queryParams: {} }) as ActivatedRouteSnapshot;
  const eightDaysAgo = new Date();
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

  const account = {
    id: "account-id",
  } as unknown as Account;

  const activeAccount$ = new BehaviorSubject<Account | null>(account);

  const createUrlTree = jest.fn();
  const getFeatureFlag = jest.fn().mockImplementation((key) => {
    if (key === FeatureFlag.NewDeviceVerificationTemporaryDismiss) {
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  });
  const isSelfHost = jest.fn().mockReturnValue(false);
  const getProfileTwoFactorEnabled = jest.fn().mockResolvedValue(false);
  const noticeState$ = jest.fn().mockReturnValue(new BehaviorSubject(null));
  const skipState$ = jest.fn().mockReturnValue(new BehaviorSubject(null));
  const getProfileCreationDate = jest.fn().mockResolvedValue(eightDaysAgo);
  const hasMasterPasswordAndMasterKeyHash = jest.fn().mockResolvedValue(true);
  const getUserSSOBound = jest.fn().mockResolvedValue(false);
  const getUserSSOBoundAdminOwner = jest.fn().mockResolvedValue(false);

  beforeEach(() => {
    getFeatureFlag.mockClear();
    isSelfHost.mockClear();
    getProfileCreationDate.mockClear();
    getProfileTwoFactorEnabled.mockClear();
    createUrlTree.mockClear();
    hasMasterPasswordAndMasterKeyHash.mockClear();
    getUserSSOBound.mockClear();
    getUserSSOBoundAdminOwner.mockClear();
    skipState$.mockClear();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        { provide: ConfigService, useValue: { getFeatureFlag } },
        { provide: NewDeviceVerificationNoticeService, useValue: { noticeState$, skipState$ } },
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: PlatformUtilsService, useValue: { isSelfHost } },
        { provide: UserVerificationService, useValue: { hasMasterPasswordAndMasterKeyHash } },
        {
          provide: VaultProfileService,
          useValue: {
            getProfileCreationDate,
            getProfileTwoFactorEnabled,
            getUserSSOBound,
            getUserSSOBoundAdminOwner,
          },
        },
      ],
    });
  });

  function newDeviceGuard(route?: ActivatedRouteSnapshot) {
    // Run the guard within injection context so `inject` works as you'd expect
    // Pass state object to make TypeScript happy
    return TestBed.runInInjectionContext(async () =>
      NewDeviceVerificationNoticeGuard(route ?? emptyRoute, _state),
    );
  }

  describe("fromNewDeviceVerification", () => {
    const route = {
      queryParams: { fromNewDeviceVerification: "true" },
    } as unknown as ActivatedRouteSnapshot;

    it("returns `true` when `fromNewDeviceVerification` is present", async () => {
      expect(await newDeviceGuard(route)).toBe(true);
    });

    it("does not execute other logic", async () => {
      // `fromNewDeviceVerification` param should exit early,
      // not foolproof but a quick way to test that other logic isn't executed
      await newDeviceGuard(route);

      expect(getFeatureFlag).not.toHaveBeenCalled();
      expect(isSelfHost).not.toHaveBeenCalled();
      expect(getProfileTwoFactorEnabled).not.toHaveBeenCalled();
      expect(getProfileCreationDate).not.toHaveBeenCalled();
      expect(hasMasterPasswordAndMasterKeyHash).not.toHaveBeenCalled();
    });
  });

  describe("missing current account", () => {
    afterAll(() => {
      // reset `activeAccount$` observable
      activeAccount$.next(account);
    });

    it("redirects to login when account is missing", async () => {
      activeAccount$.next(null);

      await newDeviceGuard();

      expect(createUrlTree).toHaveBeenCalledWith(["/login"]);
    });
  });

  it("returns `true` when 2FA is enabled", async () => {
    getProfileTwoFactorEnabled.mockResolvedValueOnce(true);

    expect(await newDeviceGuard()).toBe(true);
  });

  it("returns `true` when the user is self hosted", async () => {
    isSelfHost.mockReturnValueOnce(true);

    expect(await newDeviceGuard()).toBe(true);
  });

  it("returns `true` when the profile was created less than a week ago", async () => {
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

    getProfileCreationDate.mockResolvedValueOnce(sixDaysAgo);

    expect(await newDeviceGuard()).toBe(true);
  });

  it("returns `true` when the profile service throws an error", async () => {
    getProfileCreationDate.mockRejectedValueOnce(new Error("test"));

    expect(await newDeviceGuard()).toBe(true);
  });

  it("returns `true` when the skip state value is set to true", async () => {
    skipState$.mockReturnValueOnce(new BehaviorSubject(true));

    expect(await newDeviceGuard()).toBe(true);
    expect(skipState$.mock.calls[0][0]).toBe("account-id");
    expect(skipState$.mock.calls.length).toBe(1);
  });

  describe("SSO bound", () => {
    beforeEach(() => {
      getFeatureFlag.mockImplementation((key) => {
        if (key === FeatureFlag.NewDeviceVerificationPermanentDismiss) {
          return Promise.resolve(true);
        }

        return Promise.resolve(false);
      });
    });

    afterAll(() => {
      getFeatureFlag.mockReturnValue(false);
    });

    it('returns "true" when the user is SSO bound and not an admin or owner', async () => {
      getUserSSOBound.mockResolvedValueOnce(true);
      getUserSSOBoundAdminOwner.mockResolvedValueOnce(false);

      expect(await newDeviceGuard()).toBe(true);
    });

    it('returns "true" when the user is an admin or owner of an SSO bound organization and has not logged in with their master password', async () => {
      getUserSSOBound.mockResolvedValueOnce(true);
      getUserSSOBoundAdminOwner.mockResolvedValueOnce(true);
      hasMasterPasswordAndMasterKeyHash.mockResolvedValueOnce(false);

      expect(await newDeviceGuard()).toBe(true);
    });

    it("shows notice when the user is an admin or owner of an SSO bound organization and logged in with their master password", async () => {
      getUserSSOBound.mockResolvedValueOnce(true);
      getUserSSOBoundAdminOwner.mockResolvedValueOnce(true);
      hasMasterPasswordAndMasterKeyHash.mockResolvedValueOnce(true);

      await newDeviceGuard();

      expect(createUrlTree).toHaveBeenCalledWith(["/new-device-notice"]);
    });

    it("shows notice when the user that is not in an SSO bound organization", async () => {
      getUserSSOBound.mockResolvedValueOnce(false);
      getUserSSOBoundAdminOwner.mockResolvedValueOnce(false);
      hasMasterPasswordAndMasterKeyHash.mockResolvedValueOnce(true);

      await newDeviceGuard();

      expect(createUrlTree).toHaveBeenCalledWith(["/new-device-notice"]);
    });
  });

  describe("temp flag", () => {
    beforeEach(() => {
      getFeatureFlag.mockImplementation((key) => {
        if (key === FeatureFlag.NewDeviceVerificationTemporaryDismiss) {
          return Promise.resolve(true);
        }

        return Promise.resolve(false);
      });
    });

    afterAll(() => {
      getFeatureFlag.mockReturnValue(false);
    });

    it("redirects to notice when the user has not dismissed it", async () => {
      noticeState$.mockReturnValueOnce(new BehaviorSubject(null));

      await newDeviceGuard();

      expect(createUrlTree).toHaveBeenCalledWith(["/new-device-notice"]);
      expect(noticeState$).toHaveBeenCalledWith(account.id);
    });

    it("redirects to notice when the user dismissed it more than 7 days ago", async () => {
      const eighteenDaysAgo = new Date();
      eighteenDaysAgo.setDate(eighteenDaysAgo.getDate() - 18);

      noticeState$.mockReturnValueOnce(
        new BehaviorSubject({ last_dismissal: eighteenDaysAgo.toISOString() }),
      );

      await newDeviceGuard();

      expect(createUrlTree).toHaveBeenCalledWith(["/new-device-notice"]);
    });

    it("returns true when the user dismissed less than 7 days ago", async () => {
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

      noticeState$.mockReturnValueOnce(
        new BehaviorSubject({ last_dismissal: fourDaysAgo.toISOString() }),
      );

      expect(await newDeviceGuard()).toBe(true);
    });
  });

  describe("permanent flag", () => {
    beforeEach(() => {
      getFeatureFlag.mockImplementation((key) => {
        if (key === FeatureFlag.NewDeviceVerificationPermanentDismiss) {
          return Promise.resolve(true);
        }

        return Promise.resolve(false);
      });
    });

    afterAll(() => {
      getFeatureFlag.mockReturnValue(false);
    });

    it("redirects when the user has not dismissed", async () => {
      noticeState$.mockReturnValueOnce(new BehaviorSubject(null));

      await newDeviceGuard();

      expect(createUrlTree).toHaveBeenCalledWith(["/new-device-notice"]);

      noticeState$.mockReturnValueOnce(new BehaviorSubject({ permanent_dismissal: null }));

      await newDeviceGuard();

      expect(createUrlTree).toHaveBeenCalledTimes(2);
      expect(createUrlTree).toHaveBeenCalledWith(["/new-device-notice"]);
    });

    it("returns `true` when the user has dismissed", async () => {
      noticeState$.mockReturnValueOnce(new BehaviorSubject({ permanent_dismissal: true }));

      expect(await newDeviceGuard()).toBe(true);
    });
  });
});
