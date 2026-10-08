import { connect } from "net";
import { tmpdir } from "os";
import * as path from "path";

import { mock } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AgentFillTopic } from "@bitwarden/common/autofill/agent-fill/agent-fill-ipc";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { StateProvider } from "@bitwarden/state";
import { FakeGlobalStateProvider } from "@bitwarden/state-test-utils";

import { NativeMessagingMain } from "../../main/native-messaging.main";
import { WindowMain } from "../../main/window.main";
import { AGENT_FILL_IPC_CHANNELS } from "../models/ipc-channels";

import { AgentFillConnectionsService } from "./agent-fill-connections.service";
import { MainAgentFillService } from "./main-agent-fill.service";

const ipcHandlers = new Map<string, (...args: any[]) => any>();

jest.mock("electron", () => ({
  ipcMain: { handle: (channel: string, fn: any) => ipcHandlers.set(channel, fn) },
  app: { focus: jest.fn() },
}));
jest.mock("@bitwarden/desktop-napi", () => ({}));
jest.mock("../../main/native-messaging.main", () => ({ NativeMessagingMain: class {} }));
jest.mock("../../main/window.main", () => ({ WindowMain: class {} }));
jest.mock("@bitwarden/sdk-internal", () => ({
  OutgoingMessage: {
    new_json_payload: (payload: unknown, destination: unknown, topic: string) => ({
      payload,
      destination,
      topic,
    }),
  },
}));

const CLIENT_ID = 7;
const OTHER_CLIENT_ID = 8;
const USER_ID = "user-1";

function hello(allowed: boolean, userId = USER_ID) {
  return {
    browser: "chrome",
    extensionVersion: "2026.10.0",
    activeUserId: userId,
    accounts: [{ userId, agentFillAllowed: allowed }],
  };
}

function source(clientId: number) {
  return { BrowserBackground: { id: { Id: clientId } } } as any;
}

const preparedTab = {
  ok: true,
  tabId: 42,
  domain: "www.delta.com",
  tabUrl: "https://www.delta.com/login",
  browser: "chrome",
  unlocked: true,
};

type Sent = { payload: any; destination: any; topic: string };

describe("MainAgentFillService", () => {
  let socketPath: string;
  let service: MainAgentFillService;
  let connections: AgentFillConnectionsService;
  let key: string;
  let connectionId: string;
  let messages$: Subject<any>;
  let disconnected$: Subject<number>;
  let activeAccount$: BehaviorSubject<{ id: string } | null>;
  let messagingService: jest.Mocked<MessageSender>;
  let sent: Sent[];
  let browser: (sent: Sent) => void;
  let approve: (request: any) => void;
  let approvalRequests: any[];
  let approvalCancels: any[];

  function receiveHello(clientId: number, body = hello(true)) {
    messages$.next({
      topic: AgentFillTopic.Hello,
      source: source(clientId),
      parse_payload_as_json: () => body,
    });
  }

  function reply(message: Sent, body: Record<string, unknown>) {
    const response = { requestId: message.payload.requestId, ...body };
    messages$.next({
      topic: AgentFillTopic.Response,
      source: source(message.destination.BrowserBackground.id.Id),
      parse_payload_as_json: () => response,
    });
  }

  function answerApproval(approvalRequest: any, response: unknown) {
    void ipcHandlers.get(AGENT_FILL_IPC_CHANNELS.APPROVAL_RESPONSE)!(
      {},
      { requestId: approvalRequest.requestId, response },
    );
  }

  function fillRequest(overrides: Record<string, unknown> = {}) {
    return {
      type: "fill",
      key,
      tool: "fill_login",
      url: "https://www.delta.com/login",
      ...overrides,
    };
  }

  function request(payload: Record<string, unknown>, onSocket?: (socket: any) => void) {
    return new Promise<any>((resolve, reject) => {
      const socket = connect(socketPath);
      let buffer = "";
      socket.setEncoding("utf8");
      socket.on("connect", () => socket.write(JSON.stringify({ id: 1, ...payload }) + "\n"));
      socket.on("data", (chunk: string) => {
        buffer += chunk;
        if (buffer.includes("\n")) {
          socket.destroy();
          resolve(JSON.parse(buffer.slice(0, buffer.indexOf("\n"))));
        }
      });
      socket.on("error", reject);
      onSocket?.(socket);
    });
  }

  const topics = () => sent.map((s) => s.topic);

  async function start(env: Record<string, string> = {}) {
    Object.assign(process.env, env);
    await service.init();
  }

  beforeEach(async () => {
    ipcHandlers.clear();
    socketPath = path.join(tmpdir(), `bw-agent-fill-spec-${process.pid}-${Date.now()}.sock`);
    process.env.BW_AGENT_FILL_SOCKET = socketPath;

    messages$ = new Subject();
    disconnected$ = new Subject();
    sent = [];
    approvalRequests = [];
    approvalCancels = [];
    browser = () => undefined;
    approve = () => undefined;

    const ipcService = {
      messages$,
      send: jest.fn(async (message: Sent) => {
        sent.push(message);
        // Answer asynchronously, like the real channel.
        setTimeout(() => browser(message), 0);
      }),
    } as unknown as IpcService;

    messagingService = mock<MessageSender>();
    messagingService.send.mockImplementation(((command: string, payload: any) => {
      if (command === AGENT_FILL_IPC_CHANNELS.APPROVAL_REQUEST) {
        approvalRequests.push(payload);
        setTimeout(() => approve(payload), 0);
      }
      if (command === AGENT_FILL_IPC_CHANNELS.APPROVAL_CANCEL) {
        approvalCancels.push(payload);
      }
    }) as any);

    const accountService = mock<AccountService>();
    activeAccount$ = new BehaviorSubject<{ id: string } | null>({ id: USER_ID });
    (accountService as any).activeAccount$ = activeAccount$;

    const globalStateProvider = new FakeGlobalStateProvider();
    connections = new AgentFillConnectionsService({
      getGlobal: (keyDefinition: any) => globalStateProvider.get(keyDefinition),
    } as unknown as StateProvider);
    const created = await connections.create("Claude Desktop");
    key = created.key;
    connectionId = created.connection.id;

    const nativeMessaging = { disconnected$ } as unknown as NativeMessagingMain;
    service = new MainAgentFillService(
      mock<LogService>(),
      messagingService,
      ipcService,
      nativeMessaging,
      { win: null } as unknown as WindowMain,
      accountService,
      connections,
    );
  });

  afterEach(() => {
    service.stop();
    delete process.env.BW_AGENT_FILL_SOCKET;
    delete process.env.BW_AGENT_FILL_APPROVAL_TIMEOUT_SECONDS;
  });

  describe("connection key", () => {
    beforeEach(async () => {
      await start();
      receiveHello(CLIENT_ID);
    });

    it("rejects a key that matches no saved connection", async () => {
      const result = await request(fillRequest({ key: "nope" }));

      expect(result).toMatchObject({ id: 1, ok: false, reason: "connection_key_invalid" });
      expect(sent).toEqual([]);
    });

    it("rejects a request without a key", async () => {
      const result = await request(fillRequest({ key: undefined }));

      expect(result).toMatchObject({ ok: false, reason: "connection_key_invalid" });
    });

    it("rejects a key once its connection is removed", async () => {
      await connections.remove(connectionId);

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "connection_key_invalid" });
    });

    it("refuses a paused connection without contacting a browser or opening a dialog", async () => {
      await connections.setPaused(connectionId, true);

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "connection_paused" });
      expect(sent).toEqual([]);
      expect(approvalRequests).toEqual([]);
    });

    it("serves the connection again after it is resumed", async () => {
      await connections.setPaused(connectionId, true);
      await connections.setPaused(connectionId, false);
      browser = (message) => reply(message, { ok: false, reason: "no_open_tab", message: "x" });

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "no_open_tab" });
    });

    it("rejects an unknown tool", async () => {
      const result = await request(fillRequest({ tool: "fill_note" }));

      expect(result).toMatchObject({ ok: false, reason: "error" });
    });

    it("rejects a request type other than fill", async () => {
      const result = await request(fillRequest({ type: "ping" }));

      expect(result).toMatchObject({ ok: false, reason: "error" });
    });
  });

  describe("fill", () => {
    beforeEach(async () => {
      await start();
      receiveHello(CLIENT_ID);
      browser = (message) => {
        if (message.topic === AgentFillTopic.PrepareFill) {
          reply(message, preparedTab);
        } else if (message.topic === AgentFillTopic.FillItem) {
          reply(message, { ok: true });
        }
      };
    });

    it("prepares, approves, and fills a login", async () => {
      approve = (req) =>
        answerApproval(req, {
          decision: "approved",
          cipherId: "cipher-1",
          itemName: "Delta",
          username: "jane@example.com",
        });

      const result = await request(fillRequest({ url: "https://www.delta.com/login?x=1" }));

      expect(result).toEqual({
        id: 1,
        ok: true,
        result: { status: "filled", item: "Delta", username: "jane@example.com" },
      });
      expect(approvalRequests[0]).toMatchObject({
        connectionName: "Claude Desktop",
        domain: "www.delta.com",
        browser: "Chrome",
        cipherType: 1,
      });
      const [prepare, fill] = sent;
      expect(prepare.topic).toBe(AgentFillTopic.PrepareFill);
      expect(fill.topic).toBe(AgentFillTopic.FillItem);
      expect(fill.destination).toEqual({ BrowserBackground: { id: { Id: CLIENT_ID } } });
      expect(prepare.payload).toMatchObject({
        userId: USER_ID,
        url: "https://www.delta.com/login?x=1",
        connectionName: "Claude Desktop",
      });
      expect(fill.payload).toMatchObject({
        userId: USER_ID,
        tabId: 42,
        expectedDomain: "www.delta.com",
        cipherId: "cipher-1",
        cipherType: 1,
      });
      expect(fill.payload.approvalId).toBe(prepare.payload.approvalId);
      expect(approvalRequests[0].requestId).toBe(prepare.payload.approvalId);
    });

    it("returns only the name and last four for a card", async () => {
      approve = (req) =>
        answerApproval(req, {
          decision: "approved",
          cipherId: "card-1",
          itemName: "Visa",
          lastFour: "4242",
        });

      const result = await request(fillRequest({ tool: "fill_card" }));

      expect(result).toEqual({
        id: 1,
        ok: true,
        result: { status: "filled", item: "Visa", last_four: "4242" },
      });
      expect(sent[1].payload.cipherType).toBe(3);
    });

    it("tells every asked browser the request is closed once it ends", async () => {
      approve = (req) =>
        answerApproval(req, { decision: "approved", cipherId: "c", itemName: "Delta" });

      await request(fillRequest());

      const closed = sent.filter((s) => s.topic === AgentFillTopic.RequestClosed);
      expect(closed).toHaveLength(1);
      expect(closed[0].payload).toEqual({ approvalId: sent[0].payload.approvalId });
    });

    it("returns a plain denial without filling and closes the request", async () => {
      approve = (req) => answerApproval(req, { decision: "denied" });

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "denied" });
      expect(topics()).toEqual([AgentFillTopic.PrepareFill, AgentFillTopic.RequestClosed]);
      expect((await connections.get(connectionId))?.paused).toBe(false);
    });

    it("returns the wrong account reason without pausing", async () => {
      approve = (req) => answerApproval(req, { decision: "denied", reason: "wrong_account" });

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "denied_wrong_account" });
      expect((await connections.get(connectionId))?.paused).toBe(false);
    });

    it("pauses the connection when the user did not ask for the fill", async () => {
      approve = (req) => answerApproval(req, { decision: "denied", reason: "not_requested" });

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "denied_not_requested" });
      expect((await connections.get(connectionId))?.paused).toBe(true);

      const next = await request(fillRequest());
      expect(next).toMatchObject({ ok: false, reason: "connection_paused" });
    });

    it("passes through the extension's no-tab failure without asking for approval", async () => {
      browser = (message) =>
        reply(message, { ok: false, reason: "no_open_tab", message: "No open tab for this site." });

      const result = await request(fillRequest({ url: "https://nowhere.example/" }));

      expect(result).toMatchObject({ ok: false, reason: "no_open_tab" });
      expect(approvalRequests).toEqual([]);
    });

    it("passes through the extension's wrong site failure at fill", async () => {
      browser = (message) =>
        message.topic === AgentFillTopic.PrepareFill
          ? reply(message, preparedTab)
          : reply(message, { ok: false, reason: "wrong_site", message: "The tab left the site." });
      approve = (req) =>
        answerApproval(req, { decision: "approved", cipherId: "c", itemName: "Delta" });

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "wrong_site" });
    });

    it("answers locked when the extension is locked, without opening a dialog", async () => {
      browser = (message) => reply(message, { ...preparedTab, unlocked: false });

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "locked" });
      expect(approvalRequests).toEqual([]);
    });

    it("answers locked when no account is signed in to the desktop app", async () => {
      activeAccount$.next(null);

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "locked" });
      expect(sent).toEqual([]);
    });

    it("passes through a failure from the renderer", async () => {
      approve = (req) =>
        answerApproval(req, {
          decision: "failed",
          reason: "no_matching_item",
          message: "No login in the vault matches this site.",
        });

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "no_matching_item" });
      expect(topics()).not.toContain(AgentFillTopic.FillItem);
    });

    it("answers busy to a second call while an approval is pending", async () => {
      let release: () => void = () => undefined;
      approve = (req) => {
        release = () =>
          answerApproval(req, { decision: "approved", cipherId: "c", itemName: "Delta" });
      };

      const first = request(fillRequest());
      await waitFor(() => approvalRequests.length === 1);
      const second = await request(fillRequest());
      release();

      expect(second).toMatchObject({ ok: false, reason: "busy" });
      expect(await first).toMatchObject({ ok: true });
    });

    it("expires an unanswered request, cancels the dialog and closes the request", async () => {
      await restart({ BW_AGENT_FILL_APPROVAL_TIMEOUT_SECONDS: "0.05" });
      approve = () => undefined;

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "expired" });
      expect(approvalCancels).toEqual([{ requestId: approvalRequests[0].requestId }]);
      expect(topics()).toContain(AgentFillTopic.RequestClosed);
      expect(topics()).not.toContain(AgentFillTopic.FillItem);
    });

    it("cancels a pending approval when the connector disconnects", async () => {
      approve = () => undefined;

      let connectorSocket: any;
      void request(fillRequest(), (socket) => (connectorSocket = socket)).catch(() => undefined);
      await waitFor(() => approvalRequests.length === 1);
      connectorSocket.destroy();
      await waitFor(() => approvalCancels.length === 1);

      expect(approvalCancels).toEqual([{ requestId: approvalRequests[0].requestId }]);
      await waitFor(() => topics().includes(AgentFillTopic.RequestClosed));
      // The hub is free again for the next call.
      browser = (message) => reply(message, { ok: false, reason: "no_open_tab", message: "x" });
      expect(await request(fillRequest())).toMatchObject({ reason: "no_open_tab" });
    });

    it("answers browser_unreachable when the chosen browser does not answer", async () => {
      jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick"] });
      try {
        browser = () => undefined;
        const pending = request(fillRequest());
        await waitFor(() => sent.length === 1, true);
        await jest.advanceTimersByTimeAsync(10_001);

        expect(await pending).toMatchObject({ ok: false, reason: "browser_unreachable" });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("browsers", () => {
    beforeEach(async () => {
      await start();
    });

    it("answers browser_unreachable when no extension has said hello", async () => {
      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "browser_unreachable" });
    });

    it.each([
      ["the setting is off", () => receiveHello(CLIENT_ID, hello(false))],
      [
        "only another account allows agent fills",
        () => receiveHello(CLIENT_ID, hello(true, "user-2")),
      ],
    ])("fails with no_allowed_browser when %s, without asking any browser", async (_, arrange) => {
      arrange();

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "no_allowed_browser" });
      expect(sent).toEqual([]);
      expect(approvalRequests).toEqual([]);
    });

    it("sends PrepareFill only to browsers that allow agent fills for the account", async () => {
      receiveHello(CLIENT_ID);
      receiveHello(OTHER_CLIENT_ID, hello(false));
      browser = (message) =>
        reply(message, { ok: false, reason: "no_open_tab", message: "No open tab." });

      await request(fillRequest());

      const prepares = sent.filter((s) => s.topic === AgentFillTopic.PrepareFill);
      expect(prepares.map((s) => s.destination.BrowserBackground.id.Id)).toEqual([CLIENT_ID]);
    });

    it("uses the first browser that finds the tab", async () => {
      receiveHello(CLIENT_ID);
      receiveHello(OTHER_CLIENT_ID);
      browser = (message) => {
        const clientId = message.destination.BrowserBackground.id.Id;
        if (message.topic === AgentFillTopic.PrepareFill) {
          reply(
            message,
            clientId === OTHER_CLIENT_ID
              ? preparedTab
              : { ok: false, reason: "no_open_tab", message: "No open tab." },
          );
        } else if (message.topic === AgentFillTopic.FillItem) {
          reply(message, { ok: true });
        }
      };
      approve = (req) =>
        answerApproval(req, { decision: "approved", cipherId: "c", itemName: "Delta" });

      await request(fillRequest());

      const fill = sent.find((s) => s.topic === AgentFillTopic.FillItem)!;
      expect(fill.destination).toEqual({ BrowserBackground: { id: { Id: OTHER_CLIENT_ID } } });
    });

    it("stops routing to a browser once it disconnects", async () => {
      receiveHello(CLIENT_ID);
      disconnected$.next(CLIENT_ID);

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "browser_unreachable" });
      expect(sent).toEqual([]);
    });

    it("ignores a Hello from a source that is not a browser background page", async () => {
      messages$.next({
        topic: AgentFillTopic.Hello,
        source: "DesktopRenderer",
        parse_payload_as_json: () => hello(true),
      });

      const result = await request(fillRequest());

      expect(result).toMatchObject({ ok: false, reason: "browser_unreachable" });
    });

    it("ignores a response that comes from a different browser than the one asked", async () => {
      receiveHello(CLIENT_ID);
      approve = () => undefined;
      browser = (message) => {
        // A response forged by another connection must not be accepted.
        messages$.next({
          topic: AgentFillTopic.Response,
          source: source(OTHER_CLIENT_ID),
          parse_payload_as_json: () => ({ requestId: message.payload.requestId, ...preparedTab }),
        });
      };
      jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick"] });
      try {
        const pending = request(fillRequest());
        await waitFor(() => sent.length === 1, true);
        await jest.advanceTimersByTimeAsync(10_001);

        expect(await pending).toMatchObject({ ok: false, reason: "browser_unreachable" });
        expect(approvalRequests).toEqual([]);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  async function restart(env: Record<string, string>) {
    service.stop();
    await start(env);
    receiveHello(CLIENT_ID);
  }
});

async function waitFor(condition: () => boolean, fake = false) {
  for (let i = 0; i < 200 && !condition(); i++) {
    if (fake) {
      await jest.advanceTimersByTimeAsync(1);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  expect(condition()).toBe(true);
}
