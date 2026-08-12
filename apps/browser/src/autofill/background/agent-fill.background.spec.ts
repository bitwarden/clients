import { mock, MockProxy } from "jest-mock-extended";
import { of, Subject } from "rxjs";

import {
  AGENT_FILL_IPC_TOPIC,
  AgentFillDescribeResponseMessage,
  AgentFillRequestMessage,
  AgentFillResponseMessage,
} from "@bitwarden/common/autofill/agent-fill";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { IncomingMessage } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../platform/browser/browser-api";
import AutofillField from "../models/autofill-field";
import { PageDetail, AutofillService } from "../services/abstractions/autofill.service";
import { InlineMenuFieldQualificationService } from "../services/inline-menu-field-qualification.service";
import {
  createAutofillFieldMock,
  createAutofillPageDetailsMock,
  createChromeTabMock,
  createPageDetailMock,
} from "../spec/autofill-mocks";
import { flushPromises } from "../spec/testing-utils";
import { AgentFillOpResult } from "../types/agent-fill";

import { AgentFillBackground, AGENT_FILL_TARGET_TOKEN_TTL_MS } from "./agent-fill.background";

jest.mock("@bitwarden/sdk-internal", () => ({
  OutgoingMessage: {
    new_json_payload: jest.fn((payload: unknown, destination: unknown, topic: unknown) => ({
      payload,
      destination,
      topic,
    })),
  },
}));

const TAB_URL = "https://example.com/login";
const TAB_ORIGIN = "https://example.com";

function loginField(customFields: Partial<AutofillField> = {}): AutofillField {
  return createAutofillFieldMock({
    autoCompleteType: "off",
    htmlID: "",
    htmlName: "",
    placeholder: "",
    "label-left": "",
    "label-right": "",
    "label-top": "",
    "label-tag": "",
    "label-aria": "",
    title: "",
    form: "loginForm",
    ...customFields,
  });
}

function loginPageDetail(fields?: AutofillField[]): PageDetail {
  return createPageDetailMock({
    frameId: 0,
    tab: createChromeTabMock({ url: TAB_URL }),
    details: createAutofillPageDetailsMock({
      url: TAB_URL,
      fields: fields ?? [
        loginField({ opid: "__0", htmlID: "email", type: "text" }),
        loginField({ opid: "__1", htmlID: "pw", type: "password" }),
      ],
    }),
  });
}

function incomingMessage(
  payload: unknown,
  source: unknown = "DesktopRenderer",
  topic: string | undefined = AGENT_FILL_IPC_TOPIC,
): IncomingMessage {
  return {
    topic,
    source,
    parse_payload_as_json: () => payload,
  } as unknown as IncomingMessage;
}

function fillRequest(overrides: Partial<AgentFillRequestMessage> = {}): AgentFillRequestMessage {
  return {
    type: "agentFillRequest",
    requestId: "req-fill-1",
    origin: TAB_ORIGIN,
    fields: ["username", "password"],
    credential: { username: "user@example.com", password: "hunter2-secret" },
    ...overrides,
  };
}

describe("AgentFillBackground", () => {
  let messagesSubject: Subject<IncomingMessage>;
  let ipcService: { messages$: Subject<IncomingMessage>; send: jest.Mock };
  let autofillService: MockProxy<AutofillService>;
  let logService: MockProxy<LogService>;
  let agentFillBackground: AgentFillBackground;
  let getTabSpy: jest.SpyInstance;
  let tabSendMessageSpy: jest.SpyInstance;

  function sentPayloads(): { payload: any; destination: unknown; topic: unknown }[] {
    return ipcService.send.mock.calls.map((call) => call[0]);
  }

  function lastSentPayload(): any {
    const sent = sentPayloads();
    return sent[sent.length - 1]?.payload;
  }

  async function describeActivePage(): Promise<AgentFillDescribeResponseMessage> {
    messagesSubject.next(
      incomingMessage({ type: "agentFillDescribeRequest", requestId: "req-describe-1" }),
    );
    await flushPromises();
    return lastSentPayload();
  }

  async function sendFillRequest(
    message: AgentFillRequestMessage,
  ): Promise<AgentFillResponseMessage> {
    messagesSubject.next(incomingMessage(message));
    await flushPromises();
    return lastSentPayload();
  }

  beforeEach(() => {
    messagesSubject = new Subject<IncomingMessage>();
    ipcService = { messages$: messagesSubject, send: jest.fn().mockResolvedValue(undefined) };
    autofillService = mock<AutofillService>();
    autofillService.collectPageDetailsFromTab$.mockReturnValue(of([loginPageDetail()]));
    logService = mock<LogService>();

    getTabSpy = jest
      .spyOn(BrowserApi, "getTabFromCurrentWindow")
      .mockResolvedValue(createChromeTabMock({ id: 10, url: TAB_URL }));
    tabSendMessageSpy = jest
      .spyOn(BrowserApi, "tabSendMessage")
      .mockImplementation(async (tab, message: any): Promise<any> =>
        (message.agentFillOps ?? []).map((op: { opid: string }): AgentFillOpResult => ({
          opid: op.opid,
          status: "filled",
        })),
      );

    agentFillBackground = new AgentFillBackground(
      ipcService as unknown as IpcService,
      autofillService,
      new InlineMenuFieldQualificationService(),
      logService,
    );
  });

  afterEach(() => {
    agentFillBackground.destroy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe("init", () => {
    it("announces itself with an agentFillHello to the DesktopRenderer", async () => {
      agentFillBackground.init();
      await flushPromises();

      expect(ipcService.send).toHaveBeenCalledWith({
        payload: { type: "agentFillHello" },
        destination: "DesktopRenderer",
        topic: AGENT_FILL_IPC_TOPIC,
      });
    });

    it("retries the hello on a bounded timer when the desktop transport is not connected", async () => {
      jest.useFakeTimers();
      ipcService.send.mockRejectedValueOnce(new Error("Destination unreachable"));

      agentFillBackground.init();
      await flushPromises();
      expect(ipcService.send).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(10_000);
      expect(ipcService.send).toHaveBeenCalledTimes(2);

      // Second attempt succeeded; the timer stops.
      await jest.advanceTimersByTimeAsync(60_000);
      expect(ipcService.send).toHaveBeenCalledTimes(2);
    });

    it("degrades to a no-op when the IPC service is not initialized", () => {
      const uninitializedIpc = {
        get messages$(): Subject<IncomingMessage> {
          throw new Error("IpcService not initialized. Call init() first.");
        },
        send: jest.fn(),
      };
      const background = new AgentFillBackground(
        uninitializedIpc as unknown as IpcService,
        autofillService,
        new InlineMenuFieldQualificationService(),
        logService,
      );

      expect(() => background.init()).not.toThrow();
      expect(uninitializedIpc.send).not.toHaveBeenCalled();
    });
  });

  describe("message gating", () => {
    beforeEach(() => {
      agentFillBackground.init();
      ipcService.send.mockClear();
    });

    it("ignores agent-fill messages that do not come from the desktop app", async () => {
      messagesSubject.next(
        incomingMessage(
          { type: "agentFillDescribeRequest", requestId: "req-1" },
          { Web: { tab_id: 1, document_id: "doc", origin: "https://evil.example.org" } },
        ),
      );
      await flushPromises();

      expect(ipcService.send).not.toHaveBeenCalled();
      expect(tabSendMessageSpy).not.toHaveBeenCalled();
    });

    it("ignores messages on other topics and unrelated message shapes", async () => {
      messagesSubject.next(
        incomingMessage(
          { type: "agentFillDescribeRequest", requestId: "req-1" },
          "DesktopRenderer",
          "some-other-topic",
        ),
      );
      messagesSubject.next(incomingMessage({ type: "somethingElse" }));
      messagesSubject.next(incomingMessage({ type: "agentFillHello" }));
      await flushPromises();

      expect(ipcService.send).not.toHaveBeenCalled();
    });
  });

  describe("describe requests", () => {
    beforeEach(() => {
      agentFillBackground.init();
      ipcService.send.mockClear();
    });

    it("responds with a target description and token for a describable login page", async () => {
      const response = await describeActivePage();

      expect(sentPayloads()[0].destination).toBe("DesktopRenderer");
      expect(sentPayloads()[0].topic).toBe(AGENT_FILL_IPC_TOPIC);
      expect(response).toEqual({
        type: "agentFillDescribeResponse",
        requestId: "req-describe-1",
        target: {
          origin: TAB_ORIGIN,
          formClass: "login",
          candidates: [
            expect.objectContaining({ role: "username" }),
            expect.objectContaining({ role: "password" }),
          ],
          refusals: [],
          targetToken: expect.any(String),
          expiresInMs: AGENT_FILL_TARGET_TOKEN_TTL_MS,
        },
      });
    });

    it("responds with a refusal when the page has no describable login surface", async () => {
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([loginPageDetail([])]));

      const response = await describeActivePage();

      expect(response).toEqual({
        type: "agentFillDescribeResponse",
        requestId: "req-describe-1",
        refusal: "no-login-form",
      });
    });

    it("responds with a static refusal when describing throws internally", async () => {
      getTabSpy.mockRejectedValue(new Error("boom"));

      const response = await describeActivePage();

      expect(response).toEqual({
        type: "agentFillDescribeResponse",
        requestId: "req-describe-1",
        refusal: "no-login-form",
      });
    });
  });

  describe("fill requests", () => {
    beforeEach(() => {
      agentFillBackground.init();
      ipcService.send.mockClear();
    });

    it("fills the planned fields and responds value-free", async () => {
      const response = await sendFillRequest(fillRequest());

      expect(tabSendMessageSpy).toHaveBeenCalledTimes(1);
      const [, contentMessage, options] = tabSendMessageSpy.mock.calls[0];
      expect(contentMessage.command).toBe("agentFillForm");
      expect(contentMessage.agentFillExpectedOrigin).toBe(TAB_ORIGIN);
      expect(contentMessage.agentFillOps).toEqual([
        { opid: "__0", role: "username", value: "user@example.com" },
        { opid: "__1", role: "password", value: "hunter2-secret" },
      ]);
      expect(options).toEqual({ frameId: 0 });

      expect(response.result).toEqual({
        status: "filled",
        origin: TAB_ORIGIN,
        fields: [
          { role: "username", status: "filled", target: "input[type=text]#email (login form)" },
          { role: "password", status: "filled", target: "input[type=password]#pw (login form)" },
        ],
      });
      // The credential value never appears in any IPC reply.
      expect(JSON.stringify(sentPayloads())).not.toContain("hunter2-secret");
    });

    it("refuses with origin-changed when the active tab origin no longer matches", async () => {
      getTabSpy.mockResolvedValue(
        createChromeTabMock({ id: 10, url: "https://other.example.net/login" }),
      );

      const response = await sendFillRequest(fillRequest());

      expect(tabSendMessageSpy).not.toHaveBeenCalled();
      expect(response.result).toEqual({
        status: "origin-changed",
        origin: "https://other.example.net",
        fields: [],
      });
    });

    it("refuses with no-safe-target and dispatches nothing on a registration page", async () => {
      autofillService.collectPageDetailsFromTab$.mockReturnValue(
        of([
          loginPageDetail([
            loginField({ opid: "__0", htmlID: "email", type: "text" }),
            loginField({ opid: "__1", htmlID: "pw", type: "password" }),
            loginField({ opid: "__2", htmlID: "confirm-pw", type: "password" }),
          ]),
        ]),
      );

      const response = await sendFillRequest(fillRequest());

      expect(tabSendMessageSpy).not.toHaveBeenCalled();
      expect(response.result.status).toBe("no-safe-target");
      expect(response.result.reason).toBe("looks-like-registration");
    });

    it("reports partial when the password write-time check fails but the username fills", async () => {
      tabSendMessageSpy.mockImplementation(async (tab, message: any): Promise<any> =>
        (message.agentFillOps ?? []).map((op: { opid: string; role: string }): AgentFillOpResult =>
          op.role === "password"
            ? { opid: op.opid, status: "failed", reason: "not-password-input" }
            : { opid: op.opid, status: "filled" },
        ),
      );

      const response = await sendFillRequest(fillRequest());

      expect(response.result.status).toBe("partial");
      expect(response.result.fields).toEqual([
        { role: "username", status: "filled", target: "input[type=text]#email (login form)" },
        { role: "password", status: "failed", reason: "not-password-input" },
      ]);
    });

    it("skips a requested role with no credential value and fills the rest", async () => {
      const response = await sendFillRequest(
        fillRequest({ credential: { username: "user@example.com" } }),
      );

      expect(tabSendMessageSpy.mock.calls[0][1].agentFillOps).toEqual([
        { opid: "__0", role: "username", value: "user@example.com" },
      ]);
      expect(response.result.status).toBe("partial");
      expect(response.result.fields).toEqual([
        { role: "username", status: "filled", target: "input[type=text]#email (login form)" },
        { role: "password", status: "skipped", reason: "no-credential-value" },
      ]);
    });

    it("fails the planned ops when the frame does not respond", async () => {
      tabSendMessageSpy.mockResolvedValue(undefined);

      const response = await sendFillRequest(fillRequest());

      expect(response.result.status).toBe("no-safe-target");
      expect(response.result.fields).toEqual([
        { role: "username", status: "failed", reason: "frame-unreachable" },
        { role: "password", status: "failed", reason: "frame-unreachable" },
      ]);
    });

    it("does not re-collect page details after filling and never updates vault state", async () => {
      await sendFillRequest(fillRequest());

      expect(autofillService.collectPageDetailsFromTab$).toHaveBeenCalledTimes(1);
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(autofillService.doAutoFillOnTab).not.toHaveBeenCalled();
    });

    it("never logs credential values on any handler path", async () => {
      tabSendMessageSpy.mockRejectedValue(new Error("boom"));
      await sendFillRequest(fillRequest());

      const allLogArgs = JSON.stringify([
        ...logService.error.mock.calls,
        ...logService.warning.mock.calls,
        ...logService.info.mock.calls,
        ...logService.debug.mock.calls,
      ]);
      expect(allLogArgs).not.toContain("hunter2-secret");
      expect(allLogArgs).not.toContain("user@example.com");
    });
  });

  describe("target tokens", () => {
    beforeEach(() => {
      agentFillBackground.init();
      ipcService.send.mockClear();
    });

    async function describeAndGetToken(): Promise<string> {
      const response = await describeActivePage();
      ipcService.send.mockClear();
      return response.target!.targetToken;
    }

    it("fills against an unchanged plan when the token is redeemed", async () => {
      const targetToken = await describeAndGetToken();

      const response = await sendFillRequest(fillRequest({ targetToken }));

      expect(response.result.status).toBe("filled");
    });

    it("is single-use: a second redemption yields target-changed", async () => {
      const targetToken = await describeAndGetToken();

      await sendFillRequest(fillRequest({ targetToken }));
      const second = await sendFillRequest(fillRequest({ requestId: "req-fill-2", targetToken }));

      expect(second.result).toEqual({ status: "target-changed", origin: TAB_ORIGIN, fields: [] });
    });

    it("refuses with target-changed when the page drifts from the described plan", async () => {
      const targetToken = await describeAndGetToken();

      // Same page shape, but the password element identity changed.
      autofillService.collectPageDetailsFromTab$.mockReturnValue(
        of([
          loginPageDetail([
            loginField({ opid: "__0", htmlID: "email", type: "text" }),
            loginField({ opid: "__9", htmlID: "pw-rerendered", type: "password" }),
          ]),
        ]),
      );

      const response = await sendFillRequest(fillRequest({ targetToken }));

      expect(tabSendMessageSpy).not.toHaveBeenCalled();
      expect(response.result).toEqual({
        status: "target-changed",
        origin: TAB_ORIGIN,
        fields: [],
      });
    });

    it("refuses with target-changed when the token has expired", async () => {
      const targetToken = await describeAndGetToken();
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now + AGENT_FILL_TARGET_TOKEN_TTL_MS + 1);

      const response = await sendFillRequest(fillRequest({ targetToken }));

      expect(response.result).toEqual({ status: "target-changed", origin: TAB_ORIGIN, fields: [] });
    });

    it("refuses with target-changed when redeemed against a different tab", async () => {
      const targetToken = await describeAndGetToken();
      getTabSpy.mockResolvedValue(createChromeTabMock({ id: 99, url: TAB_URL }));

      const response = await sendFillRequest(fillRequest({ targetToken }));

      expect(response.result).toEqual({ status: "target-changed", origin: TAB_ORIGIN, fields: [] });
    });

    it("refuses with target-changed for an unknown token", async () => {
      const response = await sendFillRequest(fillRequest({ targetToken: "no-such-token" }));

      expect(response.result).toEqual({ status: "target-changed", origin: TAB_ORIGIN, fields: [] });
    });

    it("only fills roles pinned by the token even if a fresh plan finds more", async () => {
      // Describe a password-only page; the token pins only the password role.
      autofillService.collectPageDetailsFromTab$.mockReturnValue(
        of([loginPageDetail([loginField({ opid: "__1", htmlID: "pw", type: "password" })])]),
      );
      const targetToken = await describeAndGetToken();

      // The page now also has a username field, but the token predates it.
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([loginPageDetail()]));

      const response = await sendFillRequest(fillRequest({ targetToken }));

      expect(tabSendMessageSpy.mock.calls[0][1].agentFillOps).toEqual([
        { opid: "__1", role: "password", value: "hunter2-secret" },
      ]);
      expect(response.result.status).toBe("partial");
      expect(response.result.fields).toEqual([
        { role: "username", status: "skipped", reason: "no-safe-target" },
        { role: "password", status: "filled", target: "input[type=password]#pw (login form)" },
      ]);
    });
  });
});
