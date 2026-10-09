import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { DialogService } from "@bitwarden/components";

import { AgentFillApprovalDialogParams } from "../components/agent-fill-approval-dialog.component";
import { AgentFillApprovalRecord } from "../models/agent-fill-approval-record";
import { AGENT_FILL_IPC_CHANNELS } from "../models/ipc-channels";

import { AgentFillApprovalApiService } from "./agent-fill-approval-api.service";
import { AgentFillService } from "./agent-fill.service";

const mockDialogOpen = jest.fn();
jest.mock("../components/agent-fill-approval-dialog.component", () => ({
  AgentFillApprovalDialogComponent: { open: (...args: unknown[]) => mockDialogOpen(...args) },
}));

describe("AgentFillService", () => {
  // Recreated for each test so earlier tests' services can't hear this test's messages.
  let requests$: Subject<any>;
  let answered$: Subject<{ approvalId: string }>;
  let syncCompleted$: Subject<{ successfully: boolean }>;
  const approvalResponse = jest.fn().mockResolvedValue(undefined);
  const cipherService = mock<CipherService>();
  const configService = mock<ConfigService>();
  const approvalApi = mock<AgentFillApprovalApiService>();
  const logService = mock<LogService>();
  const approvals = {
    create_request: jest.fn(),
    seal_response: jest.fn(),
    verify_response: jest.fn(),
  };
  let flag: boolean;
  let approvalsFlag: boolean;
  let authStatus: AuthenticationStatus;
  let dialogClosed$: Subject<any>;
  let dialogClose: jest.Mock;
  let dialogParams: AgentFillApprovalDialogParams;

  const request = {
    requestId: "a1",
    connectionName: "Claude Desktop",
    domain: "www.delta.com",
    tabUrl: "https://www.delta.com/login",
    browser: "Chrome",
    cipherType: CipherType.Login,
  };
  const cipher = {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Delta",
    type: CipherType.Login,
    login: { username: "me@example.com" },
    isDeleted: false,
    isArchived: false,
    reprompt: 0,
  };
  const pending = { view: { domain: "www.delta.com" }, challenge: "challenge" };
  const record = (extra: Partial<AgentFillApprovalRecord> = {}) =>
    ({
      id: "11111111-1111-4111-8111-111111111111",
      sealedResponse: "sealed-phone-response",
      responseDeviceId: "phone-1",
      ...extra,
    }) as AgentFillApprovalRecord;

  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function deliver() {
    requests$.next(request);
    await flush();
  }

  function lastResponse() {
    expect(approvalResponse).toHaveBeenCalledTimes(1);
    return approvalResponse.mock.calls[0][1];
  }

  beforeEach(() => {
    jest.resetAllMocks();
    requests$ = new Subject();
    answered$ = new Subject();
    syncCompleted$ = new Subject();
    flag = true;
    approvalsFlag = true;
    authStatus = AuthenticationStatus.Unlocked;
    approvalResponse.mockResolvedValue(undefined);
    (global as any).ipc = {
      autofill: { agentFill: { approvalResponse } },
      platform: { focusWindow: jest.fn() },
    };
    configService.getFeatureFlag.mockImplementation(async (f) =>
      f === FeatureFlag.AgentFill ? flag : f === FeatureFlag.AgentFillApprovals && approvalsFlag,
    );
    cipherService.getAllDecryptedForUrl.mockResolvedValue([cipher as any]);

    dialogClosed$ = new Subject();
    dialogClose = jest.fn((result) => dialogClosed$.next(result));
    mockDialogOpen.mockImplementation((_dialogService, params) => {
      dialogParams = params;
      return { closed: dialogClosed$, close: dialogClose };
    });

    approvals.create_request.mockReturnValue({ sealedRequest: "sealed-request", pending });
    approvals.seal_response.mockReturnValue("sealed-own-response");
    approvals.verify_response.mockReturnValue({
      approved: { cipherId: "22222222-2222-4222-8222-222222222222" },
    });
    approvalApi.create.mockResolvedValue(record({ sealedResponse: null }));
    approvalApi.get.mockResolvedValue(record());

    const sdkService = mock<SdkService>();
    sdkService.userClient$.mockReturnValue(
      of({
        take: () => ({
          value: { agent_fill: () => ({ approvals: () => approvals }) },
          [Symbol.dispose]: () => {},
        }),
      }) as any,
    );

    const messageListener = mock<MessageListener>();
    messageListener.messages$.mockImplementation(((def: { command: string }) => {
      switch (def.command) {
        case AGENT_FILL_IPC_CHANNELS.APPROVAL_REQUEST:
          return requests$;
        case "agentFillApprovalAnswered":
          return answered$;
        case "syncCompleted":
          return syncCompleted$;
        default:
          return new Subject();
      }
    }) as any);
    const accountService = mock<AccountService>();
    (accountService as any).activeAccount$ = new BehaviorSubject({ id: "user-1" });
    const authService = mock<AuthService>();
    authService.authStatusFor$.mockImplementation(() => of(authStatus));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AgentFillService,
        { provide: MessageListener, useValue: messageListener },
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        { provide: CipherService, useValue: cipherService },
        { provide: ConfigService, useValue: configService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: LogService, useValue: logService },
        { provide: SdkService, useValue: sdkService },
        { provide: AgentFillApprovalApiService, useValue: approvalApi },
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
    authStatus = AuthenticationStatus.Locked;

    await deliver();

    expect(approvalResponse).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({ reason: "locked" }),
    );
  });

  describe("creating the server request", () => {
    it("seals and posts the request, then opens the dialog", async () => {
      await deliver();

      expect(approvals.create_request).toHaveBeenCalledWith({
        cipherType: "login",
        tabUrl: "https://www.delta.com/login",
        domain: "www.delta.com",
        connectionName: "Claude Desktop",
        browserName: "Chrome",
      });
      expect(approvalApi.create).toHaveBeenCalledWith("sealed-request");
      expect(dialogParams.recordAnswer).toBeDefined();
    });

    it("works with the dialog alone while the approvals flag is off", async () => {
      approvalsFlag = false;

      await deliver();
      expect(approvals.create_request).not.toHaveBeenCalled();
      expect(dialogParams.recordAnswer).toBeUndefined();

      dialogClosed$.next({
        decision: "approved",
        cipherId: "22222222-2222-4222-8222-222222222222",
      });
      await flush();

      expect(lastResponse()).toEqual(expect.objectContaining({ decision: "approved" }));
    });

    it("works with the dialog alone when the POST fails", async () => {
      approvalApi.create.mockRejectedValue(new Error("offline"));

      await deliver();
      expect(dialogParams.recordAnswer).toBeUndefined();

      dialogClosed$.next({ decision: "denied" });
      await flush();

      expect(lastResponse()).toEqual({ decision: "denied", reason: undefined });
    });
  });

  describe("when the dialog answers first", () => {
    const approve = {
      decision: "approved",
      cipherId: "22222222-2222-4222-8222-222222222222",
    } as const;

    it("seals the answer, PUTs it and keeps the dialog's decision", async () => {
      approvalApi.answer.mockResolvedValue({ kind: "answered", record: record() });
      await deliver();

      const result = await dialogParams.recordAnswer!(approve);

      expect(approvals.seal_response).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        { view: pending.view, challenge: pending.challenge },
        { approved: { cipherId: "22222222-2222-4222-8222-222222222222" } },
      );
      expect(approvalApi.answer).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        "sealed-own-response",
      );
      expect(result).toEqual(approve);
    });

    it("seals a denial with its reason", async () => {
      approvalApi.answer.mockResolvedValue({ kind: "answered", record: record() });
      await deliver();

      await dialogParams.recordAnswer!({ decision: "denied", reason: "not_requested" });

      expect(approvals.seal_response).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        expect.anything(),
        {
          denied: { reason: "notRequested" },
        },
      );
    });

    it("uses the verified phone answer on a 409", async () => {
      approvalApi.answer.mockResolvedValue({ kind: "alreadyAnswered", record: record() });
      approvals.verify_response.mockReturnValue({ denied: { reason: "wrongAccount" } });
      await deliver();

      const result = await dialogParams.recordAnswer!(approve);

      expect(approvals.verify_response).toHaveBeenCalledWith(
        pending,
        "11111111-1111-4111-8111-111111111111",
        "sealed-phone-response",
      );
      expect(result).toEqual({ decision: "denied", reason: "wrong_account" });
    });

    it("answers expired on a 410", async () => {
      approvalApi.answer.mockResolvedValue({ kind: "expired" });
      await deliver();

      expect(await dialogParams.recordAnswer!(approve)).toEqual({
        decision: "failed",
        reason: "expired",
      });
    });

    it("keeps the dialog's decision on any other error", async () => {
      approvalApi.answer.mockRejectedValue(new Error("boom"));
      await deliver();

      expect(await dialogParams.recordAnswer!(approve)).toEqual(approve);
    });

    it("returns the fill details once the dialog closes", async () => {
      await deliver();

      dialogClosed$.next(approve);
      await flush();

      expect(lastResponse()).toEqual({
        decision: "approved",
        cipherId: "22222222-2222-4222-8222-222222222222",
        itemName: "Delta",
        username: "me@example.com",
        lastFour: undefined,
      });
    });
  });

  describe("when a phone answers first", () => {
    it("verifies the answer, closes the dialog and fills with the decision", async () => {
      await deliver();

      answered$.next({ approvalId: "11111111-1111-4111-8111-111111111111" });
      await flush();

      expect(approvalApi.get).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
      expect(dialogClose).toHaveBeenCalledWith({ handledElsewhere: true });
      expect(lastResponse()).toEqual(
        expect.objectContaining({
          decision: "approved",
          cipherId: "22222222-2222-4222-8222-222222222222",
        }),
      );
    });

    it("ignores an answer for another approval", async () => {
      await deliver();

      answered$.next({ approvalId: "someone-else" });
      await flush();

      expect(approvalApi.get).not.toHaveBeenCalled();
      expect(approvalResponse).not.toHaveBeenCalled();
    });

    it("fetches once after a sync and accepts a verified answer", async () => {
      await deliver();

      syncCompleted$.next({ successfully: true });
      syncCompleted$.next({ successfully: true });
      await flush();

      expect(approvalApi.get).toHaveBeenCalledTimes(1);
      expect(lastResponse()).toEqual(expect.objectContaining({ decision: "approved" }));
    });

    it("keeps waiting when the record has no answer yet", async () => {
      approvalApi.get.mockResolvedValue(record({ sealedResponse: null }));
      await deliver();

      syncCompleted$.next({ successfully: true });
      await flush();

      expect(approvals.verify_response).not.toHaveBeenCalled();
      expect(approvalResponse).not.toHaveBeenCalled();
    });

    it("answers no_matching_item when the item isn't in the vault", async () => {
      approvals.verify_response.mockReturnValue({
        approved: { cipherId: "33333333-3333-4333-8333-333333333333" },
      });
      await deliver();

      answered$.next({ approvalId: "11111111-1111-4111-8111-111111111111" });
      await flush();

      expect(lastResponse()).toEqual(expect.objectContaining({ reason: "no_matching_item" }));
    });

    it.each([
      ["wrongAccount", "wrong_account"],
      ["notRequested", "not_requested"],
    ])("passes a %s denial on", async (sdkReason, reason) => {
      approvals.verify_response.mockReturnValue({ denied: { reason: sdkReason } });
      await deliver();

      answered$.next({ approvalId: "11111111-1111-4111-8111-111111111111" });
      await flush();

      expect(lastResponse()).toEqual({ decision: "denied", reason });
    });

    it("answers expired when verification fails with Expired", async () => {
      approvals.verify_response.mockImplementation(() => {
        throw Object.assign(new Error("expired"), {
          name: "AgentFillApprovalError",
          variant: "Expired",
        });
      });
      await deliver();

      answered$.next({ approvalId: "11111111-1111-4111-8111-111111111111" });
      await flush();

      expect(lastResponse()).toEqual(expect.objectContaining({ reason: "expired" }));
    });

    it("denies and fills nothing when verification fails for any other reason", async () => {
      approvals.verify_response.mockImplementation(() => {
        throw Object.assign(new Error("replayed"), {
          name: "AgentFillApprovalError",
          variant: "ChallengeMismatch",
        });
      });
      await deliver();

      answered$.next({ approvalId: "11111111-1111-4111-8111-111111111111" });
      await flush();

      expect(lastResponse()).toEqual({ decision: "denied" });
    });

    it("ignores a second answer once a decision was accepted", async () => {
      await deliver();

      answered$.next({ approvalId: "11111111-1111-4111-8111-111111111111" });
      await flush();
      answered$.next({ approvalId: "11111111-1111-4111-8111-111111111111" });
      await flush();

      expect(approvalApi.get).toHaveBeenCalledTimes(1);
      expect(approvalResponse).toHaveBeenCalledTimes(1);
    });

    it("logs the approval id and the error variant only", async () => {
      approvals.verify_response.mockImplementation(() => {
        throw Object.assign(new Error("secret detail"), {
          name: "AgentFillApprovalError",
          variant: "Unseal",
        });
      });
      await deliver();

      answered$.next({ approvalId: "11111111-1111-4111-8111-111111111111" });
      await flush();

      const logged = logService.warning.mock.calls.map((c) => c[0]).join("\n");
      expect(logged).toContain("11111111-1111-4111-8111-111111111111");
      expect(logged).toContain("Unseal");
      expect(logged).not.toContain("secret detail");
    });
  });
});
