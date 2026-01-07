import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { DeviceType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LogService } from "@bitwarden/logging";

import { DesktopAutotypeDefaultSettingPolicy } from "./desktop-autotype-policy.service";
import { DesktopAutotypeService, getAutotypeVaultData } from "./desktop-autotype.service";

describe("DesktopAutotypeService", () => {
  let service: DesktopAutotypeService;

  // Mock dependencies
  let mockAccountService: jest.Mocked<AccountService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockCipherService: jest.Mocked<CipherService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockGlobalStateProvider: jest.Mocked<GlobalStateProvider>;
  let mockPlatformUtilsService: jest.Mocked<PlatformUtilsService>;
  let mockBillingAccountProfileStateService: jest.Mocked<BillingAccountProfileStateService>;
  let mockDesktopAutotypePolicy: jest.Mocked<DesktopAutotypeDefaultSettingPolicy>;
  let mockLogService: jest.Mocked<LogService>;

  // Mock GlobalState objects
  let mockAutotypeEnabledState: any;
  let mockAutotypeKeyboardShortcutState: any;

  // BehaviorSubjects for reactive state
  let autotypeEnabledSubject: BehaviorSubject<boolean | null>;
  let autotypeKeyboardShortcutSubject: BehaviorSubject<string[]>;
  let activeAccountSubject: BehaviorSubject<any>;
  let activeAccountStatusSubject: BehaviorSubject<AuthenticationStatus>;
  let hasPremiumSubject: BehaviorSubject<boolean>;
  let featureFlagSubject: BehaviorSubject<boolean>;
  let autotypeDefaultPolicySubject: BehaviorSubject<boolean>;
  let cipherViewsSubject: BehaviorSubject<any[]>;

  beforeEach(() => {
    // Initialize BehaviorSubjects
    autotypeEnabledSubject = new BehaviorSubject<boolean | null>(null);
    autotypeKeyboardShortcutSubject = new BehaviorSubject<string[]>(["Control", "Shift", "B"]);
    activeAccountSubject = new BehaviorSubject<any>({ id: "user-123" });
    activeAccountStatusSubject = new BehaviorSubject<AuthenticationStatus>(
      AuthenticationStatus.Unlocked,
    );
    hasPremiumSubject = new BehaviorSubject<boolean>(true);
    featureFlagSubject = new BehaviorSubject<boolean>(true);
    autotypeDefaultPolicySubject = new BehaviorSubject<boolean>(false);
    cipherViewsSubject = new BehaviorSubject<any[]>([]);

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

    // Mock GlobalStateProvider
    mockGlobalStateProvider = {
      get: jest.fn().mockImplementation((keyDef) => {
        if (keyDef.key === "autotypeEnabled") {
          return mockAutotypeEnabledState;
        }
        if (keyDef.key === "autotypeKeyboardShortcut") {
          return mockAutotypeKeyboardShortcutState;
        }
      }),
    } as any;

    // Mock AccountService
    mockAccountService = {
      activeAccount$: activeAccountSubject.asObservable(),
    } as any;

    // Mock AuthService
    mockAuthService = {
      activeAccountStatus$: activeAccountStatusSubject.asObservable(),
    } as any;

    // Mock CipherService
    mockCipherService = {
      cipherViews$: jest.fn().mockReturnValue(cipherViewsSubject.asObservable()),
    } as any;

    // Mock ConfigService
    mockConfigService = {
      getFeatureFlag$: jest.fn().mockReturnValue(featureFlagSubject.asObservable()),
    } as any;

    // Mock PlatformUtilsService
    mockPlatformUtilsService = {
      getDevice: jest.fn().mockReturnValue(DeviceType.WindowsDesktop),
    } as any;

    // Mock BillingAccountProfileStateService
    mockBillingAccountProfileStateService = {
      hasPremiumFromAnySource$: jest.fn().mockReturnValue(hasPremiumSubject.asObservable()),
    } as any;

    // Mock DesktopAutotypeDefaultSettingPolicy
    mockDesktopAutotypePolicy = {
      autotypeDefaultSetting$: autotypeDefaultPolicySubject.asObservable(),
    } as any;

    // Mock LogService
    mockLogService = {
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Mock ipc (global)
    global.ipc = {
      autofill: {
        listenAutotypeRequest: jest.fn(),
        configureAutotype: jest.fn(),
        toggleAutotype: jest.fn(),
      },
    } as any;

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
    jest.clearAllMocks();
    service.ngOnDestroy();
  });

  describe("constructor", () => {
    it("should create service", () => {
      expect(service).toBeTruthy();
    });

    it("should initialize observables", () => {
      expect(service.autotypeEnabledUserSetting$).toBeDefined();
      expect(service.autotypeKeyboardShortcut$).toBeDefined();
    });
  });

  describe("init", () => {
    it("should register autotype request listener on Windows", async () => {
      await service.init();

      expect(global.ipc.autofill.listenAutotypeRequest).toHaveBeenCalled();
    });

    it("should not initialize on non-Windows platforms", async () => {
      mockPlatformUtilsService.getDevice.mockReturnValue(DeviceType.MacOsDesktop);

      await service.init();

      expect(global.ipc.autofill.listenAutotypeRequest).not.toHaveBeenCalled();
    });

    it("should configure autotype when keyboard shortcut changes", async () => {
      await service.init();

      // Allow observables to emit
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(global.ipc.autofill.configureAutotype).toHaveBeenCalled();
    });

    it("should toggle autotype when feature enabled state changes", async () => {
      autotypeEnabledSubject.next(true);

      await service.init();

      // Allow observables to emit
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(global.ipc.autofill.toggleAutotype).toHaveBeenCalled();
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
      const newShortcut = ["Control", "Alt", "A"];

      await service.setAutotypeKeyboardShortcutState(newShortcut);

      expect(mockAutotypeKeyboardShortcutState.update).toHaveBeenCalled();
      expect(autotypeKeyboardShortcutSubject.value).toEqual(newShortcut);
    });
  });

  describe("matchCiphersToWindowTitle", () => {
    it("should match ciphers with matching apptitle URIs", async () => {
      const mockCiphers = [
        {
          login: {
            username: "user1",
            password: "pass1",
            uris: [{ uri: "apptitle://notepad" }],
          },
          deletedDate: null,
        },
        {
          login: {
            username: "user2",
            password: "pass2",
            uris: [{ uri: "apptitle://chrome" }],
          },
          deletedDate: null,
        },
      ];

      cipherViewsSubject.next(mockCiphers);

      const result = await service.matchCiphersToWindowTitle("Notepad - Document.txt");

      expect(result).toHaveLength(1);
      expect(result[0].login.username).toBe("user1");
    });

    it("should filter out deleted ciphers", async () => {
      const mockCiphers = [
        {
          login: {
            username: "user1",
            password: "pass1",
            uris: [{ uri: "apptitle://notepad" }],
          },
          deletedDate: new Date(),
        },
      ];

      cipherViewsSubject.next(mockCiphers);

      const result = await service.matchCiphersToWindowTitle("Notepad");

      expect(result).toHaveLength(0);
    });

    it("should filter out ciphers without username or password", async () => {
      const mockCiphers = [
        {
          login: {
            username: null,
            password: "pass1",
            uris: [{ uri: "apptitle://notepad" }],
          },
          deletedDate: null,
        },
      ];

      cipherViewsSubject.next(mockCiphers);

      const result = await service.matchCiphersToWindowTitle("Notepad");

      expect(result).toHaveLength(0);
    });

    it("should perform case-insensitive matching", async () => {
      const mockCiphers = [
        {
          login: {
            username: "user1",
            password: "pass1",
            uris: [{ uri: "apptitle://NOTEPAD" }],
          },
          deletedDate: null,
        },
      ];

      cipherViewsSubject.next(mockCiphers);

      const result = await service.matchCiphersToWindowTitle("notepad - document.txt");

      expect(result).toHaveLength(1);
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

describe("getAutotypeVaultData", () => {
  it("should return vault data when cipher has username and password", () => {
    const cipherView = new CipherView();
    cipherView.login.username = "foo";
    cipherView.login.password = "bar";

    const [error, vaultData] = getAutotypeVaultData(cipherView);

    expect(error).toBeNull();
    expect(vaultData?.username).toEqual("foo");
    expect(vaultData?.password).toEqual("bar");
  });

  it("should return error when firstCipher is undefined", () => {
    const cipherView = undefined;
    const [error, vaultData] = getAutotypeVaultData(cipherView);

    expect(vaultData).toBeNull();
    expect(error).toBeDefined();
    expect(error?.message).toEqual("No matching vault item.");
  });

  it("should return error when username is undefined", () => {
    const cipherView = new CipherView();
    cipherView.login.username = undefined;
    cipherView.login.password = "bar";

    const [error, vaultData] = getAutotypeVaultData(cipherView);

    expect(vaultData).toBeNull();
    expect(error).toBeDefined();
    expect(error?.message).toEqual("Vault item is undefined.");
  });

  it("should return error when password is undefined", () => {
    const cipherView = new CipherView();
    cipherView.login.username = "foo";
    cipherView.login.password = undefined;

    const [error, vaultData] = getAutotypeVaultData(cipherView);

    expect(vaultData).toBeNull();
    expect(error).toBeDefined();
    expect(error?.message).toEqual("Vault item is undefined.");
  });
});
