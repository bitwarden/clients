import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, take } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AutotypeFeatureFlagState } from "@bitwarden/common/desktop-native/enums/autotype-feature-flag-state.enum";
import { autotypeFeatureFlagState$ } from "@bitwarden/common/desktop-native/services/autotype-feature-flags";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Account, UserId } from "@bitwarden/common/platform/models/domain/account";
import { mockAccountInfoWith } from "@bitwarden/common/spec";

import { DesktopAutotypeGaPolicyService } from "./desktop-autotype-ga-policy.service";

jest.mock("@bitwarden/common/desktop-native/services/autotype-feature-flags", () => ({
  autotypeFeatureFlagState$: jest.fn(),
}));

describe("DesktopAutotypeGaPolicyService", () => {
  let service: DesktopAutotypeGaPolicyService;
  let accountService: MockProxy<AccountService>;
  let authService: MockProxy<AuthService>;
  let policyService: MockProxy<PolicyService>;
  let configService: MockProxy<ConfigService>;

  let mockAccountSubject: BehaviorSubject<Account | null>;
  let featureFlagSubject: BehaviorSubject<AutotypeFeatureFlagState>;
  let mockAuthStatusSubject: BehaviorSubject<AuthenticationStatus>;
  let mockPolicyAppliesSubject: BehaviorSubject<boolean>;
  let mockPoliciesSubject: BehaviorSubject<Policy[]>;

  const mockUserId = "user-123" as UserId;

  beforeEach(() => {
    mockAccountSubject = new BehaviorSubject<Account | null>({
      id: mockUserId,
      ...mockAccountInfoWith({
        email: "test@example.com",
        name: "Test User",
      }),
    });
    featureFlagSubject = new BehaviorSubject<AutotypeFeatureFlagState>(AutotypeFeatureFlagState.Ga);
    mockAuthStatusSubject = new BehaviorSubject<AuthenticationStatus>(
      AuthenticationStatus.Unlocked,
    );
    mockPolicyAppliesSubject = new BehaviorSubject<boolean>(false);
    mockPoliciesSubject = new BehaviorSubject<Policy[]>([]);

    accountService = mock<AccountService>();
    authService = mock<AuthService>();
    policyService = mock<PolicyService>();
    configService = mock<ConfigService>();

    accountService.activeAccount$ = mockAccountSubject.asObservable();
    jest.mocked(autotypeFeatureFlagState$).mockReturnValue(featureFlagSubject.asObservable());
    authService.authStatusFor$ = jest
      .fn()
      .mockImplementation((_: UserId) => mockAuthStatusSubject.asObservable());
    policyService.policyAppliesToUser$ = jest
      .fn()
      .mockReturnValue(mockPolicyAppliesSubject.asObservable());
    policyService.policiesByType$ = jest.fn().mockReturnValue(mockPoliciesSubject.asObservable());

    TestBed.configureTestingModule({
      providers: [
        DesktopAutotypeGaPolicyService,
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: PolicyService, useValue: policyService },
        { provide: ConfigService, useValue: configService },
      ],
    });

    service = TestBed.inject(DesktopAutotypeGaPolicyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockAccountSubject.complete();
    featureFlagSubject.complete();
    mockAuthStatusSubject.complete();
    mockPolicyAppliesSubject.complete();
    mockPoliciesSubject.complete();
  });

  describe("autotypeGaDefaultSetting$", () => {
    const collectEmissions = () => {
      const emissions: (boolean | null)[] = [];
      const subscription = service.autotypeGaDefaultSetting$.subscribe((value) =>
        emissions.push(value),
      );
      return { emissions, subscription };
    };

    it("should emit null when feature flag is disabled", async () => {
      featureFlagSubject.next(AutotypeFeatureFlagState.Off);
      const result = await firstValueFrom(service.autotypeGaDefaultSetting$.pipe(take(1)));
      expect(result).toBeNull();
      expect(autotypeFeatureFlagState$).toHaveBeenCalledWith(configService);
    });

    it("should emit null when the resolved feature flag state is Off even if the policy applies", async () => {
      mockPolicyAppliesSubject.next(true);
      featureFlagSubject.next(AutotypeFeatureFlagState.Off);

      const result = await firstValueFrom(service.autotypeGaDefaultSetting$.pipe(take(1)));

      expect(result).toBeNull();
    });

    it("should emit null when the resolved feature flag state is Mvp even if the policy applies", async () => {
      mockPolicyAppliesSubject.next(true);
      featureFlagSubject.next(AutotypeFeatureFlagState.Mvp);

      const result = await firstValueFrom(service.autotypeGaDefaultSetting$.pipe(take(1)));

      expect(result).toBeNull();
      expect(policyService.policyAppliesToUser$).not.toHaveBeenCalled();
    });

    it("does not emit until an account appears", () => {
      mockAccountSubject.next(null);
      mockPolicyAppliesSubject.next(true);

      const { emissions, subscription } = collectEmissions();
      expect(emissions).toEqual([]);

      mockAccountSubject.next({ id: mockUserId } as Account);
      expect(emissions).toEqual([true]);

      subscription.unsubscribe();
    });

    it("should emit null when user is not unlocked", async () => {
      mockAuthStatusSubject.next(AuthenticationStatus.Locked);
      const result = await firstValueFrom(service.autotypeGaDefaultSetting$.pipe(take(1)));
      expect(result).toBeNull();
    });

    it("should emit null when the policy does not apply to the user", async () => {
      mockPolicyAppliesSubject.next(false);
      const result = await firstValueFrom(service.autotypeGaDefaultSetting$.pipe(take(1)));
      expect(result).toBeNull();
    });

    it("should emit true when the policy applies to the user", async () => {
      mockPolicyAppliesSubject.next(true);
      const result = await firstValueFrom(service.autotypeGaDefaultSetting$.pipe(take(1)));
      expect(result).toBe(true);
    });

    it("should react to authentication status changes", () => {
      mockPolicyAppliesSubject.next(true);
      const { emissions, subscription } = collectEmissions();

      mockAuthStatusSubject.next(AuthenticationStatus.Locked);
      mockAuthStatusSubject.next(AuthenticationStatus.Unlocked);

      expect(emissions).toEqual([true, null, true]);
      subscription.unsubscribe();
    });

    it("should react to account changes", () => {
      const newUserId = "user-456" as UserId;
      const newUserAuthStatusSubject = new BehaviorSubject<AuthenticationStatus>(
        AuthenticationStatus.Locked,
      );
      authService.authStatusFor$.mockImplementation((userId: UserId) =>
        userId === newUserId
          ? newUserAuthStatusSubject.asObservable()
          : mockAuthStatusSubject.asObservable(),
      );
      mockPolicyAppliesSubject.next(true);
      const { emissions, subscription } = collectEmissions();

      mockAccountSubject.next({ id: newUserId } as Account);

      expect(emissions).toEqual([true, null]);
      expect(authService.authStatusFor$).toHaveBeenCalledWith(newUserId);

      newUserAuthStatusSubject.next(AuthenticationStatus.Unlocked);

      expect(emissions).toEqual([true, null, true]);
      expect(policyService.policyAppliesToUser$).toHaveBeenCalledWith(
        PolicyType.AutotypeGaPolicy,
        newUserId,
      );

      subscription.unsubscribe();
      newUserAuthStatusSubject.complete();
    });

    it("should react to policy changes", () => {
      mockPolicyAppliesSubject.next(false);
      const { emissions, subscription } = collectEmissions();

      mockPolicyAppliesSubject.next(true);
      mockPolicyAppliesSubject.next(false);

      expect(emissions).toEqual([null, true, null]);
      subscription.unsubscribe();
    });

    it("emits null again if the feature flag turns off after emitting", () => {
      mockPolicyAppliesSubject.next(true);
      const { emissions, subscription } = collectEmissions();

      featureFlagSubject.next(AutotypeFeatureFlagState.Off);

      expect(emissions).toEqual([true, null]);
      subscription.unsubscribe();
    });

    it("replays the latest value to late subscribers without resubscribing upstream", () => {
      mockPolicyAppliesSubject.next(true);
      const first = collectEmissions();

      const late = collectEmissions();

      expect(late.emissions).toEqual([true]);
      expect(policyService.policyAppliesToUser$).toHaveBeenCalledTimes(1);

      first.subscription.unsubscribe();
      late.subscription.unsubscribe();
    });

    it("does not re-emit when the effective value is unchanged", () => {
      mockPolicyAppliesSubject.next(true);
      const { emissions, subscription } = collectEmissions();

      mockPolicyAppliesSubject.next(true);
      mockAuthStatusSubject.next(AuthenticationStatus.Unlocked);
      mockAccountSubject.next({ id: mockUserId } as Account);

      expect(emissions).toEqual([true]);
      subscription.unsubscribe();
    });

    it("wires dependencies with initial user id", async () => {
      mockPolicyAppliesSubject.next(true);
      await firstValueFrom(service.autotypeGaDefaultSetting$.pipe(take(1)));

      expect(authService.authStatusFor$).toHaveBeenCalledWith(mockUserId);
      expect(policyService.policyAppliesToUser$).toHaveBeenCalledWith(
        PolicyType.AutotypeGaPolicy,
        mockUserId,
      );
    });
  });

  describe("autotypeGaDefaultKeyboardShortcut$", () => {
    const policyWith = (data: unknown, enabled = true, organizationId = "org-1") =>
      ({ enabled, data, organizationId }) as Policy;

    const custom = (defaultKeyboardShortcut: unknown, organizationId = "org-1", enabled = true) =>
      policyWith({ shortcutOption: "custom", defaultKeyboardShortcut }, enabled, organizationId);

    const latest = () => firstValueFrom(service.autotypeGaDefaultKeyboardShortcut$.pipe(take(1)));

    const record = () => {
      const emissions: (string[] | null)[] = [];
      const subscription = service.autotypeGaDefaultKeyboardShortcut$.subscribe((value) =>
        emissions.push(value),
      );
      return { emissions, subscription };
    };

    it("emits the enabled custom shortcut for the active user", async () => {
      mockPoliciesSubject.next([custom(["Super", "K"])]);

      expect(await latest()).toEqual(["Super", "K"]);
      expect(policyService.policiesByType$).toHaveBeenCalledWith(
        PolicyType.AutotypeGaPolicy,
        mockUserId,
      );
    });

    it("skips policies that do not yield a registerable custom shortcut", () => {
      const { emissions, subscription } = record();

      for (const policies of [
        [],
        [custom(["Super", "K"], "org-1", false)],
        [policyWith(null)],
        [
          policyWith({
            shortcutOption: "default",
            defaultKeyboardShortcut: ["Control", "Alt", "B"],
          }),
        ],
        [custom(["Shift", "1"])],
        [custom(["Control", "Bogus"])],
        [custom(["Alt", "Alt", "K"])],
        [custom(["Control", 5])],
      ]) {
        mockPoliciesSubject.next(policies);
      }

      mockPoliciesSubject.next([custom(["Super", "K"])]);
      mockPoliciesSubject.next([custom(["Super", "K"])]);
      mockPoliciesSubject.next([custom(["Alt", "Q"])]);

      expect(emissions).toEqual([null, ["Super", "K"], ["Alt", "Q"]]);
      subscription.unsubscribe();
    });

    it("uses the custom shortcut from the organization with the lowest id", async () => {
      mockPoliciesSubject.next([
        custom(["Alt", "Q"], "org-b"),
        custom(["Control", "L"], "org-0", false),
        policyWith(
          { shortcutOption: "default", defaultKeyboardShortcut: ["Control", "Alt", "B"] },
          true,
          "org-1",
        ),
        custom(["Super", "K"], "org-a"),
      ]);

      expect(await latest()).toEqual(["Super", "K"]);
    });

    it("emits null unless the GA flag is on for an unlocked account", async () => {
      mockPoliciesSubject.next([custom(["Super", "K"])]);
      featureFlagSubject.next(AutotypeFeatureFlagState.Mvp);

      expect(await latest()).toBeNull();
      expect(policyService.policiesByType$).not.toHaveBeenCalled();

      featureFlagSubject.next(AutotypeFeatureFlagState.Ga);
      mockAuthStatusSubject.next(AuthenticationStatus.Locked);
      expect(await latest()).toBeNull();
    });

    it("emits null while locked and the shortcut again after unlock", () => {
      mockPoliciesSubject.next([custom(["Super", "K"])]);
      const { emissions, subscription } = record();

      mockAuthStatusSubject.next(AuthenticationStatus.Locked);
      mockAuthStatusSubject.next(AuthenticationStatus.Unlocked);

      expect(emissions).toEqual([["Super", "K"], null, ["Super", "K"]]);
      subscription.unsubscribe();
    });
  });
});
