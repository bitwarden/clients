import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, take } from "rxjs";

import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Account, UserId } from "@bitwarden/common/platform/models/domain/account";
import { mockAccountInfoWith } from "@bitwarden/common/spec";

import { DesktopAutotypeDefaultSettingPolicy } from "./desktop-autotype-policy.service";

describe("DesktopAutotypeDefaultSettingPolicy", () => {
  let service: DesktopAutotypeDefaultSettingPolicy;
  let accountService: MockProxy<AccountService>;
  let authService: MockProxy<AuthService>;
  let policyService: MockProxy<InternalPolicyService>;
  let configService: MockProxy<ConfigService>;

  let mockAccountSubject: BehaviorSubject<Account | null>;
  let mockFeatureFlagSubject: BehaviorSubject<boolean>;
  let mockAuthStatusSubject: BehaviorSubject<AuthenticationStatus>;
  let mockPolicyAppliesSubject: BehaviorSubject<boolean>;

  const mockUserId = "user-123" as UserId;

  beforeEach(() => {
    mockAccountSubject = new BehaviorSubject<Account | null>({
      id: mockUserId,
      ...mockAccountInfoWith({
        email: "test@example.com",
        name: "Test User",
      }),
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

    it("does not emit until an account appears", async () => {
      mockAccountSubject.next(null);

      mockAccountSubject.next({ id: mockUserId } as Account);
      mockAuthStatusSubject.next(AuthenticationStatus.Unlocked);
      mockPolicyAppliesSubject.next(true);

      const result = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(result).toBe(true);
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

    it("should emit null when autotype policy is disabled", async () => {
      mockPolicyAppliesSubject.next(false);
      const policyStatus = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(policyStatus).toBeNull();
    });

    it("should react to authentication status changes", async () => {
      mockPolicyAppliesSubject.next(true);

      // Expect one emission when unlocked
      mockAuthStatusSubject.next(AuthenticationStatus.Unlocked);
      const first = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(first).toBe(true);

      // Expect null emission when locked
      mockAuthStatusSubject.next(AuthenticationStatus.Locked);
      const lockedResult = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(lockedResult).toBeNull();
    });

    it("should react to account changes", async () => {
      const newUserId = "user-456" as UserId;

      mockPolicyAppliesSubject.next(true);

      // First value for original user
      const firstValue = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(firstValue).toBe(true);

      // Change account and expect a new emission
      mockAccountSubject.next({
        id: newUserId,
      } as Account);
      const secondValue = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(secondValue).toBe(true);

      // Verify the auth lookup was switched to the new user
      expect(authService.authStatusFor$).toHaveBeenCalledWith(newUserId);
      expect(policyService.policyAppliesToUser$).toHaveBeenCalledWith(
        PolicyType.AutotypeDefaultSetting,
        newUserId,
      );
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

    it("emits null again if the feature flag turns off after emitting", async () => {
      mockPolicyAppliesSubject.next(true);
      expect(await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)))).toBe(true);

      mockFeatureFlagSubject.next(false);
      expect(await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)))).toBeNull();
    });

    it("replays the latest value to late subscribers", async () => {
      mockPolicyAppliesSubject.next(true);

      await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));

      const late = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(late).toBe(true);
    });

    it("does not re-emit when effective value is unchanged", async () => {
      mockAccountSubject.next({ id: mockUserId } as Account);
      mockAuthStatusSubject.next(AuthenticationStatus.Unlocked);

      mockPolicyAppliesSubject.next(true);
      const first = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(first).toBe(true);

      let emissionCount = 0;
      const subscription = service.autotypeDefaultSetting$.subscribe(() => {
        emissionCount++;
      });

      mockPolicyAppliesSubject.next(true);

      await new Promise((resolve) => setTimeout(resolve, 50));
      subscription.unsubscribe();

      expect(emissionCount).toBe(1);
    });

    it("does not emit policy values while locked; emits after unlocking", async () => {
      mockAuthStatusSubject.next(AuthenticationStatus.Locked);
      mockPolicyAppliesSubject.next(true);

      expect(await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)))).toBeNull();

      mockAuthStatusSubject.next(AuthenticationStatus.Unlocked);
      expect(await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)))).toBe(true);
    });

    it("emits correctly if auth unlocks before policies arrive", async () => {
      mockAccountSubject.next({ id: mockUserId } as Account);
      mockAuthStatusSubject.next(AuthenticationStatus.Unlocked);
      mockPolicyAppliesSubject.next(true);

      const result = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(result).toBe(true);
    });

    it("wires dependencies with initial user id", async () => {
      mockPolicyAppliesSubject.next(true);
      await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));

      expect(authService.authStatusFor$).toHaveBeenCalledWith(mockUserId);
      expect(policyService.policyAppliesToUser$).toHaveBeenCalledWith(
        PolicyType.AutotypeDefaultSetting,
        mockUserId,
      );
    });
  });
});
