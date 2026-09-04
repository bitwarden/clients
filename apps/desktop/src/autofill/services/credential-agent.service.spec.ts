import { BehaviorSubject, of, Subject } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CredentialRequestStatus } from "../models/credential-agent-request";
import { CredentialAgentPromptType } from "../models/credential-agent-setting";

import { CredentialAgentService } from "./credential-agent.service";

const USER_ID = "user-1" as UserId;

function makeLogin(
  id: string,
  name: string,
  overrides: Partial<{ username: string; password: string; totp: string; uri: string }> = {},
): CipherView {
  return {
    id,
    name,
    type: CipherType.Login,
    isDeleted: false,
    isArchived: false,
    login: {
      username: overrides.username ?? "me",
      password: overrides.password ?? "hunter2",
      totp: overrides.totp,
      matchesUri: (target: string) => target === overrides.uri,
    },
  } as unknown as CipherView;
}

/** Flush pending microtasks and one macrotask cycle to let async RxJS pipelines settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

describe("CredentialAgentService", () => {
  let service: CredentialAgentService;

  let requests: Subject<Record<string, unknown>>;
  let enabled: BehaviorSubject<boolean>;
  let promptBehavior: BehaviorSubject<CredentialAgentPromptType>;
  let authStatus: BehaviorSubject<AuthenticationStatus>;

  let requestResponse: jest.Mock;
  let dialogOpen: jest.Mock;
  let ciphers: CipherView[];

  /** Emits a request as the main process would, then lets the pipeline settle. */
  async function request(payload: Record<string, unknown>) {
    requests.next({ requestId: 1, ...payload });
    await flush();
  }

  /** Queues the user's answer for the next approval dialog. */
  function answerDialog(approved: boolean) {
    dialogOpen.mockReturnValueOnce({ closed: of(approved) });
  }

  beforeEach(async () => {
    requests = new Subject();
    enabled = new BehaviorSubject(true);
    promptBehavior = new BehaviorSubject<CredentialAgentPromptType>(
      CredentialAgentPromptType.Always,
    );
    authStatus = new BehaviorSubject(AuthenticationStatus.Unlocked);
    ciphers = [makeLogin("c1", "GitHub", { uri: "https://github.com" })];

    requestResponse = jest.fn().mockResolvedValue(undefined);
    dialogOpen = jest.fn().mockReturnValue({ closed: of(true) });

    (global as any).ipc = {
      autofill: {
        credentialAgent: {
          isLoaded: jest.fn().mockResolvedValue(true),
          init: jest.fn().mockResolvedValue(undefined),
          stop: jest.fn().mockResolvedValue(undefined),
          requestResponse,
        },
      },
      platform: { focusWindow: jest.fn() },
    };

    service = new CredentialAgentService(
      { getAllDecrypted: jest.fn().mockImplementation(async () => ciphers) } as any,
      { getCode$: jest.fn().mockReturnValue(of({ code: "123456" })) } as any,
      { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warning: jest.fn() } as any,
      { open: dialogOpen } as any,
      { messages$: jest.fn().mockReturnValue(requests.asObservable()) } as any,
      {
        activeAccountStatus$: authStatus.asObservable(),
        authStatusFor$: jest.fn().mockReturnValue(authStatus.asObservable()),
      } as any,
      { showToast: jest.fn() } as any,
      { t: jest.fn().mockImplementation((key: string) => key) } as any,
      {
        credentialAgentEnabled$: enabled.asObservable(),
        credentialAgentPromptBehavior$: promptBehavior.asObservable(),
      } as any,
      { activeAccount$: of({ id: USER_ID }) } as any,
    );

    await service.init();
  });

  afterEach(() => {
    service.ngOnDestroy();
    jest.clearAllMocks();
  });

  it("grants an approved request matched by uri", async () => {
    await request({ uri: "https://github.com" });

    expect(requestResponse).toHaveBeenCalledWith({
      requestId: 1,
      status: CredentialRequestStatus.Granted,
      credential: {
        cipherId: "c1",
        name: "GitHub",
        username: "me",
        password: "hunter2",
        totp: undefined,
      },
    });
  });

  it("matches by name when no uri is given", async () => {
    await request({ name: "git" });

    expect(requestResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: CredentialRequestStatus.Granted }),
    );
  });

  it("includes the current totp code when the item has one", async () => {
    ciphers = [makeLogin("c1", "GitHub", { uri: "https://github.com", totp: "seed" })];

    await request({ uri: "https://github.com" });

    expect(requestResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        credential: expect.objectContaining({ totp: "123456" }),
      }),
    );
  });

  it("reports not found when nothing matches", async () => {
    await request({ uri: "https://example.com" });

    expect(requestResponse).toHaveBeenCalledWith({
      requestId: 1,
      status: CredentialRequestStatus.NotFound,
      credential: undefined,
    });
    expect(dialogOpen).not.toHaveBeenCalled();
  });

  it("denies the request when the user rejects the prompt", async () => {
    answerDialog(false);

    await request({ uri: "https://github.com" });

    expect(requestResponse).toHaveBeenCalledWith({
      requestId: 1,
      status: CredentialRequestStatus.Denied,
      credential: undefined,
    });
  });

  it("denies without prompting when the agent setting is off", async () => {
    enabled.next(false);

    await request({ uri: "https://github.com" });

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(requestResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: CredentialRequestStatus.Denied }),
    );
  });

  it("never prompts when the approval setting is 'never'", async () => {
    promptBehavior.next(CredentialAgentPromptType.Never);

    await request({ uri: "https://github.com" });

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(requestResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: CredentialRequestStatus.Granted }),
    );
  });

  it("prompts once per item while approvals are remembered", async () => {
    promptBehavior.next(CredentialAgentPromptType.RememberUntilLock);

    await request({ uri: "https://github.com" });
    await request({ uri: "https://github.com" });

    expect(dialogOpen).toHaveBeenCalledTimes(1);
  });

  it("prompts again after the vault locks", async () => {
    promptBehavior.next(CredentialAgentPromptType.RememberUntilLock);
    await request({ uri: "https://github.com" });

    authStatus.next(AuthenticationStatus.Locked);
    authStatus.next(AuthenticationStatus.Unlocked);
    await request({ uri: "https://github.com" });

    expect(dialogOpen).toHaveBeenCalledTimes(2);
  });

  it("skips deleted and archived items", async () => {
    ciphers = [
      {
        ...makeLogin("c1", "GitHub", { uri: "https://github.com" }),
        isDeleted: true,
      } as CipherView,
    ];

    await request({ uri: "https://github.com" });

    expect(requestResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: CredentialRequestStatus.NotFound }),
    );
  });
});
