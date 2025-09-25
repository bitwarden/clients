import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, take, timeout, TimeoutError } from "rxjs";

import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Account, UserId } from "@bitwarden/common/platform/models/domain/account";

import { DesktopAutotypeDefaultSettingPolicy } from "./desktop-autotype-policy.service";

describe("DesktopAutotypeDefaultSettingPolicy", () => {
  let service: DesktopAutotypeDefaultSettingPolicy;
  let accountService: MockProxy<AccountService>;
  let authService: MockProxy<AuthService>;
  let policyService: MockProxy<InternalPolicyService>;
  let configService: MockProxy<ConfigService>;

  let mockAccountSubject: BehaviorSubject<{ id: UserId } | null>;
  let mockFeatureFlagSubject: BehaviorSubject<boolean>;
  let mockAuthStatusSubject: BehaviorSubject<AuthenticationStatus>;
  let mockPolicyAppliesSubject: BehaviorSubject<boolean>;

  const mockUserId = "user-123" as UserId;

  beforeEach(() => {
    mockAccountSubject = new BehaviorSubject<Account | null>({
      id: mockUserId,
      email: "test@example.com",
      emailVerified: true,
      name: "Test User",
    });
    mockFeatureFlagSubject = new BehaviorSubject<boolean>(true);
    mockAuthStatusSubject = new BehaviorSubject<AuthenticationStatus>(
      AuthenticationStatus.Unlocked,
    );
    mockPolicyAppliesSubject = new BehaviorSubject<boolean>(false);

    accountService = mock<AccountService>();
    authService = mock<AuthService>();
    policyService = mock<InternalPolicyService>();
    configService = mock<ConfigService>();

    accountService.activeAccount$ = mockAccountSubject.asObservable();
    configService.getFeatureFlag$ = jest
      .fn()
      .mockReturnValue(mockFeatureFlagSubject.asObservable());
    authService.authStatusFor$ = jest
      .fn()
      .mockImplementation((_: UserId) => mockAuthStatusSubject.asObservable());
    policyService.policyAppliesToUser$ = jest
      .fn()
      .mockReturnValue(mockPolicyAppliesSubject.asObservable());

    TestBed.configureTestingModule({
      providers: [
        DesktopAutotypeDefaultSettingPolicy,
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: InternalPolicyService, useValue: policyService },
        { provide: ConfigService, useValue: configService },
      ],
    });

    service = TestBed.inject(DesktopAutotypeDefaultSettingPolicy);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockAccountSubject.complete();
    mockFeatureFlagSubject.complete();
    mockAuthStatusSubject.complete();
    mockPolicyAppliesSubject.complete();
  });

  describe("autotypeDefaultSetting$", () => {
    it("should emit null when feature flag is disabled", async () => {
      mockFeatureFlagSubject.next(false);
      const result = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(result).toBeNull();
    });

    it("should not emit when no active account", async () => {
      mockAccountSubject.next(null);
      await expect(
        firstValueFrom(service.autotypeDefaultSetting$.pipe(timeout({ first: 30 }))),
      ).rejects.toBeInstanceOf(TimeoutError);
    });

    it("should emit null when user is not unlocked", async () => {
      mockAuthStatusSubject.next(AuthenticationStatus.Locked);
      const result = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(result).toBeNull();
    });

    it("should emit null when no autotype policy exists", async () => {
      mockPolicyAppliesSubject.next(false);
      const policy = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(policy).toBeNull();
    });

    it("should emit true when autotype policy is enabled", async () => {
      mockPolicyAppliesSubject.next(true);
      const policyStatus = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(policyStatus).toBe(true);
    });

    it("should emit false when autotype policy is disabled", async () => {
      mockPolicyAppliesSubject.next(false);
      const policyStatus = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(policyStatus).toBeNull();
    });

    it("should emit null when autotype policy does not apply", async () => {
      mockPolicyAppliesSubject.next(false);
      const policy = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(policy).toBeNull();
    });

    it("should react to authentication status changes", async () => {
      // Expect one emission when unlocked
      mockAuthStatusSubject.next(AuthenticationStatus.Unlocked);
      const first = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(first).toBeNull();

      // Expect null emission when locked
      mockAuthStatusSubject.next(AuthenticationStatus.Locked);
      const lockedResult = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(lockedResult).toBeNull();
    });

    it("should react to account changes", async () => {
      const newUserId = "user-456" as UserId;

      // First value for original user
      const firstValue = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(firstValue).toBeNull();

      // Change account and expect a new emission
      mockAccountSubject.next({
        id: newUserId,
      });
      const secondValue = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(secondValue).toBeNull();

      // Verify the auth lookup was switched to the new user
      expect(authService.authStatusFor$).toHaveBeenCalledWith(newUserId);
    });

    it("should react to policy changes", async () => {
      mockPolicyAppliesSubject.next(false);
      const nullValue = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(nullValue).toBeNull();

      mockPolicyAppliesSubject.next(true);
      const trueValue = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(trueValue).toBe(true);

      mockPolicyAppliesSubject.next(false);
      const nullValueAgain = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(nullValueAgain).toBeNull();
    });
  });
});
