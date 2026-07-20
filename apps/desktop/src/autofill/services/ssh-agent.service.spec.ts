import { BehaviorSubject, EMPTY, Subject, of } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { SSH_AGENT_IPC_CHANNELS } from "../models/ipc-channels";
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

describe("SshAgentService", () => {
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
    const mockLogService = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warning: jest.fn(),
    };
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

  it("when feature is disabled, stops the agent server", async () => {
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

  it("when all accounts log out, stops the agent server", async () => {
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
    const replaceBefore = mockReplace.mock.calls.length;

    // Simulate locked vault: the real cipherViews$ emits null when locked.
    cipherViewsSubject.next(null);
    // user-2 is locked by default in authStatusPerUser
    accountSubject.next({ id: "user-2" as UserId });
    await flush();

    expect(mockStop.mock.calls.length).toBe(stopBefore);
    expect(mockReplace.mock.calls.length).toBe(replaceBefore);
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

  it("when service is destroyed, resets in-memory approval state", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    (service as any).authorizedKeys = new Map([["cipher-abc", new Set(["local"])]]);

    service.ngOnDestroy();
    await flush();

    expect((service as any).authorizedKeys).toEqual(new Map());
  });

  it("when server is already loaded, does not call init again on unlock", async () => {
    mockIsLoaded.mockResolvedValue(true);
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    expect(mockInit).not.toHaveBeenCalled();
  });

  it("when the active account changes with feature enabled, resets in-memory approval state", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    await flush();

    (service as any).authorizedKeys = new Map([["cipher-abc", new Set(["local"])]]);

    accountSubject.next({ id: "user-2" as UserId });
    await flush();

    expect((service as any).authorizedKeys).toEqual(new Map());
  });

  it("when the active account changes with feature disabled, still resets in-memory approval state", async () => {
    accountSubject.next({ id: "user-1" as UserId });
    await flush();

    (service as any).authorizedKeys = new Map([["cipher-abc", new Set(["local"])]]);

    accountSubject.next({ id: "user-2" as UserId });
    await flush();

    expect((service as any).authorizedKeys).toEqual(new Map());
  });

  it("when activeAccount$ re-emits with the same id, does not reset approval state", async () => {
    enabledSubject.next(true);
    accountSubject.next({ id: "user-1" as UserId });
    await flush();

    const seeded = new Map([["cipher-abc", new Set(["local"])]]);
    (service as any).authorizedKeys = seeded;

    accountSubject.next({ id: "user-1" as UserId });
    await flush();

    expect((service as any).authorizedKeys).toBe(seeded);
  });
});

describe("SshAgentService – sign request authorization", () => {
  const CIPHER_ID = "cipher-auth-1";
  const REQUEST_ID = 99;

  let service: SshAgentService;
  let signRequestSubject: Subject<Record<string, unknown>>;
  let promptBehaviorSubject: BehaviorSubject<SshAgentPromptType>;
  let authStatusSubject: BehaviorSubject<AuthenticationStatus>;
  let accountSubject: BehaviorSubject<{ id: UserId } | null>;
  let mockSignRequestResponse: jest.Mock;
  let mockDialogOpen: jest.Mock;

  beforeEach(async () => {
    signRequestSubject = new Subject();
    promptBehaviorSubject = new BehaviorSubject<SshAgentPromptType>(SshAgentPromptType.Always);
    authStatusSubject = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    accountSubject = new BehaviorSubject<{ id: UserId } | null>({ id: "user-1" as UserId });
    mockSignRequestResponse = jest.fn().mockResolvedValue(undefined);
    mockDialogOpen = jest.fn().mockReturnValue({ closed: of(true) });

    (global as any).ipc = {
      autofill: {
        sshAgent: {
          isLoaded: jest.fn().mockResolvedValue(false),
          init: jest.fn().mockResolvedValue(undefined),
          replace: jest.fn().mockResolvedValue(undefined),
          stop: jest.fn().mockResolvedValue(undefined),
          signRequestResponse: mockSignRequestResponse,
          listRequestResponse: jest.fn().mockResolvedValue(undefined),
          lock: jest.fn().mockResolvedValue(undefined),
        },
      },
      platform: { focusWindow: jest.fn() },
    };

    service = new SshAgentService(
      {
        cipherViews$: jest.fn().mockReturnValue(of([])),
        getAllDecrypted: jest.fn().mockResolvedValue([makeSshCipher(CIPHER_ID, "Test Key", "pem")]),
      } as any,
      { info: jest.fn(), error: jest.fn() } as any,
      { open: mockDialogOpen } as any,
      { messages$: jest.fn().mockReturnValue(signRequestSubject.asObservable()) } as any,
      {
        activeAccountStatus$: authStatusSubject.asObservable(),
        authStatusFor$: jest.fn().mockReturnValue(authStatusSubject.asObservable()),
      } as any,
      { showToast: jest.fn() } as any,
      { t: jest.fn().mockReturnValue("") } as any,
      {
        sshAgentEnabled$: of(true),
        sshAgentPromptBehavior$: promptBehaviorSubject.asObservable(),
      } as any,
      { activeAccount$: accountSubject.asObservable() } as any,
      { getFeatureFlag: jest.fn().mockResolvedValue(true) } as any,
    );

    await service.init();
  });

  afterEach(() => {
    service.ngOnDestroy();
    jest.clearAllMocks();
  });

  function sendSignRequest(isAgentForwarding = false, hostFingerprint?: string) {
    signRequestSubject.next({
      cipherId: CIPHER_ID,
      requestId: REQUEST_ID,
      processName: "test-app",
      namespace: "",
      isAgentForwarding,
      isListRequest: false,
      hostFingerprint,
    });
  }

  it("Never: approves without showing dialog", async () => {
    promptBehaviorSubject.next(SshAgentPromptType.Never);
    sendSignRequest();
    await flush();

    expect(mockDialogOpen).not.toHaveBeenCalled();
    expect(mockSignRequestResponse).toHaveBeenCalledWith(REQUEST_ID, true);
  });

  it("Always: shows dialog and approves when user confirms", async () => {
    mockDialogOpen.mockReturnValue({ closed: of(true) });
    sendSignRequest();
    await flush();

    expect(mockDialogOpen).toHaveBeenCalled();
    expect(mockSignRequestResponse).toHaveBeenCalledWith(REQUEST_ID, true);
  });

  it("Always: shows dialog and denies when user rejects", async () => {
    mockDialogOpen.mockReturnValue({ closed: of(false) });
    sendSignRequest();
    await flush();

    expect(mockDialogOpen).toHaveBeenCalled();
    expect(mockSignRequestResponse).toHaveBeenCalledWith(REQUEST_ID, false);
  });

  it("RememberUntilLock: shows dialog on first request for a cipher", async () => {
    promptBehaviorSubject.next(SshAgentPromptType.RememberUntilLock);
    sendSignRequest();
    await flush();

    expect(mockDialogOpen).toHaveBeenCalledTimes(1);
    expect(mockSignRequestResponse).toHaveBeenCalledWith(REQUEST_ID, true);
  });

  it("RememberUntilLock: skips dialog on subsequent requests for the same cipher", async () => {
    promptBehaviorSubject.next(SshAgentPromptType.RememberUntilLock);
    sendSignRequest();
    await flush();
    mockDialogOpen.mockClear();
    mockSignRequestResponse.mockClear();

    sendSignRequest();
    await flush();

    expect(mockDialogOpen).not.toHaveBeenCalled();
    expect(mockSignRequestResponse).toHaveBeenCalledWith(REQUEST_ID, true);
  });

  it("Never: approves forwarded requests without showing dialog", async () => {
    promptBehaviorSubject.next(SshAgentPromptType.Never);
    sendSignRequest(true, "SHA256:fp-server1");
    await flush();

    expect(mockDialogOpen).not.toHaveBeenCalled();
    expect(mockSignRequestResponse).toHaveBeenCalledWith(REQUEST_ID, true);
  });

  it("RememberUntilLock: forwarded requests to same host are remembered by host fingerprint", async () => {
    promptBehaviorSubject.next(SshAgentPromptType.RememberUntilLock);
    sendSignRequest(true, "SHA256:fp-server1");
    await flush();
    mockDialogOpen.mockClear();
    mockSignRequestResponse.mockClear();

    // Same host fingerprint — no new prompt
    sendSignRequest(true, "SHA256:fp-server1");
    await flush();

    expect(mockDialogOpen).not.toHaveBeenCalled();
    expect(mockSignRequestResponse).toHaveBeenCalledWith(REQUEST_ID, true);
  });

  it("RememberUntilLock: forwarded requests to different hosts prompt independently", async () => {
    promptBehaviorSubject.next(SshAgentPromptType.RememberUntilLock);
    sendSignRequest(true, "SHA256:fp-server1");
    await flush();
    mockDialogOpen.mockClear();
    mockSignRequestResponse.mockClear();

    // Different host fingerprint — prompts again
    sendSignRequest(true, "SHA256:fp-server2");
    await flush();

    expect(mockDialogOpen).toHaveBeenCalledTimes(1);
    expect(mockSignRequestResponse).toHaveBeenCalledWith(REQUEST_ID, true);
  });

  it("RememberUntilLock: local approval does not cover forwarded requests", async () => {
    promptBehaviorSubject.next(SshAgentPromptType.RememberUntilLock);

    // Local approval
    sendSignRequest(false);
    await flush();
    mockDialogOpen.mockClear();
    mockSignRequestResponse.mockClear();

    // Forwarded request for same cipher — must still prompt
    sendSignRequest(true, "SHA256:fp-server1");
    await flush();

    expect(mockDialogOpen).toHaveBeenCalledTimes(1);
    expect(mockSignRequestResponse).toHaveBeenCalledWith(REQUEST_ID, true);
  });

  it("RememberUntilLock: forwarded without host fingerprint always prompts (v1 path)", async () => {
    promptBehaviorSubject.next(SshAgentPromptType.RememberUntilLock);

    // First forwarded request with no fingerprint — prompts
    sendSignRequest(true, undefined);
    await flush();
    expect(mockDialogOpen).toHaveBeenCalledTimes(1);
    mockDialogOpen.mockClear();
    mockSignRequestResponse.mockClear();

    // Second forwarded request with no fingerprint — cannot cache, must prompt again
    sendSignRequest(true, undefined);
    await flush();

    expect(mockDialogOpen).toHaveBeenCalledTimes(1);
    expect(mockSignRequestResponse).toHaveBeenCalledWith(REQUEST_ID, true);
  });

  it("RememberUntilLock: authorizedKeys cleared on account switch", async () => {
    promptBehaviorSubject.next(SshAgentPromptType.RememberUntilLock);

    // Approve under user-1
    sendSignRequest(false);
    await flush();
    expect(mockDialogOpen).toHaveBeenCalledTimes(1);
    mockDialogOpen.mockClear();
    mockSignRequestResponse.mockClear();

    // Switch account — should clear the cache
    accountSubject.next({ id: "user-2" as UserId });
    await flush();

    // Same cipher must prompt again under the new account
    sendSignRequest(false);
    await flush();

    expect(mockDialogOpen).toHaveBeenCalledTimes(1);
    expect(mockSignRequestResponse).toHaveBeenCalledWith(REQUEST_ID, true);
  });

  it("RememberUntilLock: re-prompts after vault locks and unlocks", async () => {
    promptBehaviorSubject.next(SshAgentPromptType.RememberUntilLock);

    // First request — approved and remembered
    sendSignRequest();
    await flush();
    expect(mockDialogOpen).toHaveBeenCalledTimes(1);
    mockDialogOpen.mockClear();
    mockSignRequestResponse.mockClear();

    // Vault locks then unlocks
    authStatusSubject.next(AuthenticationStatus.Locked);
    await flush();
    authStatusSubject.next(AuthenticationStatus.Unlocked);
    await flush();

    // Second request — cache was cleared, dialog must appear again
    sendSignRequest();
    await flush();

    expect(mockDialogOpen).toHaveBeenCalledTimes(1);
    expect(mockSignRequestResponse).toHaveBeenCalledWith(REQUEST_ID, true);
  });
});

describe("SshAgentService – list keys request", () => {
  const LIST_REQUEST_ID = 42;

  let service: SshAgentService;
  let listKeysRequestSubject: Subject<Record<string, unknown>>;
  let authStatusSubject: BehaviorSubject<AuthenticationStatus>;
  let accountSubject: BehaviorSubject<{ id: UserId } | null>;
  let mockListRequestResponse: jest.Mock;
  let mockReplace: jest.Mock;
  let mockFocusWindow: jest.Mock;
  let mockShowToast: jest.Mock;

  beforeEach(async () => {
    listKeysRequestSubject = new Subject();
    authStatusSubject = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    accountSubject = new BehaviorSubject<{ id: UserId } | null>({ id: "user-1" as UserId });
    mockListRequestResponse = jest.fn().mockResolvedValue(undefined);
    mockReplace = jest.fn().mockResolvedValue(undefined);
    mockFocusWindow = jest.fn();
    mockShowToast = jest.fn();

    (global as any).ipc = {
      autofill: {
        sshAgent: {
          isLoaded: jest.fn().mockResolvedValue(false),
          init: jest.fn().mockResolvedValue(undefined),
          replace: mockReplace,
          stop: jest.fn().mockResolvedValue(undefined),
          signRequestResponse: jest.fn().mockResolvedValue(undefined),
          listRequestResponse: mockListRequestResponse,
          lock: jest.fn().mockResolvedValue(undefined),
        },
      },
      platform: { focusWindow: mockFocusWindow },
    };

    service = new SshAgentService(
      {
        cipherViews$: jest.fn().mockReturnValue(of([])),
        getAllDecrypted: jest.fn().mockResolvedValue([makeSshCipher("c1", "My Key", "pem")]),
      } as any,
      { info: jest.fn(), error: jest.fn() } as any,
      { open: jest.fn() } as any,
      {
        messages$: jest
          .fn()
          .mockImplementation((def: { command: string }) =>
            def.command === SSH_AGENT_IPC_CHANNELS.LIST_KEYS_REQUEST
              ? listKeysRequestSubject.asObservable()
              : EMPTY,
          ),
      } as any,
      {
        activeAccountStatus$: authStatusSubject.asObservable(),
        authStatusFor$: jest.fn().mockReturnValue(authStatusSubject.asObservable()),
      } as any,
      { showToast: mockShowToast } as any,
      { t: jest.fn().mockReturnValue("") } as any,
      {
        sshAgentEnabled$: of(true),
        sshAgentPromptBehavior$: of(SshAgentPromptType.Always),
      } as any,
      { activeAccount$: accountSubject.asObservable() } as any,
      { getFeatureFlag: jest.fn().mockResolvedValue(true) } as any,
    );

    await service.init();
  });

  afterEach(() => {
    service.ngOnDestroy();
    jest.clearAllMocks();
  });

  function sendListRequest() {
    listKeysRequestSubject.next({ requestId: LIST_REQUEST_ID });
  }

  it("when vault is unlocked, replaces keys and sends listRequestResponse(true)", async () => {
    sendListRequest();
    await flush();

    expect(mockReplace).toHaveBeenCalledWith([
      { name: "My Key", privateKey: "pem", cipherId: "c1" },
    ]);
    expect(mockListRequestResponse).toHaveBeenCalledWith(LIST_REQUEST_ID, true);
  });

  it("when vault is locked, focuses window and shows toast", async () => {
    authStatusSubject.next(AuthenticationStatus.Locked);
    await flush();

    sendListRequest();
    await flush();

    expect(mockFocusWindow).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "info" }));
  });

  it("when vault is locked then unlocks, replaces keys and sends listRequestResponse(true)", async () => {
    authStatusSubject.next(AuthenticationStatus.Locked);
    await flush();

    sendListRequest();
    await flush();

    // Vault unlocks — pipeline should continue
    authStatusSubject.next(AuthenticationStatus.Unlocked);
    await flush();

    expect(mockReplace).toHaveBeenCalled();
    expect(mockListRequestResponse).toHaveBeenCalledWith(LIST_REQUEST_ID, true);
  });

  it("when unlock times out, sends listRequestResponse(false) exactly once and does not replace keys", async () => {
    jest.useFakeTimers();

    try {
      authStatusSubject.next(AuthenticationStatus.Locked);

      // Drain the microtask queue so the reactive keys pipeline fully settles after the
      // status change (it re-subscribes to cipherViews$ and may call replace).
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      // Clear mocks so assertions only capture what the timeout path does.
      mockReplace.mockClear();
      mockListRequestResponse.mockClear();

      // Reduce timeout so the timer fires quickly under fake timers.
      (service as any).SSH_VAULT_UNLOCK_REQUEST_TIMEOUT = 50;

      sendListRequest();

      // Advance past the 50ms timeout so RxJS fires the TimeoutError synchronously.
      jest.advanceTimersByTime(100);

      // Drain microtasks: the catchError calls the IPC mock (a resolved promise),
      // then switchMap(() => EMPTY) completes the inner observable.
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }

      expect(mockListRequestResponse).toHaveBeenCalledWith(LIST_REQUEST_ID, false);
      expect(mockListRequestResponse).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("SshAgentService – concurrent sign requests", () => {
  let service: SshAgentService;
  let signRequestSubject: Subject<Record<string, unknown>>;
  let mockSignRequestResponse: jest.Mock;
  let mockGetAllDecrypted: jest.Mock;

  beforeEach(async () => {
    signRequestSubject = new Subject();
    mockSignRequestResponse = jest.fn().mockResolvedValue(undefined);
    mockGetAllDecrypted = jest.fn();

    (global as any).ipc = {
      autofill: {
        sshAgent: {
          isLoaded: jest.fn().mockResolvedValue(false),
          init: jest.fn().mockResolvedValue(undefined),
          replace: jest.fn().mockResolvedValue(undefined),
          stop: jest.fn().mockResolvedValue(undefined),
          signRequestResponse: mockSignRequestResponse,
          listRequestResponse: jest.fn().mockResolvedValue(undefined),
        },
      },
      platform: { focusWindow: jest.fn() },
    };

    service = new SshAgentService(
      {
        cipherViews$: jest.fn().mockReturnValue(of([])),
        getAllDecrypted: mockGetAllDecrypted,
      } as any,
      { info: jest.fn(), error: jest.fn() } as any,
      { open: jest.fn() } as any,
      {
        messages$: jest
          .fn()
          .mockImplementation((def: { command: string }) =>
            def.command === SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST
              ? signRequestSubject.asObservable()
              : EMPTY,
          ),
      } as any,
      {
        activeAccountStatus$: of(AuthenticationStatus.Unlocked),
        authStatusFor$: jest.fn().mockReturnValue(of(AuthenticationStatus.Unlocked)),
      } as any,
      { showToast: jest.fn() } as any,
      { t: jest.fn().mockReturnValue("") } as any,
      {
        sshAgentEnabled$: of(true),
        // Never: no dialog shown, signRequestResponse called immediately after decrypt.
        sshAgentPromptBehavior$: of(SshAgentPromptType.Never),
      } as any,
      { activeAccount$: of({ id: "user-1" as UserId }) } as any,
      { getFeatureFlag: jest.fn().mockResolvedValue(true) } as any,
    );

    await service.init();
  });

  afterEach(() => {
    service.ngOnDestroy();
    jest.clearAllMocks();
  });

  it("when two sign requests arrive before getAllDecrypted resolves, both receive signRequestResponse", async () => {
    // Gate the first decryption behind a manually controlled promise so that the
    // second request can arrive while the first is still in-flight through the pipeline.
    let resolveFirstDecrypt!: (ciphers: CipherView[]) => void;
    mockGetAllDecrypted
      .mockReturnValueOnce(
        new Promise<CipherView[]>((resolve) => {
          resolveFirstDecrypt = resolve;
        }),
      )
      .mockResolvedValue([]);

    // Emit both requests before the pending getAllDecrypted resolves.
    signRequestSubject.next({
      cipherId: "c1",
      requestId: 1,
      processName: "",
      namespace: "",
      isAgentForwarding: false,
      isListRequest: false,
    });
    signRequestSubject.next({
      cipherId: "c1",
      requestId: 2,
      processName: "",
      namespace: "",
      isAgentForwarding: false,
      isListRequest: false,
    });
    await flush();

    // Release the first decryption. With concatMap, request 1 proceeds and request 2
    // is queued. With switchMap (bug), request 1 was already cancelled and only request 2
    // ever gets a response.
    resolveFirstDecrypt([]);
    await flush();
    await flush();

    expect(mockSignRequestResponse).toHaveBeenCalledWith(1, true);
    expect(mockSignRequestResponse).toHaveBeenCalledWith(2, true);
  });
});

describe("SshAgentService – concurrent list keys requests", () => {
  let service: SshAgentService;
  let listKeysRequestSubject: Subject<Record<string, unknown>>;
  let mockListRequestResponse: jest.Mock;
  let mockGetAllDecrypted: jest.Mock;

  beforeEach(async () => {
    listKeysRequestSubject = new Subject();
    mockListRequestResponse = jest.fn().mockResolvedValue(undefined);
    mockGetAllDecrypted = jest.fn();

    (global as any).ipc = {
      autofill: {
        sshAgent: {
          isLoaded: jest.fn().mockResolvedValue(false),
          init: jest.fn().mockResolvedValue(undefined),
          replace: jest.fn().mockResolvedValue(undefined),
          stop: jest.fn().mockResolvedValue(undefined),
          signRequestResponse: jest.fn().mockResolvedValue(undefined),
          listRequestResponse: mockListRequestResponse,
        },
      },
      platform: { focusWindow: jest.fn() },
    };

    service = new SshAgentService(
      {
        cipherViews$: jest.fn().mockReturnValue(of([])),
        getAllDecrypted: mockGetAllDecrypted,
      } as any,
      { info: jest.fn(), error: jest.fn() } as any,
      { open: jest.fn() } as any,
      {
        messages$: jest
          .fn()
          .mockImplementation((def: { command: string }) =>
            def.command === SSH_AGENT_IPC_CHANNELS.LIST_KEYS_REQUEST
              ? listKeysRequestSubject.asObservable()
              : EMPTY,
          ),
      } as any,
      {
        activeAccountStatus$: of(AuthenticationStatus.Unlocked),
        authStatusFor$: jest.fn().mockReturnValue(of(AuthenticationStatus.Unlocked)),
      } as any,
      { showToast: jest.fn() } as any,
      { t: jest.fn().mockReturnValue("") } as any,
      {
        sshAgentEnabled$: of(true),
        sshAgentPromptBehavior$: of(SshAgentPromptType.Always),
      } as any,
      { activeAccount$: of({ id: "user-1" as UserId }) } as any,
      { getFeatureFlag: jest.fn().mockResolvedValue(true) } as any,
    );

    await service.init();
  });

  afterEach(() => {
    service.ngOnDestroy();
    jest.clearAllMocks();
  });

  it("when two list requests arrive before getAllDecrypted resolves, both receive listRequestResponse", async () => {
    let resolveFirstDecrypt!: (ciphers: CipherView[]) => void;
    mockGetAllDecrypted
      .mockReturnValueOnce(
        new Promise<CipherView[]>((resolve) => {
          resolveFirstDecrypt = resolve;
        }),
      )
      .mockResolvedValue([]);

    listKeysRequestSubject.next({ requestId: 1 });
    listKeysRequestSubject.next({ requestId: 2 });
    await flush();

    resolveFirstDecrypt([]);
    await flush();
    await flush();

    expect(mockListRequestResponse).toHaveBeenCalledWith(1, true);
    expect(mockListRequestResponse).toHaveBeenCalledWith(2, true);
  });
});
