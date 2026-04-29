import { BehaviorSubject, EMPTY, of } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { SshAgentPromptType } from "../models/ssh-agent-setting";

import { SshAgentService } from "./ssh-agent.service";

function makeSshCipher(id: string, name: string, privateKey: string): CipherView {
  return {
    id,
    name,
    type: CipherType.SshKey,
    isDeleted: false,
    sshKey: { privateKey },
  } as unknown as CipherView;
}

/** Flush pending microtasks and one macrotask cycle to let async RxJS pipelines settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

describe("SshAgentService (v2 reactive key push)", () => {
  let service: SshAgentService;

  let accountSubject: BehaviorSubject<{ id: UserId } | null>;
  let enabledSubject: BehaviorSubject<boolean>;
  let cipherViewsSubject: BehaviorSubject<CipherView[] | null>;
  let authStatusPerUser: Map<string, BehaviorSubject<AuthenticationStatus>>;

  let mockIsLoaded: jest.Mock;
  let mockInit: jest.Mock;
  let mockReplace: jest.Mock;
  let mockStop: jest.Mock;

  function authSubjectFor(userId: string): BehaviorSubject<AuthenticationStatus> {
    if (!authStatusPerUser.has(userId)) {
      authStatusPerUser.set(
        userId,
        new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Locked),
      );
    }
    return authStatusPerUser.get(userId)!;
  }

  beforeEach(async () => {
    accountSubject = new BehaviorSubject<{ id: UserId } | null>(null);
    enabledSubject = new BehaviorSubject<boolean>(false);
    cipherViewsSubject = new BehaviorSubject<CipherView[] | null>(null);
    authStatusPerUser = new Map();

    mockIsLoaded = jest.fn().mockResolvedValue(false);
    mockInit = jest.fn().mockResolvedValue(undefined);
    mockReplace = jest.fn().mockResolvedValue(undefined);
    mockStop = jest.fn().mockResolvedValue(undefined);

    (global as any).ipc = {
      autofill: {
        sshAgent: {
          isLoaded: mockIsLoaded,
          init: mockInit,
          replace: mockReplace,
          stop: mockStop,
          signRequestResponse: jest.fn().mockResolvedValue(undefined),
          lock: jest.fn().mockResolvedValue(undefined),
        },
      },
      platform: { focusWindow: jest.fn() },
    };

    const mockCipherService = {
      cipherViews$: jest.fn().mockReturnValue(cipherViewsSubject.asObservable()),
      getAllDecrypted: jest.fn().mockResolvedValue([]),
    };
    const mockLogService = { info: jest.fn(), error: jest.fn() };
    const mockDialogService = { open: jest.fn() };
    const mockMessageListener = { messages$: jest.fn().mockReturnValue(EMPTY) };
    const mockAuthService = {
      activeAccountStatus$: of(AuthenticationStatus.Locked),
      authStatusFor$: jest
        .fn()
        .mockImplementation((userId: UserId) => authSubjectFor(userId as string).asObservable()),
    };
    const mockToastService = { showToast: jest.fn() };
    const mockI18nService = { t: jest.fn().mockReturnValue("") };
    const mockDesktopSettingsService = {
      sshAgentEnabled$: enabledSubject.asObservable(),
      sshAgentPromptBehavior$: of(SshAgentPromptType.Always),
    };
    const mockAccountService = { activeAccount$: accountSubject.asObservable() };
    const mockConfigService = { getFeatureFlag: jest.fn().mockResolvedValue(true) };

    service = new SshAgentService(
      mockCipherService as any,
      mockLogService as any,
      mockDialogService as any,
      mockMessageListener as any,
      mockAuthService as any,
      mockToastService as any,
      mockI18nService as any,
      mockDesktopSettingsService as any,
      mockAccountService as any,
      mockConfigService as any,
    );

    await service.init();
  });

  afterEach(() => {
    service.ngOnDestroy();
    jest.clearAllMocks();
  });

  it("when vault unlocks with feature enabled, starts server and sets keys", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    cipherViewsSubject.next([makeSshCipher("c1", "My Key", "pem")]);
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    expect(mockInit).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith([
      { name: "My Key", privateKey: "pem", cipherId: "c1" },
    ]);
  });

  it("when vault re-locks, retains keys in the agent (no stop)", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    cipherViewsSubject.next([]);
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    const stopCalls = mockStop.mock.calls.length;

    authSubjectFor("user-1").next(AuthenticationStatus.Locked);
    await flush();

    expect(mockStop.mock.calls.length).toBe(stopCalls);
  });

  it("when feature is disabled, clears keys and stops the server", async () => {
    mockIsLoaded.mockResolvedValue(true);
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    mockStop.mockClear();
    mockIsLoaded.mockResolvedValue(true);

    enabledSubject.next(false);
    await flush();

    expect(mockStop).toHaveBeenCalled();
  });

  it("when feature is re-enabled with vault unlocked, restarts server and pushes keys", async () => {
    accountSubject.next({ id: "user-1" as UserId });
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    mockInit.mockClear();
    mockReplace.mockClear();

    enabledSubject.next(true);
    cipherViewsSubject.next([makeSshCipher("c1", "Key", "pem")]);
    await flush();

    expect(mockInit).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalled();
  });

  it("when all accounts log out, clears keys and stops the server", async () => {
    mockIsLoaded.mockResolvedValue(true);
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    mockStop.mockClear();
    mockIsLoaded.mockResolvedValue(true);

    accountSubject.next(null);
    await flush();

    expect(mockStop).toHaveBeenCalled();
  });

  it("when switching to an unlocked account, replaces keys atomically", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    cipherViewsSubject.next([makeSshCipher("c1", "User1 Key", "pem1")]);
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    mockReplace.mockClear();

    cipherViewsSubject.next([makeSshCipher("c2", "User2 Key", "pem2")]);
    authSubjectFor("user-2").next(AuthenticationStatus.Unlocked);
    accountSubject.next({ id: "user-2" as UserId });
    await flush();

    expect(mockReplace).toHaveBeenCalledWith([
      { name: "User2 Key", privateKey: "pem2", cipherId: "c2" },
    ]);
  });

  it("when switching to a locked account, does not clear or replace keys", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    cipherViewsSubject.next([]);
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    const stopBefore = mockStop.mock.calls.length;

    // user-2 is locked by default in authStatusPerUser
    accountSubject.next({ id: "user-2" as UserId });
    await flush();

    expect(mockStop.mock.calls.length).toBe(stopBefore);
  });

  it("when an SSH key cipher is added, updates the agent keystore", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    cipherViewsSubject.next([makeSshCipher("c1", "Key A", "pem1")]);
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    mockReplace.mockClear();

    cipherViewsSubject.next([
      makeSshCipher("c1", "Key A", "pem1"),
      makeSshCipher("c2", "Key B", "pem2"),
    ]);
    await flush();

    expect(mockReplace).toHaveBeenCalledWith([
      { name: "Key A", privateKey: "pem1", cipherId: "c1" },
      { name: "Key B", privateKey: "pem2", cipherId: "c2" },
    ]);
  });

  it("when an SSH key cipher is deleted, updates the agent keystore", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    cipherViewsSubject.next([
      makeSshCipher("c1", "Key A", "pem1"),
      makeSshCipher("c2", "Key B", "pem2"),
    ]);
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    mockReplace.mockClear();

    cipherViewsSubject.next([makeSshCipher("c1", "Key A", "pem1")]);
    await flush();

    expect(mockReplace).toHaveBeenCalledWith([
      { name: "Key A", privateKey: "pem1", cipherId: "c1" },
    ]);
  });

  it("when an SSH key cipher is archived, updates the agent keystore", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    cipherViewsSubject.next([
      makeSshCipher("c1", "Key A", "pem1"),
      makeSshCipher("c2", "Key B", "pem2"),
    ]);
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    mockReplace.mockClear();

    cipherViewsSubject.next([
      makeSshCipher("c1", "Key A", "pem1"),
      { ...makeSshCipher("c2", "Key B", "pem2"), isArchived: true },
    ]);
    await flush();

    expect(mockReplace).toHaveBeenCalledWith([
      { name: "Key A", privateKey: "pem1", cipherId: "c1" },
    ]);
  });

  it("when all SSH key ciphers are archived, clears the keystore", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    cipherViewsSubject.next([makeSshCipher("c1", "Key A", "pem1")]);
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    mockReplace.mockClear();

    cipherViewsSubject.next([{ ...makeSshCipher("c1", "Key A", "pem1"), isArchived: true }]);
    await flush();

    expect(mockReplace).toHaveBeenCalledWith([]);
  });

  it("when an SSH key cipher is renamed, updates the agent keystore", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    cipherViewsSubject.next([makeSshCipher("c1", "Original Name", "pem1")]);
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    mockReplace.mockClear();

    cipherViewsSubject.next([makeSshCipher("c1", "New Name", "pem1")]);
    await flush();

    expect(mockReplace).toHaveBeenCalledWith([
      { name: "New Name", privateKey: "pem1", cipherId: "c1" },
    ]);
  });

  it("when identical key data is re-emitted, does not re-push keys", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    cipherViewsSubject.next([makeSshCipher("c1", "Key", "pem")]);
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    mockReplace.mockClear();

    cipherViewsSubject.next([makeSshCipher("c1", "Key", "pem")]);
    await flush();

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("when service is destroyed, stops the agent", async () => {
    mockIsLoaded.mockResolvedValue(true);
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    mockStop.mockClear();
    service.ngOnDestroy();
    await flush();

    expect(mockStop).toHaveBeenCalled();
  });

  it("when server is already loaded, does not call init again on unlock", async () => {
    mockIsLoaded.mockResolvedValue(true);
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    expect(mockInit).not.toHaveBeenCalled();
  });
});
