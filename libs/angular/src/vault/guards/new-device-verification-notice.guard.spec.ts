import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { NewDeviceVerificationNoticeService } from "../../../../vault/src/services/new-device-verification-notice.service";

import { NewDeviceVerificationNoticeGuard } from "./new-device-verification-notice.guard";

describe("NewDeviceVerificationNoticeGuard", () => {
  const _state = Object.freeze({}) as RouterStateSnapshot;
  const emptyRoute = Object.freeze({ queryParams: {} }) as ActivatedRouteSnapshot;
  const eightDaysAgo = new Date();
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

  const account = {
    id: "account-id",
    createdDate: eightDaysAgo.toISOString(),
  } as unknown as Account;

  const activeAccount$ = new BehaviorSubject<Account | null>(account);

  const createUrlTree = jest.fn();
  const getFeatureFlag = jest.fn().mockResolvedValue(null);
  const isSelfHost = jest.fn().mockResolvedValue(false);
  const getTwoFactorProviders = jest.fn().mockResolvedValue({ data: [] });
  const policyAppliesToActiveUser$ = jest.fn().mockReturnValue(new BehaviorSubject<boolean>(false));
  const noticeState$ = jest.fn().mockReturnValue(new BehaviorSubject(null));

  beforeEach(() => {
    getFeatureFlag.mockClear();
    isSelfHost.mockClear();
    getTwoFactorProviders.mockClear();
    policyAppliesToActiveUser$.mockClear();
    createUrlTree.mockClear();

    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    account.createdDate = eightDaysAgo.toISOString();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        { provide: ConfigService, useValue: { getFeatureFlag } },
        { provide: NewDeviceVerificationNoticeService, useValue: { noticeState$ } },
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: PlatformUtilsService, useValue: { isSelfHost } },
        { provide: ApiService, useValue: { getTwoFactorProviders } },
        { provide: PolicyService, useValue: { policyAppliesToActiveUser$ } },
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

  // Baseline, all defaults should allow the guard to pass
  it("returns true", async () => {
    expect(await newDeviceGuard()).toBe(true);
  });

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
      expect(getTwoFactorProviders).not.toHaveBeenCalled();
      expect(policyAppliesToActiveUser$).not.toHaveBeenCalled();
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
    getTwoFactorProviders.mockResolvedValueOnce({ data: [{ enabled: false }, { enabled: true }] });

    expect(await newDeviceGuard()).toBe(true);
  });

  it("returns `true` when the user is self hosted", async () => {
    isSelfHost.mockReturnValueOnce(true);

    expect(await newDeviceGuard()).toBe(true);
  });

  it("returns `true` SSO is required", async () => {
    policyAppliesToActiveUser$.mockReturnValueOnce(new BehaviorSubject(true));

    expect(await newDeviceGuard()).toBe(true);
    expect(policyAppliesToActiveUser$).toHaveBeenCalledWith(PolicyType.RequireSso);
  });

  it("returns `true` when the account was created less than a week ago", async () => {
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    account.createdDate = sixDaysAgo.toISOString();

    expect(await newDeviceGuard()).toBe(true);
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
