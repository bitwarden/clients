import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, EMPTY, Subject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AgentFillTargetDescription } from "@bitwarden/common/autofill/agent-fill/agent-fill-messages";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";

import {
  AgentAccessSecretsService,
  SmSecretMatch,
  SmSecretValue,
} from "./agent-access-secrets.service";
import {
  AgentFillBrowserService,
  ExtensionUnavailableError,
  MultipleBrowsersError,
} from "./agent-fill-browser.service";
import { DesktopAgentAccessService } from "./desktop-agent-access.service";

// The SDK is a wasm module that can't be loaded in jest; it is only pulled in transitively via
// `AgentFillBrowserService` (mocked below), so mirror the couple of runtime symbols module
// evaluation touches.
jest.mock("@bitwarden/sdk-internal", () => ({
  OutgoingMessage: { new_json_payload: jest.fn() },
  LogLevel: { Trace: 0, Debug: 1, Info: 2, Warn: 3, Error: 4 },
}));

// `AgentAccessSecretsService` (mocked below, via `mockAgentAccessSecretsService`) imports
// `PasswordGenerationServiceAbstraction` from `@bitwarden/generator-legacy` for
// `generateSecretValue` (M6). That package's barrel unconditionally re-exports the concrete
// legacy factory too, which pulls in `@bitwarden/generator-core`'s metadata module — and loading
// that module graph in this spec (only this one; `agent-access-secrets.service.spec.ts` loads it
// fine on its own) collides with the `@bitwarden/sdk-internal` mock above and throws during
// module evaluation, before any test runs. Since `AgentAccessSecretsService` itself is fully
// mocked as a plain object in `buildService` and never constructed here, only the *module*, never
// the real class, needs to exist — stub it the same way the SDK is stubbed above.
jest.mock("@bitwarden/generator-legacy", () => ({
  PasswordGenerationServiceAbstraction: class {},
}));

function makeLoginCipher(
  id: string,
  name: string,
  overrides: Partial<CipherView["login"]> = {},
): CipherView {
  return {
    id,
    name,
    type: CipherType.Login,
    isDeleted: false,
    isArchived: false,
    notes: null,
    login: {
      username: "user@example.com",
      password: "hunter2",
      totp: null,
      uris: [{ uri: "https://example.com" }],
      // The fill branch's origin filter calls the real LoginView's matchesUri; these fixtures
      // are plain objects, so stub it as matching by default (override per test).
      matchesUri: jest.fn().mockReturnValue(true),
      ...overrides,
    },
  } as unknown as CipherView;
}

function makeFillDescription(
  overrides: Partial<AgentFillTargetDescription> = {},
): AgentFillTargetDescription {
  return {
    origin: "https://example.com",
    formClass: "login",
    candidates: [
      { role: "username", target: "input#email (login form)", visible: true, frame: "top" },
      { role: "password", target: "input[type=password]#pw", visible: true, frame: "top" },
    ],
    refusals: [],
    targetToken: "ft_1",
    expiresInMs: 30_000,
    ...overrides,
  };
}

/** Flush pending microtasks and one macrotask cycle to let async RxJS pipelines settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

describe("DesktopAgentAccessService", () => {
  let service: DesktopAgentAccessService;

  let accountSubject: BehaviorSubject<{ id: UserId } | null>;
  let agentAccessEnabledSubject: BehaviorSubject<boolean>;
  let authStatusPerUser: Map<string, BehaviorSubject<AuthenticationStatus>>;
  let activeAccountStatusSubject: BehaviorSubject<AuthenticationStatus>;
  let credentialRequestSubject: Subject<Record<string, unknown>>;
  let fingerprintRequestSubject: Subject<Record<string, unknown>>;

  let mockIsLoaded: jest.Mock;
  let mockInit: jest.Mock;
  let mockStop: jest.Mock;
  let mockCredentialRequestResponse: jest.Mock;
  let mockFingerprintResponse: jest.Mock;
  let mockFocusWindow: jest.Mock;
  let mockShowToast: jest.Mock;
  let mockDialogOpen: jest.Mock;
  let mockGetAllDecryptedForUrl: jest.Mock;
  let mockGetAllDecrypted: jest.Mock;
  let mockGetFeatureFlag: jest.Mock;
  let mockFindGrant: jest.Mock;
  let mockUpsertGrant: jest.Mock;
  let mockClearActivity: jest.Mock;
  let mockSendMessage: jest.Mock;
  let mockFindSecrets: jest.Mock;
  let mockGetSecretValue: jest.Mock;
  let mockSmOrganizations: jest.Mock;
  let mockCreateProject: jest.Mock;
  let mockCreateSecret: jest.Mock;
  let mockCollect: jest.Mock;
  let mockDescribeTarget: jest.Mock;
  let mockFill: jest.Mock;
  let mockGetCode: jest.Mock;
  let mockGetSecretForUpdate: jest.Mock;
  let mockUpdateSecret: jest.Mock;
  let mockDeleteSecret: jest.Mock;
  let mockListProjects: jest.Mock;
  let mockUpdateProject: jest.Mock;
  let mockDeleteProject: jest.Mock;
  let mockCountSecretsInProject: jest.Mock;
  let mockGenerateSecretValue: jest.Mock;
  let mockResolveProjectName: jest.Mock;
  let mockResolveProjectSelector: jest.Mock;
  let mockListSecretsInProject: jest.Mock;
  let mockGetSecretValuesByIds: jest.Mock;

  function authSubjectFor(userId: string): BehaviorSubject<AuthenticationStatus> {
    if (!authStatusPerUser.has(userId)) {
      authStatusPerUser.set(
        userId,
        new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Locked),
      );
    }
    return authStatusPerUser.get(userId)!;
  }

  function buildService(featureFlagEnabled = true) {
    mockGetFeatureFlag = jest.fn().mockResolvedValue(featureFlagEnabled);

    const mockCipherService = {
      getAllDecryptedForUrl: mockGetAllDecryptedForUrl,
      getAllDecrypted: mockGetAllDecrypted,
    };
    const mockLogService = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
    const mockDialogService = { open: mockDialogOpen };
    const mockMessageListener = {
      messages$: jest.fn().mockImplementation((def: { command: string }) => {
        if (def.command === AGENT_ACCESS_IPC_CHANNELS.CREDENTIAL_REQUEST) {
          return credentialRequestSubject.asObservable();
        }
        if (def.command === AGENT_ACCESS_IPC_CHANNELS.FINGERPRINT_REQUEST) {
          return fingerprintRequestSubject.asObservable();
        }
        return EMPTY;
      }),
    };
    const mockAuthService = {
      activeAccountStatus$: activeAccountStatusSubject.asObservable(),
      authStatusFor$: jest
        .fn()
        .mockImplementation((userId: UserId) => authSubjectFor(userId as string).asObservable()),
    };
    const mockToastService = { showToast: mockShowToast };
    const mockI18nService = { t: jest.fn().mockReturnValue("") };
    const mockDesktopSettingsService = {
      agentAccessEnabled$: agentAccessEnabledSubject.asObservable(),
    };
    const mockAccountService = { activeAccount$: accountSubject.asObservable() };
    const mockConfigService = { getFeatureFlag: mockGetFeatureFlag };
    const mockTotpService = { getCode$: mockGetCode };
    const mockAgentAccessSecretsService = {
      findSecrets: mockFindSecrets,
      getSecretValue: mockGetSecretValue,
      smOrganizations: mockSmOrganizations,
      resolveSecretName: jest.fn().mockReturnValue(undefined),
      resolveProjectName: mockResolveProjectName,
      createProject: mockCreateProject,
      createSecret: mockCreateSecret,
      getSecretForUpdate: mockGetSecretForUpdate,
      updateSecret: mockUpdateSecret,
      deleteSecret: mockDeleteSecret,
      listProjects: mockListProjects,
      updateProject: mockUpdateProject,
      deleteProject: mockDeleteProject,
      countSecretsInProject: mockCountSecretsInProject,
      generateSecretValue: mockGenerateSecretValue,
      resolveProjectSelector: mockResolveProjectSelector,
      listSecretsInProject: mockListSecretsInProject,
      getSecretValuesByIds: mockGetSecretValuesByIds,
    };
    const mockEventCollectionService = { collect: mockCollect };
    const mockDomainSettingsService = {
      getUrlEquivalentDomains: jest.fn().mockReturnValue(of(new Set<string>())),
      resolvedDefaultUriMatchStrategy$: of(0),
    };
    const mockAgentFillBrowserService = {
      init: jest.fn(),
      describeTarget: mockDescribeTarget,
      fill: mockFill,
    };

    TestBed.configureTestingModule({
      providers: [
        DesktopAgentAccessService,
        { provide: CipherService, useValue: mockCipherService },
        { provide: LogService, useValue: mockLogService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: MessageListener, useValue: mockMessageListener },
        { provide: MessageSender, useValue: { send: mockSendMessage } },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ToastService, useValue: mockToastService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: DesktopSettingsService, useValue: mockDesktopSettingsService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TotpService, useValue: mockTotpService },
        { provide: AgentAccessSecretsService, useValue: mockAgentAccessSecretsService },
        { provide: EventCollectionService, useValue: mockEventCollectionService },
        { provide: DomainSettingsService, useValue: mockDomainSettingsService },
        { provide: AgentFillBrowserService, useValue: mockAgentFillBrowserService },
      ],
    });

    return TestBed.inject(DesktopAgentAccessService);
  }

  beforeEach(() => {
    accountSubject = new BehaviorSubject<{ id: UserId } | null>(null);
    agentAccessEnabledSubject = new BehaviorSubject<boolean>(false);
    authStatusPerUser = new Map();
    activeAccountStatusSubject = new BehaviorSubject<AuthenticationStatus>(
      AuthenticationStatus.Locked,
    );
    credentialRequestSubject = new Subject();
    fingerprintRequestSubject = new Subject();

    mockIsLoaded = jest.fn().mockResolvedValue(false);
    mockInit = jest.fn().mockResolvedValue(undefined);
    mockStop = jest.fn().mockResolvedValue(undefined);
    mockCredentialRequestResponse = jest.fn().mockResolvedValue(undefined);
    mockFingerprintResponse = jest.fn().mockResolvedValue(undefined);
    mockFocusWindow = jest.fn();
    mockShowToast = jest.fn();
    mockDialogOpen = jest.fn().mockReturnValue({ closed: of(true) });
    mockGetAllDecryptedForUrl = jest.fn().mockResolvedValue([]);
    mockGetAllDecrypted = jest.fn().mockResolvedValue([]);
    mockClearActivity = jest.fn().mockResolvedValue(undefined);
    mockSendMessage = jest.fn();
    // Secrets Manager path (M4): default to "nothing found" so a stray secret-resourceType test
    // that doesn't configure these explicitly denies with NotFound rather than silently matching.
    mockFindSecrets = jest.fn().mockResolvedValue({ matches: [], truncated: false });
    // Post-approval, single-secret fetch (M4c): default to a rejection so a stray test that
    // reaches approval without configuring this explicitly denies (via the fetch-failure path)
    // rather than silently releasing a fabricated value.
    mockGetSecretValue = jest
      .fn()
      .mockRejectedValue(new Error("no getSecretValue fixture configured"));
    // Secret creation (M4b): default to "no SM access" so a stray operation: "create" test that
    // doesn't configure this explicitly denies rather than silently opening a dialog with a
    // fabricated organization list.
    mockSmOrganizations = jest.fn().mockResolvedValue([]);
    mockCreateProject = jest.fn().mockResolvedValue({ id: "proj-new", name: "new project" });
    mockCreateSecret = jest.fn().mockResolvedValue("secret-created-1");
    // M6 write paths: default to rejections/empty-lists so a stray update/delete/list test that
    // doesn't configure these explicitly fails loudly (a generic-error deny) rather than silently
    // fabricating a target or succeeding.
    mockGetSecretForUpdate = jest
      .fn()
      .mockRejectedValue(new Error("no getSecretForUpdate fixture configured"));
    mockUpdateSecret = jest.fn().mockResolvedValue(undefined);
    mockDeleteSecret = jest.fn().mockResolvedValue(undefined);
    mockListProjects = jest.fn().mockResolvedValue([]);
    mockUpdateProject = jest.fn().mockResolvedValue(undefined);
    mockDeleteProject = jest.fn().mockResolvedValue(undefined);
    mockCountSecretsInProject = jest.fn().mockResolvedValue(undefined);
    mockGenerateSecretValue = jest.fn().mockResolvedValue("generated-value");
    mockResolveProjectName = jest.fn().mockReturnValue(undefined);
    // M7 bulk-secrets path: default to "unresolvable"/"empty"/"reject" so a stray
    // operation: "bulkRequest" test that doesn't configure these explicitly denies (notFound, or
    // a fetch-failure generic deny) rather than silently fabricating a project or releasing
    // values.
    mockResolveProjectSelector = jest.fn().mockResolvedValue(null);
    mockListSecretsInProject = jest.fn().mockResolvedValue([]);
    mockGetSecretValuesByIds = jest
      .fn()
      .mockRejectedValue(new Error("no getSecretValuesByIds fixture configured"));
    // Cipher release events (M4c): default resolves so credential-release tests that don't care
    // about the event call don't have to configure it explicitly.
    mockCollect = jest.fn().mockResolvedValue(undefined);
    // Browser fill (M5): default to "no extension connected" so a stray fill/describe test that
    // doesn't configure these explicitly denies rather than silently fabricating a page
    // description or a successful fill.
    mockDescribeTarget = jest.fn().mockRejectedValue(new ExtensionUnavailableError());
    mockFill = jest.fn().mockRejectedValue(new ExtensionUnavailableError());
    mockGetCode = jest.fn().mockReturnValue(of({ code: "123456" }));
    // Grant store (W2b): default to "no grant yet" so a stray local-origin test that doesn't
    // configure these explicitly fails loudly (first-use dialog opens) rather than silently
    // short-circuiting through a fabricated grant.
    mockFindGrant = jest.fn().mockResolvedValue(null);
    mockUpsertGrant = jest.fn().mockImplementation(
      async (input: Record<string, unknown>) =>
        ({
          id: "grant-1",
          createdAt: 1_700_000_000,
          lastUsedAt: 1_700_000_000,
          ...input,
        }) as unknown,
    );

    (global as any).ipc = {
      agentAccess: {
        isLoaded: mockIsLoaded,
        init: mockInit,
        stop: mockStop,
        credentialRequestResponse: mockCredentialRequestResponse,
        fingerprintResponse: mockFingerprintResponse,
        findGrant: mockFindGrant,
        upsertGrant: mockUpsertGrant,
        clearActivity: mockClearActivity,
      },
      platform: { focusWindow: mockFocusWindow },
    };
  });

  afterEach(() => {
    service?.ngOnDestroy();
    jest.clearAllMocks();
  });

  describe("feature flag gating", () => {
    it("does not wire up any pipeline when the feature flag is disabled", async () => {
      service = buildService(false);
      await service.init();

      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
      await flush();

      expect(mockInit).not.toHaveBeenCalled();

      credentialRequestSubject.next({ requestId: 1, queryType: "id", queryValue: "c1" });
      await flush();

      expect(mockCredentialRequestResponse).not.toHaveBeenCalled();
    });
  });

  describe("start/stop", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
    });

    it("starts the server when enabled and an account is logged in", async () => {
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
      await flush();

      expect(mockInit).toHaveBeenCalledWith({ relayUrl: "wss://ap.lesspassword.dev" });
    });

    it("stops the server when the setting is disabled", async () => {
      mockIsLoaded.mockResolvedValue(true);
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
      await flush();

      mockStop.mockClear();
      agentAccessEnabledSubject.next(false);
      await flush();

      expect(mockStop).toHaveBeenCalled();
    });

    it("stops the server when all accounts log out", async () => {
      mockIsLoaded.mockResolvedValue(true);
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
      await flush();

      mockStop.mockClear();
      accountSubject.next(null);
      await flush();

      expect(mockStop).toHaveBeenCalled();
    });

    it("starts the server even while locked, so it can request unlock on demand", async () => {
      // authSubjectFor defaults to Locked — the agent must still come up so it can accept
      // connections and trigger the unlock-gate flow when a credential request arrives (BFU).
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      await flush();

      expect(mockInit).toHaveBeenCalledWith({ relayUrl: "wss://ap.lesspassword.dev" });
    });

    it("stops the server when the active account's auth status becomes LoggedOut", async () => {
      mockIsLoaded.mockResolvedValue(true);
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
      await flush();

      mockStop.mockClear();
      authSubjectFor("user-1").next(AuthenticationStatus.LoggedOut);
      await flush();

      expect(mockStop).toHaveBeenCalled();
    });
  });

  describe("credential request — deny when disabled", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
    });

    it("denies immediately without a dialog when the setting is disabled", async () => {
      agentAccessEnabledSubject.next(false);

      credentialRequestSubject.next({
        requestId: 7,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        7,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });
  });

  describe("credential request — unlock gate", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
    });

    it("prompts for unlock and focuses the window when locked", async () => {
      activeAccountStatusSubject.next(AuthenticationStatus.Locked);

      credentialRequestSubject.next({
        requestId: 1,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockFocusWindow).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "info" }));
    });

    it("denies the request and shows a timeout toast when unlock never happens", async () => {
      jest.useFakeTimers();
      try {
        activeAccountStatusSubject.next(AuthenticationStatus.Locked);
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
        }

        mockCredentialRequestResponse.mockClear();
        mockShowToast.mockClear();
        (service as any).AGENT_ACCESS_UNLOCK_REQUEST_TIMEOUT = 50;

        credentialRequestSubject.next({
          requestId: 42,
          queryType: "id",
          queryValue: "c1",
          requesterFingerprint: "fp",
        });

        // The enabled-gate step is an async concatMap, so the message needs a few microtask
        // ticks to reach the unlock-gate switchMap (and start the `timeout()` timer) before
        // advancing fake timers past it.
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }

        jest.advanceTimersByTime(100);
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }

        expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
          42,
          { approved: false, reason: "denied" },
          { status: "denied" },
        );
        expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
      } finally {
        jest.useRealTimers();
      }
    });

    it("does not reprocess an already-resolved request on a later, unrelated unlock (take(1) regression)", async () => {
      // Without `take(1)` on the unlock-wait filter, the inner subscription stays alive after
      // resolving once, so a *future* unlock (long after this request was answered) replays the
      // same message through authorize -> lookup -> approval and pops a second, phantom dialog.
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      activeAccountStatusSubject.next(AuthenticationStatus.Locked);
      credentialRequestSubject.next({
        requestId: 50,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
      });
      await flush();

      // Unlock: the waiting request proceeds and resolves exactly once.
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledTimes(1);
      expect(mockCredentialRequestResponse).toHaveBeenCalledTimes(1);

      mockDialogOpen.mockClear();
      mockCredentialRequestResponse.mockClear();

      // A later, unrelated lock/unlock cycle — with no new request in flight — must not replay
      // the old one or open a second approval dialog.
      activeAccountStatusSubject.next(AuthenticationStatus.Locked);
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).not.toHaveBeenCalled();
    });
  });

  describe("credential request — concurrent requests queue instead of being silently dropped", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
    });

    it("queues a second request behind the first's unlock wait instead of cancelling it", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen
        .mockReturnValueOnce({ closed: of({ approved: true, selectedId: "c1" }) }) // request A
        .mockReturnValueOnce({ closed: of({ approved: true, selectedId: "c1" }) }); // request B

      activeAccountStatusSubject.next(AuthenticationStatus.Locked);

      credentialRequestSubject.next({
        requestId: 60,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp-a",
      });
      await flush();

      credentialRequestSubject.next({
        requestId: 61,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp-b",
      });
      await flush();

      // Neither request has been resolved yet: both are queued behind the shared unlock wait —
      // a switchMap here would have unsubscribed request A's wait the moment B arrived, denying
      // neither but resolving neither either (silently dropped).
      expect(mockCredentialRequestResponse).not.toHaveBeenCalled();

      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      await flush();
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledTimes(2);
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        60,
        expect.objectContaining({ approved: true }),
        expect.objectContaining({ status: "shared" }),
      );
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        61,
        expect.objectContaining({ approved: true }),
        expect.objectContaining({ status: "shared" }),
      );
    });

    it("still denies a rejected request without dropping the next queued one (error/cancel path denies)", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen
        .mockReturnValueOnce({ closed: of({ approved: false }) }) // request A: user denies
        .mockReturnValueOnce({ closed: of({ approved: true, selectedId: "c1" }) }); // request B: approved

      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);

      credentialRequestSubject.next({
        requestId: 70,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp-a",
      });
      await flush();

      credentialRequestSubject.next({
        requestId: 71,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp-b",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        70,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        71,
        expect.objectContaining({ approved: true }),
        expect.objectContaining({ status: "shared" }),
      );
    });
  });

  describe("credential request — lookup mapping", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("denies with reason notFound without opening a dialog when no cipher matches", async () => {
      mockGetAllDecrypted.mockResolvedValue([]);

      credentialRequestSubject.next({
        requestId: 10,
        queryType: "id",
        queryValue: "missing",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      // Protocol reason is camelCase ("notFound", per the napi contract); the activity status
      // keeps its own snake_case member ("not_found") — they are distinct vocabularies.
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        10,
        { approved: false, reason: "notFound" },
        { status: "not_found" },
      );
    });

    it("denies with the generic reason (not not_found) when the lookup itself throws, distinct from a clean no-match", async () => {
      // A lookup failure (e.g. the vault throws) is a genuine error, not a clean "nothing
      // matched" — it must not be indistinguishable from the no-match case above.
      mockGetAllDecrypted.mockRejectedValue(new Error("vault lookup boom"));

      credentialRequestSubject.next({
        requestId: 19,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        19,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("opens the approval dialog and responds with the mapped credential when approved", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next({
        requestId: 11,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
        requesterName: "Test Agent",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        11,
        {
          approved: true,
          username: "user@example.com",
          password: "hunter2",
          totp: undefined,
          uri: "https://example.com",
          credentialId: "c1",
        },
        // Activity annotation: names the item and the fields actually present in the payload
        // above, so the log reports exactly what was released.
        {
          status: "shared",
          cipherId: "c1",
          fieldsShared: ["username", "password", "uri"],
        },
      );
    });

    it("never includes notes in the released payload, even when the cipher has them", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      (cipher as unknown as { notes: string }).notes = "unrelated secret recovery codes";
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next({
        requestId: 15,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
      });
      await flush();

      const [, response] = mockCredentialRequestResponse.mock.calls[0];
      expect(response).not.toHaveProperty("notes");
    });

    it("denies when the user rejects the approval dialog", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 12,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        12,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("matches by domain via getAllDecryptedForUrl", async () => {
      const cipher = makeLoginCipher("c2", "Example");
      mockGetAllDecryptedForUrl.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c2" }) });

      credentialRequestSubject.next({
        requestId: 13,
        queryType: "domain",
        queryValue: "example.com",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockGetAllDecryptedForUrl).toHaveBeenCalledWith("https://example.com", "user-1");
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        13,
        expect.objectContaining({ approved: true, credentialId: "c2" }),
        expect.objectContaining({ status: "shared" }),
      );
    });

    it("matches by search, preferring an exact name match", async () => {
      const exact = makeLoginCipher("c-exact", "Bank");
      const partial = makeLoginCipher("c-partial", "Bank of Example");
      mockGetAllDecrypted.mockResolvedValue([partial, exact]);
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, selectedId: "c-exact" }),
      });

      credentialRequestSubject.next({
        requestId: 14,
        queryType: "search",
        queryValue: "bank",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        14,
        expect.objectContaining({ credentialId: "c-exact" }),
        expect.objectContaining({ status: "shared" }),
      );
    });

    it("passes every match to the approval dialog, exact matches first and de-duplicated", async () => {
      const exact = makeLoginCipher("c-exact", "Bank");
      const partial = makeLoginCipher("c-partial", "Bank of Example");
      const other = makeLoginCipher("c-other", "Something else");
      mockGetAllDecrypted.mockResolvedValue([partial, exact, exact, other]);
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, selectedId: "c-exact" }),
      });

      credentialRequestSubject.next({
        requestId: 16,
        queryType: "search",
        queryValue: "bank",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            matches: [
              expect.objectContaining({ cipherId: "c-exact" }),
              expect.objectContaining({ cipherId: "c-partial" }),
            ],
          }),
        }),
      );
    });

    // `matchesTruncated` (agent-access-design-spec.md §3.3): the dialog used to guess truncation
    // from `matches.length` landing exactly on `MAX_CREDENTIAL_MATCHES`, which was wrong for a
    // request with exactly that many genuine matches and nothing cut off. `findCiphers` now knows
    // the true pre-cap count for both query shapes that can truncate (Domain and Search) and
    // reports it precisely — these two pairs (one per query shape) prove the exactly-at-cap case
    // reports `false` and a genuinely-over-cap case reports `true`, using the same 20-match cap
    // the service applies (`MAX_CREDENTIAL_MATCHES`, not exported — mirrored here as a literal,
    // same as the dialog component used to mirror it before this fix).
    describe("matchesTruncated — reports whether the cap actually cut off matches", () => {
      it("domain query: reports false when the match count lands exactly on the cap", async () => {
        const ciphers = Array.from({ length: 20 }, (_, i) => makeLoginCipher(`c${i}`, `Item ${i}`));
        mockGetAllDecryptedForUrl.mockResolvedValue(ciphers);
        mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c0" }) });

        credentialRequestSubject.next({
          requestId: 200,
          queryType: "domain",
          queryValue: "example.com",
          requesterFingerprint: "fp",
        });
        await flush();

        expect(mockDialogOpen).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({ matchesTruncated: false }),
          }),
        );
        const [, { data }] = mockDialogOpen.mock.calls[0];
        expect((data.matches as unknown[]).length).toBe(20);
      });

      it("domain query: reports true when more than the cap actually matched", async () => {
        const ciphers = Array.from({ length: 21 }, (_, i) => makeLoginCipher(`c${i}`, `Item ${i}`));
        mockGetAllDecryptedForUrl.mockResolvedValue(ciphers);
        mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c0" }) });

        credentialRequestSubject.next({
          requestId: 201,
          queryType: "domain",
          queryValue: "example.com",
          requesterFingerprint: "fp",
        });
        await flush();

        expect(mockDialogOpen).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({ matchesTruncated: true }),
          }),
        );
        // The cap itself is unaffected by the fix — still exactly 20 shown, one truncated flag
        // added on top.
        const [, { data }] = mockDialogOpen.mock.calls[0];
        expect((data.matches as unknown[]).length).toBe(20);
      });

      it("search query: reports false when the match count lands exactly on the cap", async () => {
        const ciphers = Array.from({ length: 20 }, (_, i) => makeLoginCipher(`c${i}`, `bank ${i}`));
        mockGetAllDecrypted.mockResolvedValue(ciphers);
        mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c0" }) });

        credentialRequestSubject.next({
          requestId: 202,
          queryType: "search",
          queryValue: "bank",
          requesterFingerprint: "fp",
        });
        await flush();

        expect(mockDialogOpen).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({ matchesTruncated: false }),
          }),
        );
      });

      it("search query: reports true when a substring match exists beyond the cap", async () => {
        // 20 exact "bank" matches fill the cap on the first pass; one further cipher only matches
        // the substring pass and would previously never have been considered at all once the cap
        // was hit — it must still be able to flip `truncated` even though it's never added to
        // `matches`.
        const exact = Array.from({ length: 20 }, (_, i) => makeLoginCipher(`c${i}`, "bank"));
        const overflowSubstringOnly = makeLoginCipher("c-overflow", "Bank of Example");
        mockGetAllDecrypted.mockResolvedValue([...exact, overflowSubstringOnly]);
        mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c0" }) });

        credentialRequestSubject.next({
          requestId: 203,
          queryType: "search",
          queryValue: "bank",
          requesterFingerprint: "fp",
        });
        await flush();

        expect(mockDialogOpen).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({ matchesTruncated: true }),
          }),
        );
        const [, { data }] = mockDialogOpen.mock.calls[0];
        expect((data.matches as unknown[]).length).toBe(20);
        expect(
          (data.matches as { cipherId: string }[]).some((m) => m.cipherId === "c-overflow"),
        ).toBe(false);
      });
    });

    it("releases only the selected candidate's payload when several matches are shown", async () => {
      const first = makeLoginCipher("c-first", "GitHub", { password: "first-password" });
      const second = makeLoginCipher("c-second", "GitHub", { password: "second-password" });
      mockGetAllDecrypted.mockResolvedValue([first, second]);
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, selectedId: "c-second" }),
      });

      credentialRequestSubject.next({
        requestId: 17,
        queryType: "search",
        queryValue: "github",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledTimes(1);
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        17,
        expect.objectContaining({ credentialId: "c-second", password: "second-password" }),
        expect.objectContaining({ status: "shared" }),
      );
    });

    it("denies when the dialog closes with approved but without a selected cipher id", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 18,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        18,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });
  });

  // Delivery-mode field reporting: the approval dialog's per-match "fields shared" flags and the
  // activity log's `fieldsShared` annotation must both reflect exactly what
  // `build_approved_credential` (local_protocol.rs) actually puts on the wire for the request's
  // delivery mode — reference mode releases `item.username` only, never
  // password/totp/uri. Every other mode, including an absent one (relay-origin requests carry no
  // deliveryMode at all) or an unrecognized one, must report the full field list: under-reporting
  // a real disclosure in the audit log is a worse failure than over-reporting.
  describe("credential request — delivery mode field reporting", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("reference mode: the dialog and the activity log report username only, never password/totp/uri", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next({
        requestId: 20,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
        deliveryMode: "reference",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryMode: "reference",
            matches: [
              expect.objectContaining({
                cipherId: "c1",
                fieldsShared: { username: true, password: false, totp: false, uri: false },
              }),
            ],
          }),
        }),
      );

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        20,
        expect.objectContaining({ approved: true, credentialId: "c1" }),
        {
          status: "shared",
          cipherId: "c1",
          fieldsShared: ["username"],
        },
      );
    });

    it("inject mode: the dialog and the activity log report every present field", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next({
        requestId: 21,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
        deliveryMode: "inject",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryMode: "inject",
            matches: [
              expect.objectContaining({
                cipherId: "c1",
                fieldsShared: { username: true, password: true, totp: false, uri: true },
              }),
            ],
          }),
        }),
      );

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        21,
        expect.objectContaining({ approved: true, credentialId: "c1" }),
        {
          status: "shared",
          cipherId: "c1",
          fieldsShared: ["username", "password", "uri"],
        },
      );
    });

    it("undefined delivery mode (a relay-origin request) still reports every present field — the audit trail must never silently under-report", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next({
        requestId: 22,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
        // No deliveryMode key at all — a relay-origin request never carries one.
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryMode: undefined,
            matches: [
              expect.objectContaining({
                cipherId: "c1",
                fieldsShared: { username: true, password: true, totp: false, uri: true },
              }),
            ],
          }),
        }),
      );

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        22,
        expect.objectContaining({ approved: true, credentialId: "c1" }),
        {
          status: "shared",
          cipherId: "c1",
          fieldsShared: ["username", "password", "uri"],
        },
      );
    });

    it("an unrecognized delivery mode falls through to the full field list, never the restrictive reference-only one", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next({
        requestId: 23,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
        deliveryMode: "bogus",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        23,
        expect.objectContaining({ approved: true, credentialId: "c1" }),
        {
          status: "shared",
          cipherId: "c1",
          fieldsShared: ["username", "password", "uri"],
        },
      );
    });
  });

  // M4c (agent-access-architecture.md, "M4c — server-side event logs"): an approved org-vault
  // cipher release calls EventCollectionService.collect at the release site, no caller-side
  // org/UseEvents checks (the service's own gating drops personal-vault ciphers and non-UseEvents
  // orgs). Secrets Manager releases/creates emit nothing via collect — covered in their own
  // describe blocks below.
  describe("credential request — cipher release events (M4c)", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("collects Cipher_ClientSharedWithAgent (1133) with the cipher id and uploadImmediately: true when the released payload includes a password", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next({
        requestId: 200,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockCollect).toHaveBeenCalledWith(1133, "c1", true);
    });

    it("collects Cipher_ClientSharedWithAgent (1133) when the released payload has no password (reference-mode/no-password release)", async () => {
      const cipher = makeLoginCipher("c1", "My Login", { password: null });
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next({
        requestId: 201,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockCollect).toHaveBeenCalledWith(1133, "c1", true);
    });

    it("does not call collect at all when the request is denied", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 202,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
      });
      await flush();

      expect(mockCollect).not.toHaveBeenCalled();
    });

    it("a collect failure does not turn an approved release into a failed one", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });
      mockCollect.mockRejectedValue(new Error("event upload boom"));

      credentialRequestSubject.next({
        requestId: 203,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
      });
      await flush();

      // The release itself still succeeded — a collect error is swallowed, never surfaced as a
      // denial or a second (failure) response.
      expect(mockCredentialRequestResponse).toHaveBeenCalledTimes(1);
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        203,
        expect.objectContaining({ approved: true, credentialId: "c1" }),
        expect.objectContaining({ status: "shared" }),
      );
    });
  });

  describe("credential request — local origin: grant + first-use authorization", () => {
    const localPeer = {
      pid: 4242,
      processName: "aac",
      exePath: "/usr/local/bin/aac",
      parent: { pid: 1, processName: "Cursor", exePath: "/Applications/Cursor.app" },
      signature: { kind: "macosTeamId", identity: "TEAMID:com.anysphere.cursor", valid: true },
    };

    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("opens the first-use dialog when no grant exists, and denies without persisting or looking up ciphers when declined", async () => {
      mockDialogOpen.mockReturnValueOnce({ closed: of({ authorized: false }) });

      credentialRequestSubject.next({
        requestId: 30,
        queryType: "id",
        queryValue: "c1",
        origin: "local",
        localPeer,
      });
      await flush();

      expect(mockFindGrant).toHaveBeenCalledWith({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.anysphere.cursor",
      });
      expect(mockDialogOpen).toHaveBeenCalledTimes(1);
      expect(mockUpsertGrant).not.toHaveBeenCalled();
      // Nothing was written, so nothing to announce — an open Agent Access page must not re-read
      // the store (and briefly flip its list into a loading state) over a declined authorization.
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockGetAllDecrypted).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        30,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("persists a grant and proceeds to the (unmodified) approval dialog when authorized on first use", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen
        .mockReturnValueOnce({ closed: of({ authorized: true, scope: "allLogins" }) }) // first-use
        .mockReturnValueOnce({ closed: of({ approved: true, selectedId: "c1" }) }); // approval

      credentialRequestSubject.next({
        requestId: 31,
        queryType: "id",
        queryValue: "c1",
        origin: "local",
        localPeer,
      });
      await flush();

      expect(mockUpsertGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          signatureKind: "macosTeamId",
          signatureIdentity: "TEAMID:com.anysphere.cursor",
          displayName: "Cursor",
          exePath: "/Applications/Cursor.app",
          scope: "allLogins",
        }),
      );
      // Announced to the renderer's own listeners, so an Agent Access page that is already open
      // picks the new agent up instead of only showing it after being re-entered.
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: AGENT_ACCESS_IPC_CHANNELS.GRANTS_CHANGED }),
        {},
      );
      expect(mockDialogOpen).toHaveBeenCalledTimes(2);
      // The second dialog is the approval dialog; it should show the attested display name
      // rather than a fingerprint local requests don't have.
      expect(mockDialogOpen).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining({ requesterName: "Cursor" }) }),
      );
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        31,
        expect.objectContaining({ approved: true, credentialId: "c1" }),
        expect.objectContaining({ status: "shared" }),
      );
    });

    it("skips the first-use dialog and refreshes the grant when one already exists for this peer", async () => {
      mockFindGrant.mockResolvedValue({
        id: "grant-1",
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.anysphere.cursor",
        displayName: "Cursor",
        scope: "allLogins",
        createdAt: 1_699_000_000,
        lastUsedAt: 1_699_000_000,
      });
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next({
        requestId: 32,
        queryType: "id",
        queryValue: "c1",
        origin: "local",
        localPeer,
      });
      await flush();

      // Only the approval dialog opens — no first-use prompt for an already-granted peer.
      expect(mockDialogOpen).toHaveBeenCalledTimes(1);
      expect(mockUpsertGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          signatureKind: "macosTeamId",
          signatureIdentity: "TEAMID:com.anysphere.cursor",
          scope: "allLogins",
        }),
      );
      // Also announced for a plain `lastUsedAt` refresh — that's a column in the connected-agents
      // table, so an open page's copy is stale without it.
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: AGENT_ACCESS_IPC_CHANNELS.GRANTS_CHANGED }),
        {},
      );
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        32,
        expect.objectContaining({ approved: true, credentialId: "c1" }),
        expect.objectContaining({ status: "shared" }),
      );
    });
  });

  // agent-access-design-spec.md §7.5.2 — the reported scope regression: only the first-use dialog
  // received `signatureIdentity`/`signatureValid` from the attested `localPeer`, so a request
  // dialog never showed the requesting agent's brand logo. `localPeer` (and therefore its
  // signature) survives `authorizeLocalRequest`'s `{ ...message, requesterName: displayName }`
  // spread unchanged, so every downstream dialog call site can — and, per these tests, does —
  // read it straight off the message via `attestedSignatureLookup`.
  describe("credential request — attested signature plumbing for brand logo resolution (agent-access-design-spec.md §7.5.2)", () => {
    const claudeLocalPeer = {
      pid: 555,
      processName: "aac",
      exePath: "/usr/local/bin/aac",
      parent: { pid: 1, processName: "Claude Code", exePath: "/Applications/Claude.app" },
      signature: {
        kind: "macosTeamId",
        identity: "Q6L2SF6YDW:com.anthropic.claude-code",
        valid: true,
      },
    };

    const expectedSignatureFields = {
      signatureKind: "macosTeamId",
      signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
      signatureValid: true,
    };

    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
      // A grant already exists for this peer: skips the first-use dialog so `mockDialogOpen`'s
      // one call in each test below is unambiguously the request dialog under test.
      mockFindGrant.mockResolvedValue({
        id: "grant-1",
        signatureKind: "macosTeamId",
        signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
        displayName: "Claude Code",
        scope: "allLogins",
        createdAt: 1_700_000_000,
        lastUsedAt: 1_700_000_000,
      });
    });

    it("passes the attested signature to the credential approval dialog", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 400,
        queryType: "id",
        queryValue: "c1",
        origin: "local",
        localPeer: claudeLocalPeer,
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining(expectedSignatureFields) }),
      );
    });

    it("passes the attested signature to the Secrets Manager secret approval dialog", async () => {
      mockFindSecrets.mockResolvedValue({
        matches: [
          {
            secretId: "s1",
            name: "DB_PASSWORD",
            organizationId: "org-1",
            organizationName: "Acme Inc",
          },
        ],
        truncated: false,
      });
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 401,
        queryType: "id",
        queryValue: "s1",
        resourceType: "secret",
        origin: "local",
        localPeer: claudeLocalPeer,
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining(expectedSignatureFields) }),
      );
    });

    it("passes the attested signature to the create-secret dialog", async () => {
      mockSmOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme Inc", isAdmin: true }]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 402,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        newSecretValue: "hunter2",
        origin: "local",
        localPeer: claudeLocalPeer,
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining(expectedSignatureFields) }),
      );
    });

    it("passes the attested signature to the create-project dialog", async () => {
      mockSmOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme Inc" }]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 403,
        operation: "create",
        resourceType: "project",
        newSecretName: "my-app",
        origin: "local",
        localPeer: claudeLocalPeer,
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining(expectedSignatureFields) }),
      );
    });

    it("passes the attested signature to the rename-project dialog", async () => {
      mockSmOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme Inc" }]);
      mockListProjects.mockResolvedValue([{ id: "proj-1", name: "my-app", write: true }]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 404,
        operation: "update",
        resourceType: "project",
        targetId: "proj-1",
        newSecretName: "renamed-app",
        origin: "local",
        localPeer: claudeLocalPeer,
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining(expectedSignatureFields) }),
      );
    });

    it("passes the attested signature to the update-secret dialog", async () => {
      mockFindSecrets.mockResolvedValue({
        matches: [
          {
            secretId: "s-a",
            name: "DB_PASSWORD",
            organizationId: "org-1",
            organizationName: "Acme Inc",
          },
        ],
        truncated: false,
      });
      mockGetSecretForUpdate.mockResolvedValue({
        secretId: "s-a",
        organizationId: "org-1",
        nameDecrypted: "DB_PASSWORD",
        keyEncString: "key-ct",
        valueEncString: "value-ct",
        noteEncString: "note-ct",
        currentProjectId: "proj-current",
      });
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 405,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        newSecretName: "RENAMED",
        origin: "local",
        localPeer: claudeLocalPeer,
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining(expectedSignatureFields) }),
      );
    });

    it("passes the attested signature to the project-list dialog", async () => {
      mockSmOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme Inc" }]);
      mockListProjects.mockResolvedValue([{ id: "proj-1", name: "my-app", write: true }]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 406,
        operation: "list",
        resourceType: "project",
        origin: "local",
        localPeer: claudeLocalPeer,
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining(expectedSignatureFields) }),
      );
    });

    it("passes the attested signature to the project-secrets (bulk) dialog", async () => {
      mockResolveProjectSelector.mockResolvedValue({
        projectId: "proj-1",
        projectName: "my-app",
        organizationId: "org-1",
        organizationName: "Acme Inc",
      });
      mockListSecretsInProject.mockResolvedValue([
        { secretId: "s-db", name: "DB_PASSWORD", organizationId: "org-1" },
      ]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 407,
        operation: "bulkRequest",
        targetId: "proj-1",
        origin: "local",
        localPeer: claudeLocalPeer,
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining(expectedSignatureFields) }),
      );
    });

    it("passes the attested signature to the browser-fill dialog", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecryptedForUrl.mockResolvedValue([cipher]);
      mockDescribeTarget.mockResolvedValue(makeFillDescription());
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 408,
        queryType: "domain",
        queryValue: "example.com",
        deliveryMode: "fill",
        resourceType: "credential",
        origin: "local",
        localPeer: claudeLocalPeer,
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining(expectedSignatureFields) }),
      );
    });

    it("passes the attested signature to the confirm-delete dialog", async () => {
      mockFindSecrets.mockResolvedValue({
        matches: [
          {
            secretId: "s-a",
            name: "DB_PASSWORD",
            organizationId: "org-1",
            organizationName: "Acme Inc",
          },
        ],
        truncated: false,
      });
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 410,
        operation: "delete",
        resourceType: "secret",
        targetId: "s-a",
        origin: "local",
        localPeer: claudeLocalPeer,
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining(expectedSignatureFields) }),
      );
    });

    // SECURITY regression test: a relay-origin request has no OS-verified peer at all
    // (`localPeer` is never attached on that path — see `agent_access.CredentialRequestData
    // .localPeer`'s docs), so it must never carry attested signature fields to the dialog. A
    // relay-origin agent therefore has no way to claim a brand logo, no matter what
    // `requesterName` it self-reports — `requesterName` still reaches the dialog as a display
    // name, but never as a signature.
    it("never passes signature fields to the credential approval dialog for a relay-origin request, even with a requesterName claiming a known agent", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 409,
        queryType: "id",
        queryValue: "c1",
        origin: "relay",
        requesterName: "Claude Code",
        requesterFingerprint: "fp-1",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            requesterName: "Claude Code",
            signatureKind: undefined,
            signatureIdentity: undefined,
            signatureValid: undefined,
          }),
        }),
      );
    });
  });

  describe("credential request — relay origin never touches the grant path", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("never calls findGrant/upsertGrant, and the approval dialog behaves exactly as before", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecrypted.mockResolvedValue([cipher]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next({
        requestId: 33,
        queryType: "id",
        queryValue: "c1",
        requesterFingerprint: "fp",
        requesterName: "Test Agent",
        origin: "relay",
      });
      await flush();

      expect(mockFindGrant).not.toHaveBeenCalled();
      expect(mockUpsertGrant).not.toHaveBeenCalled();
      expect(mockDialogOpen).toHaveBeenCalledTimes(1);
      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining({ requesterName: "Test Agent" }) }),
      );
    });
  });

  // M4/M4c (agent-access-architecture.md): resourceType: "secret" requests branch to the Secrets
  // Manager lookup instead of the vault. Everything else in the pipeline (enable gate, unlock
  // gate, grant/first-use, deny paths) is shared and already covered above — these tests exercise
  // the branch point, the secret-specific release shape, and the M4c post-approval, single-secret
  // fetch invariant: a value is fetched at most once, only after approval, only for the selected
  // id — so that the server's per-fetch `Secret_Retrieved` audit event stays accurate.
  describe("credential request — resourceType: 'secret' routes to Secrets Manager", () => {
    const secretMatch: SmSecretMatch = {
      secretId: "s1",
      name: "DB_PASSWORD",
      organizationId: "org-1",
      organizationName: "Acme Inc",
    };
    const secretValue: SmSecretValue = {
      secretId: "s1",
      name: "DB_PASSWORD",
      value: "hunter2",
      organizationId: "org-1",
    };

    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("never calls the vault lookup for a secret request", async () => {
      mockFindSecrets.mockResolvedValue({ matches: [secretMatch], truncated: false });
      mockGetSecretValue.mockResolvedValue(secretValue);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "s1" }) });

      credentialRequestSubject.next({
        requestId: 80,
        queryType: "name",
        queryValue: "DB_PASSWORD",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      expect(mockGetAllDecrypted).not.toHaveBeenCalled();
      expect(mockGetAllDecryptedForUrl).not.toHaveBeenCalled();
      expect(mockFindSecrets).toHaveBeenCalledWith("name", "DB_PASSWORD", "user-1");
    });

    it("denies with reason notFound without opening a dialog when no secret matches", async () => {
      mockFindSecrets.mockResolvedValue({ matches: [], truncated: false });

      credentialRequestSubject.next({
        requestId: 81,
        queryType: "name",
        queryValue: "MISSING",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockGetSecretValue).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        81,
        { approved: false, reason: "notFound" },
        { status: "not_found" },
      );
    });

    it("never fetches a value before or during dialog open — a match alone must not trigger a retrieval", async () => {
      mockFindSecrets.mockResolvedValue({ matches: [secretMatch], truncated: false });
      mockGetSecretValue.mockResolvedValue(secretValue);
      mockDialogOpen.mockImplementation(() => {
        // If the dialog opening triggered a fetch, that would write a Secret_Retrieved event for
        // a secret the user hasn't approved yet — exactly what M4c forbids.
        expect(mockGetSecretValue).not.toHaveBeenCalled();
        return { closed: of({ approved: true, selectedId: "s1" }) };
      });

      credentialRequestSubject.next({
        requestId: 82,
        queryType: "name",
        queryValue: "DB_PASSWORD",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      // The fetch does still happen — just after approval, verified below.
      expect(mockGetSecretValue).toHaveBeenCalledTimes(1);
    });

    it("calls getSecretValue exactly once, only after approval, only with the selected secret's id and org", async () => {
      const other: SmSecretMatch = {
        secretId: "s2",
        name: "API_KEY",
        organizationId: "org-2",
        organizationName: "Other Org",
      };
      mockFindSecrets.mockResolvedValue({ matches: [secretMatch, other], truncated: false });
      mockGetSecretValue.mockResolvedValue(secretValue);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "s1" }) });

      credentialRequestSubject.next({
        requestId: 83,
        queryType: "search",
        queryValue: "db",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      // Only the selected match's id/org — never the other candidate that was merely shown.
      expect(mockGetSecretValue).toHaveBeenCalledTimes(1);
      expect(mockGetSecretValue).toHaveBeenCalledWith("s1", "org-1", "user-1");
    });

    it("releases the freshly-fetched secret payload and records secretId + fieldsShared: ['value'] on approval", async () => {
      mockFindSecrets.mockResolvedValue({ matches: [secretMatch], truncated: false });
      mockGetSecretValue.mockResolvedValue(secretValue);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "s1" }) });

      credentialRequestSubject.next({
        requestId: 84,
        queryType: "name",
        queryValue: "DB_PASSWORD",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      // Release payload shape is unchanged from the pre-M4c pre-built version.
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        84,
        {
          approved: true,
          secretValue: "hunter2",
          secretId: "s1",
          itemName: "DB_PASSWORD",
        },
        {
          status: "shared",
          secretId: "s1",
          fieldsShared: ["value"],
        },
      );
    });

    it("shows the secret's name and organization to the approval dialog, with no value on the match", async () => {
      mockFindSecrets.mockResolvedValue({ matches: [secretMatch], truncated: false });
      mockGetSecretValue.mockResolvedValue(secretValue);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "s1" }) });

      credentialRequestSubject.next({
        requestId: 85,
        queryType: "name",
        queryValue: "DB_PASSWORD",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            matches: [
              {
                kind: "secret",
                secretId: "s1",
                secretName: "DB_PASSWORD",
                organizationName: "Acme Inc",
              },
            ],
          }),
        }),
      );
    });

    it("denies when the user rejects the secret approval dialog, without ever fetching a value", async () => {
      mockFindSecrets.mockResolvedValue({ matches: [secretMatch], truncated: false });
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 86,
        queryType: "name",
        queryValue: "DB_PASSWORD",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      expect(mockGetSecretValue).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        86,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("denies with a generic reason and shows an error toast when the post-approval fetch fails", async () => {
      mockFindSecrets.mockResolvedValue({ matches: [secretMatch], truncated: false });
      mockGetSecretValue.mockRejectedValue(new Error("network boom"));
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "s1" }) });

      credentialRequestSubject.next({
        requestId: 87,
        queryType: "name",
        queryValue: "DB_PASSWORD",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        87,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    });

    it("never calls collect for a secret release — server-authored events, not client-collected", async () => {
      mockFindSecrets.mockResolvedValue({ matches: [secretMatch], truncated: false });
      mockGetSecretValue.mockResolvedValue(secretValue);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "s1" }) });

      credentialRequestSubject.next({
        requestId: 88,
        queryType: "name",
        queryValue: "DB_PASSWORD",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      expect(mockCollect).not.toHaveBeenCalled();
    });

    // BUG 1 fix (agent-access-architecture.md / agent-access-design-spec.md §3.3): SM enforces
    // secret-name uniqueness per project, not per org, so `findSecrets` can legitimately surface
    // two secrets sharing both name and organization. These tests confirm
    // `DesktopAgentAccessService` plumbs `projectId`/`projectName` from `SmSecretMatch` through
    // `SecretCandidate` to the dialog's `SecretMatch`, unchanged, rather than dropping them.
    it("carries a matched secret's project through to the approval dialog", async () => {
      const withProject: SmSecretMatch = {
        ...secretMatch,
        projectId: "proj-1",
        projectName: "web-app",
      };
      mockFindSecrets.mockResolvedValue({ matches: [withProject], truncated: false });
      mockGetSecretValue.mockResolvedValue(secretValue);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "s1" }) });

      credentialRequestSubject.next({
        requestId: 89,
        queryType: "name",
        queryValue: "DB_PASSWORD",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            matches: [
              expect.objectContaining({
                kind: "secret",
                secretId: "s1",
                projectId: "proj-1",
                projectName: "web-app",
              }),
            ],
          }),
        }),
      );
    });

    // `matchesTruncated` on the secret path (agent-access-design-spec.md §3.3): `lookupSecret`
    // now passes `AgentAccessSecretsService.findSecrets`'s `truncated` straight through rather
    // than guessing from `matches.length` landing on the cap — `findSecrets` (mocked here via
    // `mockFindSecrets`) is itself exact, since `matchSecrets` sees the full, uncapped candidate
    // list before applying `MAX_SM_MATCHES` (see the real cap-detection tests in
    // `agent-access-secrets.service.spec.ts`'s `describe("truncated"...)`). This test is the
    // regression test for the old length-based heuristic: exactly `MAX_SM_MATCHES` matches used to
    // report `matchesTruncated: true` unconditionally here, even when `findSecrets` itself knew
    // nothing was cut off — this proves the dialog now reports exactly what the lookup says,
    // not a guess.
    it("passes matchesTruncated straight through from the lookup — exactly at the cap but not truncated", async () => {
      const matches: SmSecretMatch[] = Array.from({ length: 20 }, (_, i) => ({
        secretId: `s${i}`,
        name: `SECRET_${i}`,
        organizationId: "org-1",
        organizationName: "Acme Inc",
      }));
      mockFindSecrets.mockResolvedValue({ matches, truncated: false });
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "s0" }) });

      credentialRequestSubject.next({
        requestId: 90,
        queryType: "search",
        queryValue: "secret",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ matchesTruncated: false }),
        }),
      );
    });

    it("passes matchesTruncated straight through from the lookup — genuinely truncated", async () => {
      const matches: SmSecretMatch[] = Array.from({ length: 20 }, (_, i) => ({
        secretId: `s${i}`,
        name: `SECRET_${i}`,
        organizationId: "org-1",
        organizationName: "Acme Inc",
      }));
      mockFindSecrets.mockResolvedValue({ matches, truncated: true });
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "s0" }) });

      credentialRequestSubject.next({
        requestId: 92,
        queryType: "search",
        queryValue: "secret",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ matchesTruncated: true }),
        }),
      );
    });

    it("reports matchesTruncated: false when the secret match count is below the cap", async () => {
      mockFindSecrets.mockResolvedValue({ matches: [secretMatch], truncated: false });
      mockGetSecretValue.mockResolvedValue(secretValue);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "s1" }) });

      credentialRequestSubject.next({
        requestId: 91,
        queryType: "name",
        queryValue: "DB_PASSWORD",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ matchesTruncated: false }),
        }),
      );
    });

    it("shows two same-named, same-org secrets to the dialog with their distinct project names, so the picker can disambiguate", async () => {
      const web: SmSecretMatch = {
        secretId: "s1",
        name: "API_KEY",
        organizationId: "org-1",
        organizationName: "Acme Inc",
        projectId: "proj-web",
        projectName: "web-app",
      };
      const mobile: SmSecretMatch = {
        secretId: "s2",
        name: "API_KEY",
        organizationId: "org-1",
        organizationName: "Acme Inc",
        projectId: "proj-mobile",
        projectName: "mobile-app",
      };
      mockFindSecrets.mockResolvedValue({ matches: [web, mobile], truncated: false });
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 90,
        queryType: "search",
        queryValue: "api",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            matches: [
              expect.objectContaining({
                kind: "secret",
                secretId: "s1",
                secretName: "API_KEY",
                organizationName: "Acme Inc",
                projectName: "web-app",
              }),
              expect.objectContaining({
                kind: "secret",
                secretId: "s2",
                secretName: "API_KEY",
                organizationName: "Acme Inc",
                projectName: "mobile-app",
              }),
            ],
          }),
        }),
      );
    });

    it("leaves projectId/projectName absent on the dialog match for a secret with no project", async () => {
      // `secretMatch` (the describe block's default fixture) carries no projectId/projectName —
      // this asserts the field stays absent end-to-end rather than being coerced to some sentinel.
      mockFindSecrets.mockResolvedValue({ matches: [secretMatch], truncated: false });
      mockGetSecretValue.mockResolvedValue(secretValue);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "s1" }) });

      credentialRequestSubject.next({
        requestId: 91,
        queryType: "name",
        queryValue: "DB_PASSWORD",
        requesterFingerprint: "fp",
        resourceType: "secret",
      });
      await flush();

      const [, openArgs] = mockDialogOpen.mock.calls[0];
      const [match] = (openArgs.data as { matches: Array<Record<string, unknown>> }).matches;
      expect(match.projectId).toBeUndefined();
      expect(match.projectName).toBeUndefined();
    });
  });

  // M4b (agent-access-architecture.md, "M4b — secret creation"): operation: "create" requests
  // branch to `handleCreateRequest` instead of the lookup path. Everything above the branch
  // point (enable gate, unlock gate, grant/first-use) is shared and already covered above.
  describe("credential request — operation: 'create' routes to secret creation", () => {
    const org = { id: "org-1", name: "Acme Inc", isAdmin: false } as any;

    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("never calls the vault or Secrets Manager lookup for a create request", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1", projectId: "proj-1" }),
      });

      credentialRequestSubject.next({
        requestId: 90,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        newSecretValue: "hunter2",
      });
      await flush();

      expect(mockGetAllDecrypted).not.toHaveBeenCalled();
      expect(mockGetAllDecryptedForUrl).not.toHaveBeenCalled();
      expect(mockFindSecrets).not.toHaveBeenCalled();
    });

    it("denies without opening a dialog when the account has no Secrets Manager access", async () => {
      mockSmOrganizations.mockResolvedValue([]);

      credentialRequestSubject.next({
        requestId: 91,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        newSecretValue: "hunter2",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        91,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    });

    it("opens the creation dialog with the requester identity and the proposed secret fields", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1", projectId: "proj-1" }),
      });

      credentialRequestSubject.next({
        requestId: 92,
        operation: "create",
        resourceType: "secret",
        requesterName: "Cursor",
        requesterFingerprint: "fp-1",
        newSecretName: "DB_PASSWORD",
        newSecretValue: "hunter2",
        newSecretNote: "prod db",
        projectHint: "my-app",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            requesterName: "Cursor",
            requesterFingerprint: "fp-1",
            secretName: "DB_PASSWORD",
            secretValue: "hunter2",
            secretNote: "prod db",
            projectHint: "my-app",
            organizations: [org],
          }),
        }),
      );
    });

    it("creates the secret directly in the selected existing project on approval", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1", projectId: "proj-1" }),
      });

      credentialRequestSubject.next({
        requestId: 93,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        newSecretValue: "hunter2",
        newSecretNote: "prod db",
      });
      await flush();

      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockCreateSecret).toHaveBeenCalledWith("org-1", "user-1", "proj-1", {
        name: "DB_PASSWORD",
        value: "hunter2",
        note: "prod db",
      });
    });

    it("creates a new project first, then the secret in it, when the dialog proposes a new project", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockCreateProject.mockResolvedValue({ id: "proj-brand-new", name: "brand-new" });
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1", newProjectName: "brand-new" }),
      });

      credentialRequestSubject.next({
        requestId: 94,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        newSecretValue: "hunter2",
      });
      await flush();

      expect(mockCreateProject).toHaveBeenCalledWith("org-1", "user-1", "brand-new");
      expect(mockCreateSecret).toHaveBeenCalledWith(
        "org-1",
        "user-1",
        "proj-brand-new",
        expect.objectContaining({ name: "DB_PASSWORD", value: "hunter2" }),
      );
    });

    it("creates a project-less secret when the dialog approves without a project (admin relaxation)", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1" }),
      });

      credentialRequestSubject.next({
        requestId: 95,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        newSecretValue: "hunter2",
      });
      await flush();

      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockCreateSecret).toHaveBeenCalledWith(
        "org-1",
        "user-1",
        null,
        expect.objectContaining({ name: "DB_PASSWORD", value: "hunter2" }),
      );
    });

    it("responds with status: created, the new secretId, and operation: create on success", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockCreateSecret.mockResolvedValue("secret-created-1");
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1", projectId: "proj-1" }),
      });

      credentialRequestSubject.next({
        requestId: 96,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        newSecretValue: "hunter2",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        96,
        { approved: true, secretId: "secret-created-1", itemName: "DB_PASSWORD" },
        { status: "created", secretId: "secret-created-1", operation: "create" },
      );
    });

    // M4c (agent-access-architecture.md): Secret_Created is already written and attributed
    // server-side — the client must never call collect for a secret creation.
    it("never calls collect for a secret creation — server-authored events, not client-collected", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockCreateSecret.mockResolvedValue("secret-created-1");
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1", projectId: "proj-1" }),
      });

      credentialRequestSubject.next({
        requestId: 101,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        newSecretValue: "hunter2",
      });
      await flush();

      expect(mockCollect).not.toHaveBeenCalled();
    });

    it("denies when the user rejects the creation dialog, without calling createSecret", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 97,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        newSecretValue: "hunter2",
      });
      await flush();

      expect(mockCreateSecret).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        97,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("denies with a generic reason and shows an error toast when the API call fails after approval", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockCreateSecret.mockRejectedValue(new Error("server error"));
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1", projectId: "proj-1" }),
      });

      credentialRequestSubject.next({
        requestId: 98,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        newSecretValue: "hunter2",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        98,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    });

    it("remembers the last chosen organization and project for the next create request in the session", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1", projectId: "proj-1" }),
      });

      credentialRequestSubject.next({
        requestId: 99,
        operation: "create",
        resourceType: "secret",
        newSecretName: "FIRST_SECRET",
        newSecretValue: "v1",
      });
      await flush();

      credentialRequestSubject.next({
        requestId: 100,
        operation: "create",
        resourceType: "secret",
        newSecretName: "SECOND_SECRET",
        newSecretValue: "v2",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            lastOrganizationId: "org-1",
            lastProjectId: "proj-1",
          }),
        }),
      );
    });
  });

  // M6 (agent-access-architecture.md, "M6 — Full Secrets Manager surface"): `generate: true`
  // extension of the create branch — the value is generated inside the handler at approval time
  // and never appears anywhere but the create call.
  describe("credential request — operation: 'create' with generateValue: true", () => {
    const org = { id: "org-1", name: "Acme Inc", isAdmin: false } as any;

    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("does not deny for a missing value when generateValue is true", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1", projectId: "proj-1" }),
      });

      credentialRequestSubject.next({
        requestId: 200,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        generateValue: true,
        generateLength: 64,
        generateSymbols: false,
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            secretValue: undefined,
            generated: { length: 64, symbols: false },
          }),
        }),
      );
    });

    it("generates the value at approval time and passes it (never the request) to createSecret", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockGenerateSecretValue.mockResolvedValue("generated-strong-value");
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1", projectId: "proj-1" }),
      });

      credentialRequestSubject.next({
        requestId: 201,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        generateValue: true,
        generateLength: 64,
        generateSymbols: false,
      });
      await flush();

      expect(mockGenerateSecretValue).toHaveBeenCalledWith({ length: 64, symbols: false });
      expect(mockCreateSecret).toHaveBeenCalledWith("org-1", "user-1", "proj-1", {
        name: "DB_PASSWORD",
        value: "generated-strong-value",
        note: undefined,
      });
    });

    it("never puts the generated value in the response sent to main, nor in any outcome", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockGenerateSecretValue.mockResolvedValue("generated-strong-value");
      mockCreateSecret.mockResolvedValue("secret-generated-1");
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1", projectId: "proj-1" }),
      });

      credentialRequestSubject.next({
        requestId: 202,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        generateValue: true,
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        202,
        { approved: true, secretId: "secret-generated-1", itemName: "DB_PASSWORD" },
        { status: "created", secretId: "secret-generated-1", operation: "create" },
      );
      const [, response, outcome] = mockCredentialRequestResponse.mock.calls[0];
      expect(JSON.stringify(response)).not.toContain("generated-strong-value");
      expect(JSON.stringify(outcome)).not.toContain("generated-strong-value");
    });

    it("does not generate a value at all when the dialog is denied", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 203,
        operation: "create",
        resourceType: "secret",
        newSecretName: "DB_PASSWORD",
        generateValue: true,
      });
      await flush();

      expect(mockGenerateSecretValue).not.toHaveBeenCalled();
      expect(mockCreateSecret).not.toHaveBeenCalled();
    });
  });

  // M6: `projectCreate` (resourceType: "project", operation: "create") — sibling of secret
  // creation, no lookup, own dialog/lifecycle.
  describe("credential request — resourceType: 'project', operation: 'create'", () => {
    const org = { id: "org-1", name: "Acme Inc" } as any;

    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("denies without opening a dialog when there is no SM access", async () => {
      mockSmOrganizations.mockResolvedValue([]);

      credentialRequestSubject.next({
        requestId: 210,
        operation: "create",
        resourceType: "project",
        newSecretName: "my-app",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        210,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("creates the project and responds with status: created, projectId, operation: create", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockCreateProject.mockResolvedValue({ id: "proj-new-1", name: "my-app" });
      mockDialogOpen.mockReturnValue({
        closed: of({ approved: true, organizationId: "org-1" }),
      });

      credentialRequestSubject.next({
        requestId: 211,
        operation: "create",
        resourceType: "project",
        newSecretName: "my-app",
      });
      await flush();

      expect(mockCreateProject).toHaveBeenCalledWith("org-1", "user-1", "my-app");
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        211,
        { approved: true, projectId: "proj-new-1", itemName: "my-app" },
        { status: "created", projectId: "proj-new-1", operation: "create" },
      );
    });

    it("denies when the user rejects the dialog", async () => {
      mockSmOrganizations.mockResolvedValue([org]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 212,
        operation: "create",
        resourceType: "project",
        newSecretName: "my-app",
      });
      await flush();

      expect(mockCreateProject).not.toHaveBeenCalled();
    });
  });

  // M6: `secretUpdate` — locates the secret's org, fetches ciphertexts, builds a from -> to
  // changes summary, and on approval sends a passthrough PUT.
  describe("credential request — operation: 'update', resourceType: 'secret'", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    function stubFoundSecret() {
      mockFindSecrets.mockResolvedValue({
        matches: [
          {
            secretId: "s-a",
            name: "DB_PASSWORD",
            organizationId: "org-1",
            organizationName: "Acme Inc",
          },
        ],
        truncated: false,
      });
      mockGetSecretForUpdate.mockResolvedValue({
        secretId: "s-a",
        organizationId: "org-1",
        nameDecrypted: "DB_PASSWORD",
        keyEncString: "key-ct",
        valueEncString: "value-ct",
        noteEncString: "note-ct",
        currentProjectId: "proj-current",
      });
    }

    it("denies with reason notFound without opening a dialog when the target secret can't be located", async () => {
      mockFindSecrets.mockResolvedValue({ matches: [], truncated: false });

      credentialRequestSubject.next({
        requestId: 220,
        operation: "update",
        resourceType: "secret",
        targetId: "s-missing",
        newSecretName: "RENAMED",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        220,
        { approved: false, reason: "notFound" },
        { status: "not_found" },
      );
    });

    it("opens the update dialog with a name change summary and approves with a passthrough update", async () => {
      stubFoundSecret();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 221,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        newSecretName: "RENAMED",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            secretName: "DB_PASSWORD",
            changes: { name: { from: "DB_PASSWORD", to: "RENAMED" } },
          }),
        }),
      );
      expect(mockUpdateSecret).toHaveBeenCalledWith("org-1", "user-1", "s-a", {
        keyEncString: "key-ct",
        name: "RENAMED",
        valueEncString: "value-ct",
        value: undefined,
        noteEncString: "note-ct",
        note: undefined,
        projectId: undefined,
        currentProjectId: "proj-current",
      });
    });

    it("passes projectId: undefined (ciphertext passthrough) when only the name changed — never decrypts the value", async () => {
      stubFoundSecret();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 222,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        newSecretName: "RENAMED",
      });
      await flush();

      const [, , , update] = mockUpdateSecret.mock.calls[0];
      expect(update.value).toBeUndefined();
      expect(update.valueEncString).toBe("value-ct");
      expect(update.projectId).toBeUndefined();
    });

    it("resolves an agent-supplied value as changes.value: 'agent' and forwards the plaintext to updateSecret", async () => {
      stubFoundSecret();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 223,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        newSecretValue: "new-hunter3",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining({ changes: { value: "agent" } }) }),
      );
      expect(mockUpdateSecret).toHaveBeenCalledWith(
        "org-1",
        "user-1",
        "s-a",
        expect.objectContaining({ value: "new-hunter3" }),
      );
    });

    // Regression: a rotation proposes no move, so `result.projectId` is undefined — the target's
    // existing project must still reach `updateSecret`, or the server unassigns the secret (see
    // `AgentAccessSecretsService.updateSecret`'s doc comment).
    it("forwards the target's current project so a rotation with no move does not unassign it", async () => {
      stubFoundSecret();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 229,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        newSecretValue: "new-hunter3",
      });
      await flush();

      expect(mockUpdateSecret).toHaveBeenCalledWith(
        "org-1",
        "user-1",
        "s-a",
        expect.objectContaining({ projectId: undefined, currentProjectId: "proj-current" }),
      );
    });

    it("generates the value at approval time for generateValue: true, never forwarding the request field", async () => {
      stubFoundSecret();
      mockGenerateSecretValue.mockResolvedValue("generated-rotation-value");
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 224,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        generateValue: true,
        generateLength: 50,
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ changes: { value: "generated" } }),
        }),
      );
      expect(mockGenerateSecretValue).toHaveBeenCalledWith({ length: 50, symbols: undefined });
      expect(mockUpdateSecret).toHaveBeenCalledWith(
        "org-1",
        "user-1",
        "s-a",
        expect.objectContaining({ value: "generated-rotation-value" }),
      );
      const [, response, outcome] = mockCredentialRequestResponse.mock.calls[0];
      expect(JSON.stringify(response)).not.toContain("generated-rotation-value");
      expect(JSON.stringify(outcome)).not.toContain("generated-rotation-value");
    });

    it("clears the note by passing an explicit empty string, distinct from an absent (unchanged) note", async () => {
      stubFoundSecret();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 225,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        newSecretNote: "",
      });
      await flush();

      expect(mockUpdateSecret).toHaveBeenCalledWith(
        "org-1",
        "user-1",
        "s-a",
        expect.objectContaining({ note: "" }),
      );
    });

    it("sends projectId: [target] only when the dialog confirms a move; renders the project picker only then", async () => {
      stubFoundSecret();
      mockListProjects.mockResolvedValue([{ id: "proj-1", name: "my-app", write: true }]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, projectId: "proj-1" }) });

      credentialRequestSubject.next({
        requestId: 226,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        projectHint: "my-app",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            changes: { project: { toHint: "my-app" } },
            writableProjects: [{ id: "proj-1", name: "my-app", write: true }],
            preselectedProjectId: "proj-1",
          }),
        }),
      );
      expect(mockUpdateSecret).toHaveBeenCalledWith(
        "org-1",
        "user-1",
        "s-a",
        expect.objectContaining({ projectId: "proj-1" }),
      );
    });

    it("omits projectId (never an empty array) when no move was requested at all", async () => {
      stubFoundSecret();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 227,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        newSecretName: "RENAMED",
      });
      await flush();

      const [, , , update] = mockUpdateSecret.mock.calls[0];
      expect(update.projectId).toBeUndefined();
      expect(mockListProjects).not.toHaveBeenCalled();
    });

    it("responds with status: updated, secretId, and operation: update on success", async () => {
      stubFoundSecret();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 228,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        newSecretName: "RENAMED",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        228,
        { approved: true, secretId: "s-a", itemName: "RENAMED" },
        { status: "updated", secretId: "s-a", operation: "update" },
      );
    });

    it("denies when the user rejects the update dialog, without calling updateSecret", async () => {
      stubFoundSecret();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 229,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        newSecretName: "RENAMED",
      });
      await flush();

      expect(mockUpdateSecret).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        229,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("denies with a generic error and toast when the API call fails after approval", async () => {
      stubFoundSecret();
      mockUpdateSecret.mockRejectedValue(new Error("server error"));
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 230,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        newSecretName: "RENAMED",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        230,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    });

    it("denies when the pre-dialog fetch of ciphertexts fails", async () => {
      mockFindSecrets.mockResolvedValue({
        matches: [{ secretId: "s-a", name: "DB_PASSWORD", organizationId: "org-1" }],
        truncated: false,
      });
      mockGetSecretForUpdate.mockRejectedValue(new Error("fetch failed"));

      credentialRequestSubject.next({
        requestId: 231,
        operation: "update",
        resourceType: "secret",
        targetId: "s-a",
        newSecretName: "RENAMED",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        231,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });
  });

  // M6: `projectUpdate` (rename) — locates the project across every SM org's project list.
  describe("credential request — operation: 'update', resourceType: 'project'", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("denies with reason notFound when the project can't be located in any SM org", async () => {
      mockSmOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme Inc" }]);
      mockListProjects.mockResolvedValue([]);

      credentialRequestSubject.next({
        requestId: 240,
        operation: "update",
        resourceType: "project",
        targetId: "proj-missing",
        newSecretName: "renamed",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        240,
        { approved: false, reason: "notFound" },
        { status: "not_found" },
      );
    });

    it("renames the project on approval and responds with status: updated, projectId, operation: update", async () => {
      mockSmOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme Inc" }]);
      mockListProjects.mockResolvedValue([{ id: "proj-1", name: "my-app", write: true }]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 241,
        operation: "update",
        resourceType: "project",
        targetId: "proj-1",
        newSecretName: "renamed-app",
      });
      await flush();

      expect(mockUpdateProject).toHaveBeenCalledWith("proj-1", "org-1", "user-1", "renamed-app");
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        241,
        { approved: true, projectId: "proj-1", itemName: "renamed-app" },
        { status: "updated", projectId: "proj-1", operation: "update" },
      );
    });
  });

  // M6: shared secret/project delete confirmation.
  describe("credential request — operation: 'delete'", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("secret: resolves the name before the dialog, then deletes on approval", async () => {
      mockFindSecrets.mockResolvedValue({
        matches: [
          {
            secretId: "s-a",
            name: "DB_PASSWORD",
            organizationId: "org-1",
            organizationName: "Acme Inc",
          },
        ],
        truncated: false,
      });
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 250,
        operation: "delete",
        resourceType: "secret",
        targetId: "s-a",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ kind: "secret", itemName: "DB_PASSWORD" }),
        }),
      );
      expect(mockDeleteSecret).toHaveBeenCalledWith("s-a", "org-1", "user-1");
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        250,
        { approved: true, itemName: "DB_PASSWORD", secretId: "s-a" },
        { status: "deleted", secretId: "s-a", operation: "delete" },
      );
    });

    it("secret: denies with reason notFound without a dialog when the secret can't be located", async () => {
      mockFindSecrets.mockResolvedValue({ matches: [], truncated: false });

      credentialRequestSubject.next({
        requestId: 251,
        operation: "delete",
        resourceType: "secret",
        targetId: "s-missing",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockDeleteSecret).not.toHaveBeenCalled();
    });

    it("secret: denies when the user rejects the confirmation dialog, without calling deleteSecret", async () => {
      mockFindSecrets.mockResolvedValue({
        matches: [{ secretId: "s-a", name: "DB_PASSWORD", organizationId: "org-1" }],
        truncated: false,
      });
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 252,
        operation: "delete",
        resourceType: "secret",
        targetId: "s-a",
      });
      await flush();

      expect(mockDeleteSecret).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        252,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("secret: denies with a generic error and toast when the delete call fails after approval", async () => {
      mockFindSecrets.mockResolvedValue({
        matches: [{ secretId: "s-a", name: "DB_PASSWORD", organizationId: "org-1" }],
        truncated: false,
      });
      mockDeleteSecret.mockRejectedValue(new Error("server error"));
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 253,
        operation: "delete",
        resourceType: "secret",
        targetId: "s-a",
      });
      await flush();

      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        253,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("project: resolves the contained-secret count before the dialog and deletes on approval", async () => {
      mockSmOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme Inc" }]);
      mockListProjects.mockResolvedValue([{ id: "proj-1", name: "my-app", write: true }]);
      mockCountSecretsInProject.mockResolvedValue(3);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 254,
        operation: "delete",
        resourceType: "project",
        targetId: "proj-1",
      });
      await flush();

      expect(mockCountSecretsInProject).toHaveBeenCalledWith("proj-1", "org-1", "user-1");
      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            kind: "project",
            itemName: "my-app",
            containedSecretCount: 3,
          }),
        }),
      );
      expect(mockDeleteProject).toHaveBeenCalledWith("proj-1", "org-1", "user-1");
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        254,
        { approved: true, itemName: "my-app", projectId: "proj-1" },
        { status: "deleted", projectId: "proj-1", operation: "delete" },
      );
    });

    it("project: shows an unknown-count warning (containedSecretCount undefined) when the count can't be resolved", async () => {
      mockSmOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme Inc" }]);
      mockListProjects.mockResolvedValue([{ id: "proj-1", name: "my-app", write: true }]);
      mockCountSecretsInProject.mockResolvedValue(undefined);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({
        requestId: 255,
        operation: "delete",
        resourceType: "project",
        targetId: "proj-1",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ containedSecretCount: undefined }),
        }),
      );
    });

    it("project: denies with reason notFound when the project can't be located", async () => {
      mockSmOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme Inc" }]);
      mockListProjects.mockResolvedValue([]);

      credentialRequestSubject.next({
        requestId: 256,
        operation: "delete",
        resourceType: "project",
        targetId: "proj-missing",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
    });
  });

  // M6: `projectList` — the sole list-shaped release.
  describe("credential request — operation: 'list', resourceType: 'project'", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("gathers projects across every SM org and releases the full list on one approval", async () => {
      mockSmOrganizations.mockResolvedValue([
        { id: "org-1", name: "Acme Inc" },
        { id: "org-2", name: "Other Co" },
      ]);
      mockListProjects.mockImplementation(async (orgId: string) =>
        orgId === "org-1"
          ? [{ id: "proj-1", name: "my-app", write: true }]
          : [{ id: "proj-2", name: "other-app", write: false }],
      );
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });

      credentialRequestSubject.next({ requestId: 260, operation: "list", resourceType: "project" });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            entries: [
              { name: "my-app", organizationName: "Acme Inc", write: true },
              { name: "other-app", organizationName: "Other Co", write: false },
            ],
          }),
        }),
      );
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        260,
        {
          approved: true,
          projects: [
            { id: "proj-1", name: "my-app", write: true, organization: "Acme Inc" },
            { id: "proj-2", name: "other-app", write: false, organization: "Other Co" },
          ],
        },
        { status: "listed", operation: "list" },
      );
    });

    it("denies with reason notFound without a dialog when there are no readable projects", async () => {
      mockSmOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme Inc" }]);
      mockListProjects.mockResolvedValue([]);

      credentialRequestSubject.next({ requestId: 261, operation: "list", resourceType: "project" });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        261,
        { approved: false, reason: "notFound" },
        { status: "not_found" },
      );
    });

    it("denies when the user rejects the list dialog", async () => {
      mockSmOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme Inc" }]);
      mockListProjects.mockResolvedValue([{ id: "proj-1", name: "my-app", write: true }]);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({ requestId: 262, operation: "list", resourceType: "project" });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        262,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });
  });

  // M7: `projectSecretsRequest` — the sole bulk-value release, `operation: "bulkRequest"`.
  describe("credential request — operation: 'bulkRequest'", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    function stubResolvedProject() {
      mockResolveProjectSelector.mockResolvedValue({
        projectId: "proj-1",
        projectName: "my-app",
        organizationId: "org-1",
        organizationName: "Acme Inc",
      });
      mockListSecretsInProject.mockResolvedValue([
        { secretId: "s-db", name: "DB_PASSWORD", organizationId: "org-1" },
        { secretId: "s-api", name: "API_KEY", organizationId: "org-1" },
      ]);
    }

    it("TOCTOU: shows the dialog (with the resolved names) before any value fetch, and never re-resolves after approval", async () => {
      stubResolvedProject();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });
      mockGetSecretValuesByIds.mockResolvedValue([
        { id: "s-db", name: "DB_PASSWORD", value: "hunter2" },
        { id: "s-api", name: "API_KEY", value: "sk-live-123" },
      ]);

      credentialRequestSubject.next({
        requestId: 300,
        operation: "bulkRequest",
        targetId: "proj-1",
      });
      await flush();

      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            projectName: "my-app",
            organizationName: "Acme Inc",
            entries: [{ name: "DB_PASSWORD" }, { name: "API_KEY" }],
          }),
        }),
      );
      // resolveProjectSelector/listSecretsInProject each ran exactly once — the dialog's own
      // display drives what's released, never a fresh resolution after approval.
      expect(mockResolveProjectSelector).toHaveBeenCalledTimes(1);
      expect(mockListSecretsInProject).toHaveBeenCalledTimes(1);
      expect(mockGetSecretValuesByIds).toHaveBeenCalledTimes(1);
    });

    it("calls getSecretValuesByIds only after approval, with exactly the ids that were displayed", async () => {
      stubResolvedProject();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });
      mockGetSecretValuesByIds.mockResolvedValue([
        { id: "s-db", name: "DB_PASSWORD", value: "hunter2" },
        { id: "s-api", name: "API_KEY", value: "sk-live-123" },
      ]);

      credentialRequestSubject.next({
        requestId: 301,
        operation: "bulkRequest",
        targetId: "proj-1",
      });
      await flush();

      expect(mockGetSecretValuesByIds).toHaveBeenCalledWith(["s-db", "s-api"], "org-1", "user-1");
    });

    it("does not call getSecretValuesByIds when the user rejects the dialog", async () => {
      stubResolvedProject();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 302,
        operation: "bulkRequest",
        targetId: "proj-1",
      });
      await flush();

      expect(mockGetSecretValuesByIds).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        302,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("responds with the released secrets, project id, and item name on approval, and records secretIds/projectId on the Shared outcome", async () => {
      stubResolvedProject();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });
      mockGetSecretValuesByIds.mockResolvedValue([
        { id: "s-db", name: "DB_PASSWORD", value: "hunter2" },
        { id: "s-api", name: "API_KEY", value: "sk-live-123" },
      ]);

      credentialRequestSubject.next({
        requestId: 303,
        operation: "bulkRequest",
        targetId: "proj-1",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        303,
        {
          approved: true,
          projectId: "proj-1",
          itemName: "my-app",
          secrets: [
            { id: "s-db", name: "DB_PASSWORD", value: "hunter2" },
            { id: "s-api", name: "API_KEY", value: "sk-live-123" },
          ],
        },
        {
          status: "shared",
          projectId: "proj-1",
          secretIds: ["s-db", "s-api"],
          operation: "bulkRequest",
        },
      );
    });

    it("resolves the project by targetId (id form)", async () => {
      stubResolvedProject();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 304,
        operation: "bulkRequest",
        targetId: "proj-1",
      });
      await flush();

      expect(mockResolveProjectSelector).toHaveBeenCalledWith(
        { id: "proj-1", name: undefined },
        "user-1",
      );
    });

    it("resolves the project by projectName (name form)", async () => {
      stubResolvedProject();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next({
        requestId: 305,
        operation: "bulkRequest",
        projectName: "my-app",
      });
      await flush();

      expect(mockResolveProjectSelector).toHaveBeenCalledWith(
        { id: undefined, name: "my-app" },
        "user-1",
      );
    });

    it("denies with reason notFound, without a dialog, when the project selector can't be resolved", async () => {
      mockResolveProjectSelector.mockResolvedValue(null);

      credentialRequestSubject.next({
        requestId: 306,
        operation: "bulkRequest",
        projectName: "no-such-project",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockListSecretsInProject).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        306,
        { approved: false, reason: "notFound" },
        { status: "not_found" },
      );
    });

    it("denies with reason notFound, without a dialog, when the project has zero readable secrets", async () => {
      mockResolveProjectSelector.mockResolvedValue({
        projectId: "proj-empty",
        projectName: "empty-project",
        organizationId: "org-1",
        organizationName: "Acme Inc",
      });
      mockListSecretsInProject.mockResolvedValue([]);

      credentialRequestSubject.next({
        requestId: 307,
        operation: "bulkRequest",
        targetId: "proj-empty",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
    });

    it("denies with a generic error and toast, without a dialog, when the project has more than 200 secrets", async () => {
      mockResolveProjectSelector.mockResolvedValue({
        projectId: "proj-big",
        projectName: "big-project",
        organizationId: "org-1",
        organizationName: "Acme Inc",
      });
      mockListSecretsInProject.mockResolvedValue(
        Array.from({ length: 201 }, (_, i) => ({
          secretId: `s-${i}`,
          name: `SECRET_${i}`,
          organizationId: "org-1",
        })),
      );

      credentialRequestSubject.next({
        requestId: 308,
        operation: "bulkRequest",
        targetId: "proj-big",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        308,
        { approved: false, reason: "error" },
        { status: "denied" },
      );
    });

    it("denies with a generic error and toast when the bulk value fetch fails after approval", async () => {
      stubResolvedProject();
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true }) });
      mockGetSecretValuesByIds.mockRejectedValue(new Error("server error"));

      credentialRequestSubject.next({
        requestId: 309,
        operation: "bulkRequest",
        targetId: "proj-1",
      });
      await flush();

      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        309,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("denies without calling resolveProjectSelector when neither a target id nor a project name is given", async () => {
      credentialRequestSubject.next({ requestId: 310, operation: "bulkRequest" });
      await flush();

      expect(mockResolveProjectSelector).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        310,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });
  });

  // M6 fail-closed: an unsupported resourceType/operation combination must deny, never fall
  // through to the credential/secret lookup path.
  describe("credential request — unsupported resourceType/operation combinations fail closed", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    it("denies operation: 'update' with resourceType: 'credential' without opening a dialog", async () => {
      credentialRequestSubject.next({
        requestId: 270,
        operation: "update",
        resourceType: "credential",
        targetId: "cipher-1",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockGetAllDecrypted).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        270,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("denies operation: 'delete' with resourceType: 'credential' without opening a dialog", async () => {
      credentialRequestSubject.next({
        requestId: 271,
        operation: "delete",
        resourceType: "credential",
        targetId: "cipher-1",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        271,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("denies operation: 'list' with resourceType: 'secret' without opening a dialog", async () => {
      credentialRequestSubject.next({
        requestId: 272,
        operation: "list",
        resourceType: "secret",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        272,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("never falls through to the credential/secret lookup path for an unsupported combination", async () => {
      credentialRequestSubject.next({
        requestId: 273,
        operation: "update",
        resourceType: "credential",
        targetId: "cipher-1",
      });
      await flush();

      expect(mockGetAllDecrypted).not.toHaveBeenCalled();
      expect(mockGetAllDecryptedForUrl).not.toHaveBeenCalled();
      expect(mockFindSecrets).not.toHaveBeenCalled();
    });
  });

  // M5 (agent-access-architecture.md, "M5 — Browser fill delivery"): deliveryMode: "fill"
  // requests branch after candidate lookup into describe -> origin filter -> approval -> fill.
  // Everything above the branch point (enable gate, unlock gate, grant/first-use, not-found
  // deny) is shared and already covered above.
  describe("credential request — deliveryMode: 'fill' routes to browser fill", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
    });

    const fillRequest = (requestId: number, extra: Record<string, unknown> = {}) => ({
      requestId,
      queryType: "domain",
      queryValue: "example.com",
      requesterName: "Cursor",
      origin: "relay", // skip the grant path; grant gating is covered in its own describe block
      deliveryMode: "fill",
      resourceType: "credential",
      ...extra,
    });

    it("describes, filters by origin, opens the fill dialog, fills, and responds value-free (happy path)", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecryptedForUrl.mockResolvedValue([cipher]);
      mockDescribeTarget.mockResolvedValue(makeFillDescription());
      const fillResult = {
        status: "filled",
        origin: "https://example.com",
        fields: [
          { role: "username", status: "filled", target: "input#email (login form)" },
          { role: "password", status: "filled", target: "input[type=password]#pw" },
        ],
      };
      mockFill.mockResolvedValue(fillResult);
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next(fillRequest(300));
      await flush();

      // The dialog shows the extension-reported origin and the field plan.
      expect(mockDialogOpen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            origin: "https://example.com",
            fieldPlan: [
              { role: "username", target: "input#email (login form)" },
              { role: "password", target: "input[type=password]#pw" },
            ],
            skipped: [],
          }),
        }),
      );

      // The fill payload goes to the extension — origin/token from the describe, the selected
      // item's values, nothing else.
      expect(mockFill).toHaveBeenCalledWith({
        origin: "https://example.com",
        targetToken: "ft_1",
        fields: ["username", "password"],
        credential: { username: "user@example.com", password: "hunter2" },
      });

      // The napi response is value-free: statuses, roles, and ids only.
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        300,
        {
          approved: true,
          credentialId: "c1",
          itemName: "My Login",
          fillResult: JSON.stringify(fillResult),
          fillFieldsShared: ["username", "password"],
        },
        {
          status: "filled",
          cipherId: "c1",
          fieldsShared: ["username", "password"],
          fillOrigin: "https://example.com",
        },
      );
      const [, response] = mockCredentialRequestResponse.mock.calls.at(-1)!;
      expect(JSON.stringify(response)).not.toContain("hunter2");

      // Server-side audit trail: Cipher_ClientAutofilledByAgent (1134).
      expect(mockCollect).toHaveBeenCalledWith(1134, "c1", true);
    });

    it("denies originMismatch with the extension-reported origin as detail, no dialog, when no candidate matches the page", async () => {
      const cipher = makeLoginCipher("c1", "My Login", {
        matchesUri: jest.fn().mockReturnValue(false),
      });
      mockGetAllDecryptedForUrl.mockResolvedValue([cipher]);
      mockDescribeTarget.mockResolvedValue(
        makeFillDescription({ origin: "https://phish.example" }),
      );

      credentialRequestSubject.next(fillRequest(301));
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockFill).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        301,
        { approved: false, reason: "originMismatch", denialDetail: "https://phish.example" },
        { status: "denied" },
      );
    });

    it("denies noSafeTarget with the first refusal reason as detail, no dialog, when no requested role has a safe target", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecryptedForUrl.mockResolvedValue([cipher]);
      mockDescribeTarget.mockResolvedValue(
        makeFillDescription({
          candidates: [],
          refusals: [{ role: "password", reason: "looks-like-registration" }],
        }),
      );

      credentialRequestSubject.next(fillRequest(302));
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockFill).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        302,
        { approved: false, reason: "noSafeTarget", denialDetail: "looks-like-registration" },
        { status: "denied" },
      );
    });

    it("denies with reason error and an actionable detail, no dialog, when the extension is unavailable pre-prompt", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecryptedForUrl.mockResolvedValue([cipher]);
      mockDescribeTarget.mockRejectedValue(new ExtensionUnavailableError());

      credentialRequestSubject.next(fillRequest(303));
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        303,
        {
          approved: false,
          reason: "error",
          denialDetail: expect.stringContaining("not connected"),
        },
        { status: "denied" },
      );
    });

    it("denies with reason error when more than one browser is connected pre-prompt", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecryptedForUrl.mockResolvedValue([cipher]);
      mockDescribeTarget.mockRejectedValue(new MultipleBrowsersError());

      credentialRequestSubject.next(fillRequest(304));
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        304,
        {
          approved: false,
          reason: "error",
          denialDetail: expect.stringContaining("More than one browser"),
        },
        { status: "denied" },
      );
    });

    it("still responds approved — with a desktop-assembled extension-unavailable fillResult and a FillFailed row — when the fill leg fails after approval", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecryptedForUrl.mockResolvedValue([cipher]);
      mockDescribeTarget.mockResolvedValue(makeFillDescription());
      mockFill.mockRejectedValue(new ExtensionUnavailableError());
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next(fillRequest(305));
      await flush();

      // Approved = the user approved; the fill object carries the execution outcome (M5).
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        305,
        {
          approved: true,
          credentialId: "c1",
          itemName: "My Login",
          fillResult: JSON.stringify({
            status: "extension-unavailable",
            origin: "https://example.com",
            fields: [],
          }),
          fillFieldsShared: [],
        },
        {
          status: "fill_failed",
          cipherId: undefined,
          fieldsShared: [],
          fillOrigin: "https://example.com",
        },
      );
      // Nothing was filled, so no autofill event is collected.
      expect(mockCollect).not.toHaveBeenCalled();
    });

    it("denies when the user rejects the fill dialog, without ever calling fill", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecryptedForUrl.mockResolvedValue([cipher]);
      mockDescribeTarget.mockResolvedValue(makeFillDescription());
      mockDialogOpen.mockReturnValue({ closed: of({ approved: false }) });

      credentialRequestSubject.next(fillRequest(306));
      await flush();

      expect(mockFill).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        306,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });

    it("sends the generated TOTP code, never the seed, and never puts the seed in the IPC payload", async () => {
      const cipher = makeLoginCipher("c1", "My Login", { totp: "SEED123SECRETBASE32" });
      mockGetAllDecryptedForUrl.mockResolvedValue([cipher]);
      mockDescribeTarget.mockResolvedValue(
        makeFillDescription({
          candidates: [
            { role: "username", target: "input#email (login form)", visible: true, frame: "top" },
            { role: "password", target: "input[type=password]#pw", visible: true, frame: "top" },
            { role: "totp", target: "input#otp (login form)", visible: true, frame: "top" },
          ],
        }),
      );
      mockFill.mockResolvedValue({
        status: "filled",
        origin: "https://example.com",
        fields: [{ role: "totp", status: "filled", target: "input#otp (login form)" }],
      });
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next(
        fillRequest(307, { fillFields: ["username", "password", "totp"] }),
      );
      await flush();

      expect(mockGetCode).toHaveBeenCalledWith("SEED123SECRETBASE32");
      const [fillPayload] = mockFill.mock.calls[0];
      expect(fillPayload.credential.totpCode).toBe("123456");
      expect(JSON.stringify(fillPayload)).not.toContain("SEED123SECRETBASE32");
    });

    it("restricts the plan to the request's fillFields when present", async () => {
      const cipher = makeLoginCipher("c1", "My Login");
      mockGetAllDecryptedForUrl.mockResolvedValue([cipher]);
      mockDescribeTarget.mockResolvedValue(makeFillDescription());
      mockFill.mockResolvedValue({
        status: "filled",
        origin: "https://example.com",
        fields: [{ role: "password", status: "filled", target: "input[type=password]#pw" }],
      });
      mockDialogOpen.mockReturnValue({ closed: of({ approved: true, selectedId: "c1" }) });

      credentialRequestSubject.next(fillRequest(308, { fillFields: ["password"] }));
      await flush();

      expect(mockFill).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: ["password"],
          credential: { password: "hunter2" },
        }),
      );
    });
  });

  // M5: describeFillTarget is approval-free, vault-free, and unlock-free (invariant 12) — it
  // rides the same pipeline but bypasses the unlock gate and never opens a dialog or an
  // activity row.
  describe("credential request — operation: 'describeFillTarget'", () => {
    beforeEach(async () => {
      service = buildService(true);
      await service.init();
      agentAccessEnabledSubject.next(true);
      accountSubject.next({ id: "user-1" as UserId });
    });

    it("responds with the serialized description while the vault is LOCKED — no unlock prompt, no dialog, no outcome annotation", async () => {
      activeAccountStatusSubject.next(AuthenticationStatus.Locked);
      const description = makeFillDescription();
      mockDescribeTarget.mockResolvedValue(description);

      credentialRequestSubject.next({
        requestId: 320,
        operation: "describeFillTarget",
        origin: "relay",
      });
      await flush();

      // No unlock toast/focus (the vault-free bypass), no approval dialog, no vault lookups.
      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockGetAllDecrypted).not.toHaveBeenCalled();
      expect(mockGetAllDecryptedForUrl).not.toHaveBeenCalled();
      // Two-argument response: no outcome, because no activity row exists for a describe.
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(320, {
        approved: true,
        fillTarget: JSON.stringify(description),
      });
    });

    it("denies with reason error and an actionable detail when the extension is unavailable, still without an outcome annotation", async () => {
      activeAccountStatusSubject.next(AuthenticationStatus.Unlocked);
      authSubjectFor("user-1").next(AuthenticationStatus.Unlocked);
      mockDescribeTarget.mockRejectedValue(new ExtensionUnavailableError());

      credentialRequestSubject.next({
        requestId: 321,
        operation: "describeFillTarget",
        origin: "relay",
      });
      await flush();

      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(321, {
        approved: false,
        reason: "error",
        denialDetail: expect.stringContaining("not connected"),
      });
    });

    it("still respects the enable gate: denies immediately when the setting is disabled", async () => {
      agentAccessEnabledSubject.next(false);
      mockDescribeTarget.mockResolvedValue(makeFillDescription());

      credentialRequestSubject.next({
        requestId: 322,
        operation: "describeFillTarget",
        origin: "relay",
      });
      await flush();

      expect(mockDescribeTarget).not.toHaveBeenCalled();
      expect(mockCredentialRequestResponse).toHaveBeenCalledWith(
        322,
        { approved: false, reason: "denied" },
        { status: "denied" },
      );
    });
  });

  describe("fingerprint verification pipeline removed", () => {
    // The renderer-side "verify agent fingerprint" ceremony was removed: it told users to compare
    // a code shown here with one on the requesting agent, but PSK pairing never performs a
    // rendezvous and no code is ever generated for the agent side to show, so the dialog trained
    // blind approval. A leftover main -> renderer FINGERPRINT_REQUEST is now a harmless no-op —
    // nothing in the renderer listens for it or opens a dialog in response.
    it("does not respond to a FINGERPRINT_REQUEST message", async () => {
      service = buildService(true);
      await service.init();

      fingerprintRequestSubject.next({
        requestId: 20,
        fingerprint: "AB12CD",
        identityFingerprint: "identity-fp",
      });
      await flush();

      expect(mockDialogOpen).not.toHaveBeenCalled();
      expect(mockFocusWindow).not.toHaveBeenCalled();
    });
  });
});
