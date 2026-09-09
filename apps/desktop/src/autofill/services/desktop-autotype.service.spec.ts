import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { DeviceType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { GlobalStateProvider, KeyDefinition } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { LogService } from "@bitwarden/logging";

import { DesktopAutotypeDefaultSettingPolicy } from "./desktop-autotype-policy.service";
import { DesktopAutotypeService } from "./desktop-autotype.service";

/*
  The GlobalState objects handed back by the GlobalStateProvider need custom
  `state$` and `update()` behavior wired to a BehaviorSubject, which `mock<T>()`
  does not model well, so they are hand-built.
*/
type FakeGlobalState<T> = {
  state$: Observable<T | null>;
  update: jest.Mock;
};

/*
  This suite intentionally only covers the code that is reachable today. The
  `concatMap` subscriptions in `init()` that will inform the main process of
  setting changes are still commented out (PM-38967), so there is nothing to
  assert about `ipc.autofill` from this service yet.
*/
describe("DesktopAutotypeService", () => {
  let service: DesktopAutotypeService;

  // Mock dependencies
  let mockAccountService: MockProxy<AccountService>;
  let mockAuthService: MockProxy<AuthService>;
  let mockCipherService: MockProxy<CipherService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockGlobalStateProvider: jest.Mocked<GlobalStateProvider>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;
  let mockBillingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let mockDesktopAutotypePolicy: jest.Mocked<DesktopAutotypeDefaultSettingPolicy>;
  let mockLogService: MockProxy<LogService>;

  // Mock GlobalState objects
  let mockAutotypeEnabledState: FakeGlobalState<boolean>;
  let mockAutotypeKeyboardShortcutState: FakeGlobalState<string[]>;

  // BehaviorSubjects for reactive state
  let autotypeEnabledSubject: BehaviorSubject<boolean | null>;
  let autotypeKeyboardShortcutSubject: BehaviorSubject<string[]>;
  let activeAccountSubject: BehaviorSubject<Account | null>;
  let activeAccountStatusSubject: BehaviorSubject<AuthenticationStatus>;
  let hasPremiumSubject: BehaviorSubject<boolean>;
  let featureFlagSubject: BehaviorSubject<boolean>;
  let autotypeDefaultPolicySubject: BehaviorSubject<boolean | null>;

  beforeEach(() => {
    // Initialize BehaviorSubjects
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
    featureFlagSubject = new BehaviorSubject<boolean>(true);
    autotypeDefaultPolicySubject = new BehaviorSubject<boolean | null>(null);

    // Mock GlobalState objects
    mockAutotypeEnabledState = {
      state$: autotypeEnabledSubject.asObservable(),
      update: jest.fn().mockImplementation(async (configureState, options) => {
        const newState = configureState(autotypeEnabledSubject.value, null);

        // Handle shouldUpdate option
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

    // Mock GlobalStateProvider, keyed on the Autotype GA storage keys
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

    /*
      Observable-valued members are assigned after the mock is created rather
      than passed into `mock<T>()`: jest-mock-extended proxies object-valued
      members of the partial it is handed, and that proxy stubs out the
      internals RxJS relies on, leaving an observable that never emits.
    */
    mockAccountService = mock<AccountService>();
    mockAccountService.activeAccount$ = activeAccountSubject.asObservable();

    mockAuthService = mock<AuthService>();
    mockAuthService.activeAccountStatus$ = activeAccountStatusSubject.asObservable();

    mockCipherService = mock<CipherService>();

    /*
      Wired up only so the feature-enabled subscription in `init()` does not
      error; nothing in this suite asserts on the flag value.
    */
    mockConfigService = mock<ConfigService>();
    mockConfigService.getFeatureFlag$.mockReturnValue(featureFlagSubject.asObservable());

    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockPlatformUtilsService.getDevice.mockReturnValue(DeviceType.WindowsDesktop);

    mockBillingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    mockBillingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(
      hasPremiumSubject.asObservable(),
    );

    /*
      autotypeDefaultSetting$ is readonly, so it can't be assigned post-construction like
      activeAccount$/activeAccountStatus$ above; passing it into mock<T>()'s partial hits the same
      proxied-observable hazard described above, so the whole mock is a plain object cast instead.
    */
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

      // Allow observables to emit
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockAutotypeEnabledState.update).not.toHaveBeenCalled();
      expect(autotypeEnabledSubject.value).toBeNull();
    });

    it("should enable autotype when policy is true and user setting is null", async () => {
      autotypeEnabledSubject.next(null);
      autotypeDefaultPolicySubject.next(true);

      await service.init();

      // Allow observables to emit
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

      // Update was called but shouldUpdate prevented the change
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
