import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { GlobalStateProvider, KeyDefinition } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { LogService } from "@bitwarden/logging";

import { DesktopAutotypeDefaultSettingPolicy } from "./desktop-autotype-policy.service";
import { DesktopAutotypeService } from "./desktop-autotype.service";

type FakeGlobalState<T> = {
  state$: Observable<T | null>;
  update: jest.Mock;
};

describe("DesktopAutotypeService", () => {
  let service: DesktopAutotypeService;

  let mockAccountService: MockProxy<AccountService>;
  let mockAuthService: MockProxy<AuthService>;
  let mockCipherService: MockProxy<CipherService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockGlobalStateProvider: jest.Mocked<GlobalStateProvider>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;
  let mockBillingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let mockDesktopAutotypePolicy: jest.Mocked<DesktopAutotypeDefaultSettingPolicy>;
  let mockLogService: MockProxy<LogService>;

  let mockAutotypeEnabledState: FakeGlobalState<boolean>;
  let mockAutotypeKeyboardShortcutState: FakeGlobalState<string[]>;

  let autotypeEnabledSubject: BehaviorSubject<boolean | null>;
  let autotypeKeyboardShortcutSubject: BehaviorSubject<string[]>;
  let activeAccountSubject: BehaviorSubject<Account | null>;
  let activeAccountStatusSubject: BehaviorSubject<AuthenticationStatus>;
  let hasPremiumSubject: BehaviorSubject<boolean>;
  let autotypeDefaultPolicySubject: BehaviorSubject<boolean | null>;

  // The Autotype feature flags must be mocked independently of one another: the service
  // resolves its gate through `autotypeFeatureFlagState$`, which reads both the MVP and the
  // GA flag and defaults to `Off` when both are on. A single shared mock value would make
  // the `Ga` state unreachable.
  function mockAutotypeFlags(mvpEnabled: boolean, gaEnabled: boolean) {
    mockConfigService.getFeatureFlag$.mockImplementation((flag) => {
      if (flag === FeatureFlag.WindowsDesktopAutotypeGA) {
        return of(gaEnabled);
      }
      if (flag === FeatureFlag.WindowsDesktopAutotype) {
        return of(mvpEnabled);
      }
      throw new Error(`Unexpected feature flag requested in test: ${flag}`);
    });
  }

  beforeEach(() => {
    autotypeEnabledSubject = new BehaviorSubject<boolean | null>(null);
    autotypeKeyboardShortcutSubject = new BehaviorSubject<string[]>(["Control", "Alt", "B"]);
    activeAccountSubject = new BehaviorSubject<Account | null>({
      id: "user-123" as UserId,
      email: "user@bitwarden.com",
      emailVerified: true,
      name: "Test User",
      creationDate: undefined,
    });
    activeAccountStatusSubject = new BehaviorSubject<AuthenticationStatus>(
      AuthenticationStatus.Unlocked,
    );
    hasPremiumSubject = new BehaviorSubject<boolean>(true);
    autotypeDefaultPolicySubject = new BehaviorSubject<boolean | null>(null);

    mockAutotypeEnabledState = {
      state$: autotypeEnabledSubject.asObservable(),
      update: jest.fn().mockImplementation(async (configureState, options) => {
        const newState = configureState(autotypeEnabledSubject.value, null);
        if (options?.shouldUpdate && !options.shouldUpdate(autotypeEnabledSubject.value)) {
          return autotypeEnabledSubject.value;
        }
        autotypeEnabledSubject.next(newState);
        return newState;
      }),
    };

    mockAutotypeKeyboardShortcutState = {
      state$: autotypeKeyboardShortcutSubject.asObservable(),
      update: jest.fn().mockImplementation(async (configureState) => {
        const newState = configureState(autotypeKeyboardShortcutSubject.value, null);
        autotypeKeyboardShortcutSubject.next(newState);
        return newState;
      }),
    };

    mockGlobalStateProvider = {
      get: jest.fn().mockImplementation((keyDefinition: KeyDefinition<unknown>) => {
        if (keyDefinition.key === "autotypeGaEnabled") {
          return mockAutotypeEnabledState;
        }
        if (keyDefinition.key === "autotypeGaKeyboardShortcut") {
          return mockAutotypeKeyboardShortcutState;
        }
        return undefined;
      }),
    } as unknown as jest.Mocked<GlobalStateProvider>;

    mockAccountService = mock<AccountService>();
    mockAccountService.activeAccount$ = activeAccountSubject.asObservable();

    mockAuthService = mock<AuthService>();
    mockAuthService.activeAccountStatus$ = activeAccountStatusSubject.asObservable();

    mockCipherService = mock<CipherService>();

    mockConfigService = mock<ConfigService>();
    mockAutotypeFlags(false, false);

    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockPlatformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);

    mockBillingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    mockBillingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(
      hasPremiumSubject.asObservable(),
    );

    mockDesktopAutotypePolicy = {
      autotypeDefaultSetting$: autotypeDefaultPolicySubject.asObservable(),
    } as unknown as jest.Mocked<DesktopAutotypeDefaultSettingPolicy>;

    mockLogService = mock<LogService>();

    TestBed.configureTestingModule({
      providers: [
        DesktopAutotypeService,
        { provide: AccountService, useValue: mockAccountService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: CipherService, useValue: mockCipherService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: GlobalStateProvider, useValue: mockGlobalStateProvider },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        {
          provide: BillingAccountProfileStateService,
          useValue: mockBillingAccountProfileStateService,
        },
        { provide: DesktopAutotypeDefaultSettingPolicy, useValue: mockDesktopAutotypePolicy },
        { provide: LogService, useValue: mockLogService },
      ],
    });

    service = TestBed.inject(DesktopAutotypeService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create the service", () => {
      expect(service).toBeTruthy();
    });

    it("should initialize observables", () => {
      expect(service.autotypeEnabledUserSetting$).toBeDefined();
      expect(service.autotypeKeyboardShortcut$).toBeDefined();
    });
  });

  describe("init", () => {
    it("should not apply the organization default policy on non-Windows platforms", async () => {
      mockPlatformUtilsService.getDevice.mockReturnValue(DeviceType.MacOsDesktop);
      autotypeEnabledSubject.next(null);
      autotypeDefaultPolicySubject.next(true);

      await service.init();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockAutotypeEnabledState.update).not.toHaveBeenCalled();
      expect(autotypeEnabledSubject.value).toBeNull();
    });

    it("should enable autotype when policy is true and user setting is null", async () => {
      autotypeEnabledSubject.next(null);
      autotypeDefaultPolicySubject.next(true);

      await service.init();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockAutotypeEnabledState.update).toHaveBeenCalled();
      expect(autotypeEnabledSubject.value).toBe(true);
    });
  });

  describe("setAutotypeEnabledState", () => {
    it("should update autotype enabled state", async () => {
      await service.setAutotypeEnabledState(true);

      expect(mockAutotypeEnabledState.update).toHaveBeenCalled();
      expect(autotypeEnabledSubject.value).toBe(true);
    });

    it("should not update if value has not changed", async () => {
      autotypeEnabledSubject.next(true);

      await service.setAutotypeEnabledState(true);

      expect(mockAutotypeEnabledState.update).toHaveBeenCalled();
      expect(autotypeEnabledSubject.value).toBe(true);
    });
  });

  describe("setAutotypeKeyboardShortcutState", () => {
    it("should update keyboard shortcut state", async () => {
      const newKeyboardShortcut = ["Control", "Alt", "A"];

      await service.setAutotypeKeyboardShortcutState(newKeyboardShortcut);

      expect(mockAutotypeKeyboardShortcutState.update).toHaveBeenCalled();
      expect(autotypeKeyboardShortcutSubject.value).toEqual(newKeyboardShortcut);
    });
  });

  describe("ngOnDestroy", () => {
    it("should complete destroy subject", () => {
      const destroySpy = jest.spyOn(service["destroy$"], "complete");

      service.ngOnDestroy();

      expect(destroySpy).toHaveBeenCalled();
    });
  });
});
