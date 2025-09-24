import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, take, timeout, TimeoutError } from "rxjs";

import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyData } from "@bitwarden/common/admin-console/models/data/policy.data";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId, PolicyId, UserId } from "@bitwarden/common/types/guid";

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
  let mockPoliciesSubject: BehaviorSubject<Policy[]>;

  const mockUserId = "user-123" as UserId;

  function createPolicy(overrides: Partial<PolicyData> = {}): Policy {
    return new Policy({
      id: "policy-1" as PolicyId,
      organizationId: "org-1" as OrganizationId,
      type: PolicyType.AutotypeDefaultSetting,
      enabled: true,
      data: {},
      ...overrides,
    });
  }

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
    mockPoliciesSubject = new BehaviorSubject<Policy[]>([]);

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
    policyService.policies$ = jest.fn().mockReturnValue(mockPoliciesSubject.asObservable());

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
    mockPoliciesSubject.complete();
  });

  describe("autotypeDefaultSetting$", () => {
    it("should not emit when feature flag is disabled", async () => {
      mockFeatureFlagSubject.next(false);
      await expect(
        firstValueFrom(service.autotypeDefaultSetting$.pipe(timeout({ first: 30 }))),
      ).rejects.toBeInstanceOf(TimeoutError);
    });

    it("should not emit when no active account", async () => {
      mockAccountSubject.next(null);
      await expect(
        firstValueFrom(service.autotypeDefaultSetting$.pipe(timeout({ first: 30 }))),
      ).rejects.toBeInstanceOf(TimeoutError);
    });

    it("should not emit when user is not unlocked", async () => {
      mockAuthStatusSubject.next(AuthenticationStatus.Locked);
      await expect(
        firstValueFrom(service.autotypeDefaultSetting$.pipe(timeout({ first: 30 }))),
      ).rejects.toBeInstanceOf(TimeoutError);
    });

    it("should emit null when no autotype policy exists", async () => {
      mockPoliciesSubject.next([]);
      const policy = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(policy).toBeNull();
    });

    it("should emit true when autotype policy is enabled", async () => {
      mockPoliciesSubject.next([
        createPolicy({ type: PolicyType.AutotypeDefaultSetting, enabled: true }),
      ]);
      const policyStatus = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(policyStatus).toBe(true);
    });

    it("should emit false when autotype policy is disabled", async () => {
      mockPoliciesSubject.next([
        createPolicy({ type: PolicyType.AutotypeDefaultSetting, enabled: false }),
      ]);
      const policyStatus = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(policyStatus).toBe(false);
    });

    it("should emit null when autotype policy exists but is not the correct type", async () => {
      mockPoliciesSubject.next([createPolicy({ type: PolicyType.RequireSso, enabled: true })]);
      const policy = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(policy).toBeNull();
    });

    it("should react to authentication status changes", async () => {
      // Expect one emission when unlocked
      mockAuthStatusSubject.next(AuthenticationStatus.Unlocked);
      const first = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(first).toBeNull();

      // Expect no emission when locked
      mockAuthStatusSubject.next(AuthenticationStatus.Locked);
      await expect(
        firstValueFrom(service.autotypeDefaultSetting$.pipe(timeout({ first: 30 }))),
      ).rejects.toBeInstanceOf(TimeoutError);
    });

    it("should react to account changes", async () => {
      const newUserId = "user-456" as UserId;

      // First value for original user
      const firstValue = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(firstValue).toBeNull();

      // Change account and expect a new emission
      mockAccountSubject.next({
        id: newUserId,
        email: "newuser@example.com",
        emailVerified: true,
        name: "New User",
      });
      const secondValue = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(secondValue).toBeNull();

      // Verify the auth lookup was switched to the new user
      expect(authService.authStatusFor$).toHaveBeenCalledWith(newUserId);
    });

    it("should react to policy changes", async () => {
      mockPoliciesSubject.next([]);
      const nullValue = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(nullValue).toBeNull();

      mockPoliciesSubject.next([
        createPolicy({ type: PolicyType.AutotypeDefaultSetting, enabled: true }),
      ]);
      const trueValue = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(trueValue).toBe(true);

      mockPoliciesSubject.next([
        createPolicy({ type: PolicyType.AutotypeDefaultSetting, enabled: false }),
      ]);
      const falseValue = await firstValueFrom(service.autotypeDefaultSetting$.pipe(take(1)));
      expect(falseValue).toBe(false);
    });
  });
});
