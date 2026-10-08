import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { DialogService } from "@bitwarden/components";

import { AGENT_FILL_IPC_CHANNELS } from "../models/ipc-channels";

import { AgentFillService } from "./agent-fill.service";

jest.mock("../components/agent-fill-approval-dialog.component", () => ({
  AgentFillApprovalDialogComponent: { open: jest.fn() },
}));

describe("AgentFillService", () => {
  const requests$ = new Subject<any>();
  const approvalResponse = jest.fn().mockResolvedValue(undefined);
  const cipherService = mock<CipherService>();
  const configService = mock<ConfigService>();
  let flag: boolean;

  const request = {
    requestId: "a1",
    connectionName: "Claude Desktop",
    domain: "www.delta.com",
    tabUrl: "https://www.delta.com/login",
    browser: "Chrome",
    cipherType: CipherType.Login,
  };

  async function deliver() {
    requests$.next(request);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    flag = true;
    (global as any).ipc = { autofill: { agentFill: { approvalResponse } }, platform: {} };
    configService.getFeatureFlag.mockImplementation(
      async (f) => f === FeatureFlag.AgentFill && flag,
    );

    const messageListener = mock<MessageListener>();
    messageListener.messages$.mockImplementation(((def: { command: string }) =>
      def.command === AGENT_FILL_IPC_CHANNELS.APPROVAL_REQUEST ? requests$ : new Subject()) as any);
    const accountService = mock<AccountService>();
    (accountService as any).activeAccount$ = new BehaviorSubject({ id: "user-1" });
    const authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));

    TestBed.configureTestingModule({
      providers: [
        AgentFillService,
        { provide: MessageListener, useValue: messageListener },
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: CipherService, useValue: cipherService },
        { provide: ConfigService, useValue: configService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: LogService, useValue: mock<LogService>() },
      ],
    });
    TestBed.inject(AgentFillService).init();
  });

  it("answers error without looking at the vault while the feature flag is off", async () => {
    flag = false;

    await deliver();

    expect(approvalResponse).toHaveBeenCalledWith("a1", {
      decision: "failed",
      reason: "error",
      message: "Agent fill is not enabled.",
    });
    expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
  });

  it("answers locked when the desktop app is locked", async () => {
    await deliver();

    expect(approvalResponse).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({ reason: "locked" }),
    );
  });
});
