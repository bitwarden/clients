import { ipcMain, Notification } from "electron";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { sshagent } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { SSH_AGENT_IPC_CHANNELS } from "../models/ipc-channels";
import { SshAgentPromptType } from "../models/ssh-agent-setting";

import { MainSshAgentService } from "./main-ssh-agent.service";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  Notification: jest.fn(),
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  sshagent: {
    SshAgentState: {
      serve: jest.fn(),
    },
  },
}));

type IpcHandler = (...args: unknown[]) => unknown;

function makeSshCipher(id: string, name: string, privateKey: string): CipherView {
  return {
    id,
    name,
    type: CipherType.SshKey,
    isDeleted: false,
    isArchived: false,
    sshKey: { privateKey },
  } as unknown as CipherView;
}

/** Flush pending microtasks and one macrotask cycle so async RxJS pipelines settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

describe("MainSshAgentService", () => {
  const userId = "user-1" as UserId;

  let logService: ReturnType<typeof mock<LogService>>;
  let messagingService: ReturnType<typeof mock<MessagingService>>;
  let cipherService: ReturnType<typeof mock<CipherService>>;
  let authService: ReturnType<typeof mock<AuthService>>;
  let accountService: ReturnType<typeof mock<AccountService>>;
  let desktopSettingsService: ReturnType<typeof mock<DesktopSettingsService>>;
  let i18nService: ReturnType<typeof mock<I18nService>>;
  let windowMain: ReturnType<typeof mock<WindowMain>>;

  let activeAccount$: BehaviorSubject<unknown>;
  let activeAccountStatus$: BehaviorSubject<AuthenticationStatus>;
  let sshAgentEnabled$: BehaviorSubject<boolean>;
  let sshAgentPromptBehavior$: BehaviorSubject<SshAgentPromptType>;

  let ipcHandlers: Map<string, IpcHandler>;
  let agentState: { isRunning: jest.Mock; replace: jest.Mock; stop: jest.Mock };
  let shownNotification: { on: jest.Mock; show: jest.Mock };
  let capturedSignCb: (err: Error | null, data: sshagent.SignRequestData) => Promise<boolean>;
  let capturedListCb: (err: Error | null) => Promise<boolean>;

  let service: MainSshAgentService;

  beforeEach(() => {
    jest.clearAllMocks();
    ipcHandlers = new Map();

    logService = mock<LogService>();
    messagingService = mock<MessagingService>();
    cipherService = mock<CipherService>();
    authService = mock<AuthService>();
    accountService = mock<AccountService>();
    desktopSettingsService = mock<DesktopSettingsService>();
    i18nService = mock<I18nService>();
    windowMain = mock<WindowMain>();

    activeAccount$ = new BehaviorSubject<unknown>({ id: userId });
    activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    sshAgentEnabled$ = new BehaviorSubject<boolean>(true);
    sshAgentPromptBehavior$ = new BehaviorSubject<SshAgentPromptType>(SshAgentPromptType.Always);

    accountService.activeAccount$ = activeAccount$ as never;
    authService.activeAccountStatus$ = activeAccountStatus$;
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
    desktopSettingsService.sshAgentEnabled$ = sshAgentEnabled$;
    desktopSettingsService.sshAgentPromptBehavior$ = sshAgentPromptBehavior$;
    cipherService.cipherViews$.mockReturnValue(of([]));
    cipherService.getAllDecrypted.mockResolvedValue([]);
    i18nService.t.mockImplementation((key: string, ...args: string[]) => {
      if (key === "unknownApplication") {
        return "Unknown application";
      }
      if (key === "sshAgentApprovalNotificationTitle") {
        return "SSH key request";
      }
      if (key === "sshAgentApprovalNotificationBody") {
        return `${args[0]} requests ${args[1]}`;
      }
      if (key === "close") {
        return "Close";
      }
      return key;
    });

    agentState = {
      isRunning: jest.fn().mockReturnValue(true),
      replace: jest.fn(),
      stop: jest.fn(),
    };
    shownNotification = { on: jest.fn(), show: jest.fn() };

    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: IpcHandler) => {
      ipcHandlers.set(channel, handler);
    });
    (Notification as unknown as jest.Mock).mockImplementation(() => shownNotification);
    (sshagent.SshAgentState.serve as jest.Mock).mockImplementation(
      (sign: IpcHandler, list: IpcHandler) => {
        capturedSignCb = sign as (
          err: Error | null,
          data: sshagent.SignRequestData,
        ) => Promise<boolean>;
        capturedListCb = list as (err: Error | null) => Promise<boolean>;
        return Promise.resolve(agentState);
      },
    );

    service = new MainSshAgentService(
      logService,
      messagingService,
      cipherService,
      authService,
      accountService,
      desktopSettingsService,
      i18nService,
      windowMain,
    );
  });

  describe("constructor", () => {
    it("registers only the sign request response IPC handler", () => {
      expect(ipcHandlers.has(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE)).toBe(true);
      expect(ipcHandlers.size).toBe(1);
    });
  });

  describe("key provisioning", () => {
    it("starts the agent and pushes SSH-key ciphers when enabled and unlocked", async () => {
      cipherService.cipherViews$.mockReturnValue(
        of([makeSshCipher("c1", "Key 1", "pk-1"), makeSshCipher("c2", "Key 2", "pk-2")]),
      );

      service.init();
      await flush();

      expect(sshagent.SshAgentState.serve).toHaveBeenCalled();
      expect(agentState.replace).toHaveBeenCalledWith([
        { name: "Key 1", privateKey: "pk-1", cipherId: "c1" },
        { name: "Key 2", privateKey: "pk-2", cipherId: "c2" },
      ]);
    });

    it("stops the agent when the ssh agent is disabled", async () => {
      service.init();
      await flush();

      sshAgentEnabled$.next(false);
      await flush();

      expect(agentState.stop).toHaveBeenCalled();
    });

    it("excludes non-SSH-key, deleted, and archived ciphers", async () => {
      const ciphers = [
        makeSshCipher("c1", "Key 1", "pk-1"),
        { id: "c2", name: "Login", type: CipherType.Login, isDeleted: false, isArchived: false },
        { ...makeSshCipher("c3", "Deleted", "pk-3"), isDeleted: true },
        { ...makeSshCipher("c4", "Archived", "pk-4"), isArchived: true },
      ] as unknown as CipherView[];

      cipherService.cipherViews$.mockReturnValue(of(ciphers));

      service.init();
      await flush();

      expect(agentState.replace).toHaveBeenCalledWith([
        { name: "Key 1", privateKey: "pk-1", cipherId: "c1" },
      ]);
    });
  });

  describe("requestSign", () => {
    const cipher = makeSshCipher("cipher-1", "My Key", "pk-1");

    function signData(overrides: Partial<sshagent.SignRequest> = {}): sshagent.SignRequestData {
      return {
        cipherId: "cipher-1",
        signRequest: {
          publicKey: { alg: "ssh-ed25519", blob: [] },
          processName: "ssh",
          isForwarding: false,
          namespace: "ssh",
          hostFingerprint: "SHA256:abc",
          ...overrides,
        },
      } as unknown as sshagent.SignRequestData;
    }

    beforeEach(async () => {
      cipherService.getAllDecrypted.mockResolvedValue([cipher]);
      cipherService.cipherViews$.mockReturnValue(of([cipher]));

      // Trigger `serve` so the sign/list callbacks are captured.
      service.init();
      await flush();
    });

    it("returns false when the ssh agent is disabled", async () => {
      sshAgentEnabled$.next(false);

      expect(await capturedSignCb(null, signData())).toBe(false);
    });

    it("returns false when the requested cipher is not in the active vault", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([]);

      expect(await capturedSignCb(null, signData())).toBe(false);
      expect(logService.error).toHaveBeenCalled();
    });

    it("shows an OS notification for every sign request", async () => {
      sshAgentPromptBehavior$.next(SshAgentPromptType.Never);

      await capturedSignCb(null, signData());

      expect(Notification).toHaveBeenCalledWith({
        title: "SSH key request",
        body: "ssh requests My Key",
        closeButtonText: "Close",
      });
      expect(shownNotification.show).toHaveBeenCalled();
    });

    it("approves without prompting when the prompt behavior is Never", async () => {
      sshAgentPromptBehavior$.next(SshAgentPromptType.Never);

      expect(await capturedSignCb(null, signData())).toBe(true);
      expect(messagingService.send).not.toHaveBeenCalled();
    });

    it("prompts and resolves via the sign request response when Always", async () => {
      sshAgentPromptBehavior$.next(SshAgentPromptType.Always);

      const signPromise = capturedSignCb(null, signData());
      await flush();

      expect(messagingService.send).toHaveBeenCalledWith(
        SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST,
        expect.objectContaining({
          requestId: 1,
          cipherName: "My Key",
          application: "ssh",
          isAgentForwarding: false,
          namespace: "ssh",
        }),
      );

      const responseHandler = ipcHandlers.get(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE)!;
      await responseHandler({}, { requestId: 1, accepted: true });

      expect(await signPromise).toBe(true);
    });

    it("resolves false when the renderer rejects", async () => {
      sshAgentPromptBehavior$.next(SshAgentPromptType.Always);

      const signPromise = capturedSignCb(null, signData());
      await flush();

      const responseHandler = ipcHandlers.get(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE)!;
      await responseHandler({}, { requestId: 1, accepted: false });

      expect(await signPromise).toBe(false);
    });

    describe("RememberUntilLock", () => {
      beforeEach(() => {
        sshAgentPromptBehavior$.next(SshAgentPromptType.RememberUntilLock);
      });

      it("prompts on the first request and then approves the remembered host", async () => {
        const first = capturedSignCb(null, signData());
        await flush();

        const responseHandler = ipcHandlers.get(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE)!;
        await responseHandler({}, { requestId: 1, accepted: true });

        expect(await first).toBe(true);
        expect(messagingService.send).toHaveBeenCalledTimes(1);

        const second = capturedSignCb(null, signData());
        expect(await second).toBe(true);
        expect(messagingService.send).toHaveBeenCalledTimes(1);
      });

      it("prompts again for a different host", async () => {
        const first = capturedSignCb(null, signData());
        await flush();
        await ipcHandlers.get(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE)!(
          {},
          { requestId: 1, accepted: true },
        );
        await first;

        const other = capturedSignCb(null, signData({ hostFingerprint: "SHA256:def" }));
        await flush();

        expect(messagingService.send).toHaveBeenCalledTimes(2);
        // Silence the unresolved promise from the second request.
        await ipcHandlers.get(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE)!(
          {},
          { requestId: 2, accepted: false },
        );
        await other;
      });
    });
  });

  describe("requestListKeys", () => {
    beforeEach(async () => {
      cipherService.getAllDecrypted.mockResolvedValue([makeSshCipher("c1", "Key", "pk")]);

      service.init();
      await flush();
    });

    it("replaces the agent keys with the decrypted SSH ciphers", async () => {
      expect(await capturedListCb(null)).toBe(true);

      expect(agentState.replace).toHaveBeenCalledWith([
        { name: "Key", privateKey: "pk", cipherId: "c1" },
      ]);
    });
  });

  describe("authorization reset", () => {
    const cipher = makeSshCipher("cipher-1", "My Key", "pk-1");

    function signData(): sshagent.SignRequestData {
      return {
        cipherId: "cipher-1",
        signRequest: {
          publicKey: { alg: "ssh-ed25519", blob: [] },
          processName: "ssh",
          isForwarding: false,
          namespace: "ssh",
          hostFingerprint: "SHA256:abc",
        },
      } as unknown as sshagent.SignRequestData;
    }

    beforeEach(async () => {
      cipherService.getAllDecrypted.mockResolvedValue([cipher]);
      cipherService.cipherViews$.mockReturnValue(of([cipher]));
      sshAgentPromptBehavior$.next(SshAgentPromptType.RememberUntilLock);

      service.init();
      await flush();
    });

    it("forgets remembered hosts when the vault locks", async () => {
      const first = capturedSignCb(null, signData());
      await flush();
      await ipcHandlers.get(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE)!(
        {},
        { requestId: 1, accepted: true },
      );
      await first;
      expect(messagingService.send).toHaveBeenCalledTimes(1);

      activeAccountStatus$.next(AuthenticationStatus.Locked);
      activeAccountStatus$.next(AuthenticationStatus.Unlocked);
      await flush();

      const second = capturedSignCb(null, signData());
      await flush();

      expect(messagingService.send).toHaveBeenCalledTimes(2);
      await ipcHandlers.get(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE)!(
        {},
        { requestId: 2, accepted: false },
      );
      await second;
    });
  });
});
