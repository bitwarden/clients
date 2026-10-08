import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, EMPTY, Observable, of, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";
import { CopyCipherFieldService, PasswordRepromptService } from "@bitwarden/vault";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { ApproveAgentRequestResult } from "../components/approve-agent-request.component";
import { AgentAccessPromptType } from "../models/agent-access-setting";
import { AgentRequest, AgentRequester, AgentRequestKind } from "../models/agent-request";
import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";

import { AgentAccessService } from "./agent-access.service";
import { AgentRequestGate } from "./agent-request-gate.service";

const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

function login(id: string, overrides: Partial<CipherView> = {}): CipherView {
  return {
    id,
    name: `Item ${id}`,
    type: CipherType.Login,
    reprompt: CipherRepromptType.None,
    viewPassword: true,
    login: {
      username: "me",
      password: "hunter2",
      totp: null,
      uris: [{ uri: "https://github.com" }],
    },
    ...overrides,
  } as unknown as CipherView;
}

describe("AgentAccessService", () => {
  let requests: Subject<AgentRequest>;
  let enabled: BehaviorSubject<boolean>;
  let settings: { agentAccessEnabled$: Observable<boolean>; agentAccessPromptBehavior$: unknown };
  let prompt: BehaviorSubject<AgentAccessPromptType>;
  let ciphers: CipherView[];
  let dialogResult: ApproveAgentRequestResult | undefined;
  let respond: jest.Mock;
  const cipherService = mock<CipherService>();
  const dialogService = mock<DialogService>();
  const reprompt = mock<PasswordRepromptService>();
  const copyCipherField = mock<CopyCipherFieldService>();
  const getCode$ = jest.fn();
  let service: AgentAccessService;

  const claude: AgentRequester = {
    app: {
      pid: 3,
      name: "Claude Code",
      signer: { kind: "developerId", id: "Q6L2SF6YDW", organization: "Anthropic PBC", valid: true },
    },
    chain: [],
    bundledCli: false,
  };
  const send = (kind: AgentRequestKind, deadline = Date.now() + 60_000, requester = claude) =>
    requests.next({ requestId: 7, kind, deadline, requester });
  const github: AgentRequestKind = { type: "credential", query: { domain: "github.com" } };
  const run: AgentRequestKind = {
    ...github,
    purpose: { command: "gh pr list", env: { GH_TOKEN: "password" } },
  };
  const dialogData = (call = 0) => dialogService.open.mock.calls[call][1]?.data;
  const answer = () => respond.mock.calls.at(-1)?.[1];

  beforeEach(async () => {
    requests = new Subject();
    enabled = new BehaviorSubject(true);
    prompt = new BehaviorSubject<AgentAccessPromptType>(AgentAccessPromptType.Always);
    settings = { agentAccessEnabled$: enabled, agentAccessPromptBehavior$: prompt };
    ciphers = [login("c1")];
    dialogResult = { approved: true, cipherId: "c1" };
    respond = jest.fn().mockResolvedValue(undefined);
    (global as any).ipc = {
      autofill: {
        agentAccess: {
          respond,
          ready: jest.fn().mockResolvedValue(undefined),
          isLoaded: jest.fn().mockResolvedValue(false),
          init: jest.fn().mockResolvedValue(undefined),
          stop: jest.fn().mockResolvedValue(undefined),
        },
      },
      platform: { focusWindow: jest.fn() },
    };

    jest.clearAllMocks();
    cipherService.getAllDecryptedForUrl.mockImplementation(async () => ciphers);
    cipherService.getAllDecrypted.mockImplementation(async () => ciphers);
    dialogService.open.mockImplementation(
      () => ({ closed: of(dialogResult), close: jest.fn() }) as any,
    );
    reprompt.passwordRepromptCheck.mockResolvedValue(true);
    copyCipherField.totpAllowed.mockImplementation(async (c) => !!(c as CipherView).login.totp);
    getCode$.mockImplementation(() => of({ code: "123456" }));

    const account = new BehaviorSubject({ id: "user-1" as UserId });
    const auth = { activeAccountStatus$: of(AuthenticationStatus.Unlocked) };
    const gate = new AgentRequestGate(
      auth as any,
      { activeAccount$: account } as any,
      mock<ToastService>(),
      mock<I18nService>(),
      mock<LogService>(),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: { activeAccount$: account } },
        { provide: AuthService, useValue: auth },
        { provide: CipherService, useValue: cipherService },
        { provide: DialogService, useValue: dialogService },
        { provide: AgentRequestGate, useValue: gate },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PasswordRepromptService, useValue: reprompt },
        { provide: CopyCipherFieldService, useValue: copyCipherField },
        { provide: TotpService, useValue: { getCode$ } },
        {
          provide: MessageListener,
          useValue: {
            messages$: (def: { command: string }) =>
              def.command === AGENT_ACCESS_IPC_CHANNELS.REQUEST ? requests : EMPTY,
          },
        },
        { provide: DesktopSettingsService, useValue: settings },
      ],
    });
    service = TestBed.inject(AgentAccessService);
    await service.init();
  });

  afterEach(() => {
    service.ngOnDestroy();
    jest.useRealTimers();
  });

  it("releases the payload the dialog showed once the user authorizes", async () => {
    send(github);
    await flush();

    expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
      "https://github.com",
      "user-1",
    );
    expect(respond).toHaveBeenCalledWith(7, {
      status: "approved",
      credential: {
        credentialId: "c1",
        username: "me",
        password: "hunter2",
        totp: undefined,
        uri: "https://github.com",
      },
    });
  });

  it("answers notFound without a dialog", async () => {
    ciphers = [];
    send(github);
    await flush();

    expect(dialogService.open).not.toHaveBeenCalled();
    expect(answer()).toEqual({ status: "notFound" });
  });

  it("withholds password and TOTP the user may not view", async () => {
    ciphers = [login("c1", { viewPassword: false })];
    send(github);
    await flush();

    const candidates = dialogData().credential.candidates;
    expect(candidates[0].fields).toEqual(["username"]);
    expect(answer().credential).toEqual(
      expect.objectContaining({ username: "me", password: undefined, totp: undefined }),
    );
  });

  it("generates the TOTP code only once the user approves", async () => {
    ciphers = [login("c1", { login: { username: "me", totp: "otpauth://x" } as any })];
    dialogService.open.mockImplementation(() => {
      expect(getCode$).not.toHaveBeenCalled();
      return { closed: of(dialogResult), close: jest.fn() } as any;
    });
    send(github);
    await flush();

    expect(dialogData().credential.candidates[0].fields).toEqual(["username", "totp"]);
    expect(answer().credential.totp).toBe("123456");
  });

  it("withholds TOTP the account may not use", async () => {
    ciphers = [login("c1", { login: { username: "me", totp: "otpauth://x" } as any })];
    copyCipherField.totpAllowed.mockResolvedValue(false);
    send(github);
    await flush();

    expect(dialogData().credential.candidates[0].fields).toEqual(["username"]);
    expect(getCode$).not.toHaveBeenCalled();
    expect(answer().credential.totp).toBeUndefined();
  });

  it("denies when the master password reprompt fails", async () => {
    ciphers = [login("c1", { reprompt: CipherRepromptType.Password })];
    reprompt.passwordRepromptCheck.mockResolvedValue(false);
    send(github);
    await flush();

    expect(answer()).toEqual({ status: "denied" });
  });

  it("releases the item picked from several matches", async () => {
    ciphers = [login("c1"), login("c2", { login: { username: "other" } as any })];
    dialogResult = { approved: true, cipherId: "c2" };
    send(github);
    await flush();

    expect(answer().credential.credentialId).toBe("c2");
  });

  it("remembers an approval until lock when asked to", async () => {
    prompt.next(AgentAccessPromptType.RememberUntilLock);
    dialogResult = { approved: true, cipherId: "c1", remember: true };
    send(github);
    await flush();
    send(github);
    await flush();

    expect(dialogService.open).toHaveBeenCalledTimes(1);
    expect(answer().status).toBe("approved");
  });

  it("never remembers a requester it can't identify", async () => {
    prompt.next(AgentAccessPromptType.RememberUntilLock);
    dialogResult = { approved: true, cipherId: "c1", remember: true };
    const adHoc: AgentRequester = {
      app: { pid: 3, name: "tool", signer: { kind: "adHoc", valid: true } },
      chain: [],
      bundledCli: false,
    };
    send(github, undefined, adHoc);
    await flush();
    send(github, undefined, adHoc);
    await flush();

    expect(dialogData().credential.rememberable).toBe(false);
    expect(dialogService.open).toHaveBeenCalledTimes(2);
  });

  it("does not let a remembered run release the credential to the caller", async () => {
    prompt.next(AgentAccessPromptType.RememberUntilLock);
    dialogResult = { approved: true, cipherId: "c1", remember: true };
    send(run, undefined, { ...claude, bundledCli: true });
    await flush();
    send(github);
    await flush();

    expect(dialogService.open).toHaveBeenCalledTimes(2);
  });

  it("shows env only for the bundled CLI", async () => {
    send(run);
    await flush();
    send(run, undefined, { ...claude, bundledCli: true });
    await flush();

    expect(dialogData(0).credential.purpose).toEqual({ command: "gh pr list", env: {} });
    expect(dialogData(1).credential.purpose.env).toEqual({ GH_TOKEN: "password" });
  });

  it("never remembers a reprompt item", async () => {
    prompt.next(AgentAccessPromptType.RememberUntilLock);
    ciphers = [login("c1", { reprompt: CipherRepromptType.Password })];
    dialogResult = { approved: true, cipherId: "c1", remember: true };
    send(github);
    await flush();
    send(github);
    await flush();

    expect(dialogService.open).toHaveBeenCalledTimes(2);
  });

  it("treats a dismissed dialog as denied and an expired one as a timeout", async () => {
    dialogResult = undefined;
    send(github);
    await flush();
    expect(answer()).toEqual({ status: "denied" });

    send(github, Date.now() - 1);
    await flush();
    expect(answer()).toEqual({ status: "timeout" });
  });

  it("answers a request that arrives before the setting loads", async () => {
    const loading = new Subject<boolean>();
    settings.agentAccessEnabled$ = loading;
    service.ngOnDestroy();
    service = TestBed.runInInjectionContext(() => new AgentAccessService());
    await service.init();

    send(github);
    await flush();
    expect(respond).not.toHaveBeenCalled();

    loading.next(true);
    await flush();
    expect(answer().status).toBe("approved");
  });

  it("times out without releasing or remembering when the reprompt outlasts the deadline", async () => {
    jest.useFakeTimers();
    prompt.next(AgentAccessPromptType.RememberUntilLock);
    dialogResult = { approved: true, cipherId: "c1", remember: true };
    const deadline = Date.now() + 60_000;
    reprompt.passwordRepromptCheck.mockImplementationOnce(async () => {
      jest.setSystemTime(deadline);
      return true;
    });
    send(github, deadline);
    await jest.advanceTimersByTimeAsync(0);
    expect(answer()).toEqual({ status: "timeout" });

    send(github);
    await jest.advanceTimersByTimeAsync(0);
    expect(dialogService.open).toHaveBeenCalledTimes(2);
  });

  it("answers an approval request with the user's choice", async () => {
    dialogResult = { approved: false };
    send({ type: "approval", title: "Deploy?" });
    await flush();

    expect(dialogData().approval).toEqual({
      type: "approval",
      title: "Deploy?",
    });
    expect(answer()).toEqual({ status: "denied" });
  });

  it("leaves SSH signs to the SSH agent service, even with the setting off", async () => {
    const sign: AgentRequestKind = { type: "sshSign", cipherId: "c1", isForwarding: false };
    send(sign);
    enabled.next(false);
    send(sign);
    await flush();

    expect(dialogService.open).not.toHaveBeenCalled();
    expect(respond).not.toHaveBeenCalled();
  });

  it("refuses without touching the vault when the setting is off", async () => {
    enabled.next(false);
    send(github);
    await flush();

    expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
    expect(answer()).toEqual({ status: "denied" });
  });

  it("runs the listener only while the setting is on", async () => {
    await flush();
    expect(ipc.autofill.agentAccess.init).toHaveBeenCalled();

    (ipc.autofill.agentAccess.isLoaded as jest.Mock).mockResolvedValue(true);
    enabled.next(false);
    await flush();
    expect(ipc.autofill.agentAccess.stop).toHaveBeenCalled();
  });
});
