import { createHash } from "crypto";
import { connect } from "net";
import { tmpdir } from "os";
import * as path from "path";

import { mock } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AgentFillTopic } from "@bitwarden/common/autofill/agent-fill/agent-fill-ipc";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";

import { WindowMain } from "../../main/window.main";
import { IpcMainService } from "../../platform/services/ipc.main.service";
import { AGENT_FILL_IPC_CHANNELS } from "../models/ipc-channels";

import { AgentFillBrowserRegistry } from "./agent-fill-browser-registry";
import { MainAgentFillService } from "./main-agent-fill.service";

const ipcHandlers = new Map<string, (...args: any[]) => any>();

jest.mock("electron", () => ({
  ipcMain: { handle: (channel: string, fn: any) => ipcHandlers.set(channel, fn) },
  app: { focus: jest.fn() },
}));
jest.mock("@bitwarden/desktop-napi", () => ({}));
jest.mock("../../platform/services/ipc.main.service", () => ({ IpcMainService: class {} }));
jest.mock("../../main/window.main", () => ({ WindowMain: class {} }));
jest.mock("../../utils", () => ({ isDev: () => false }));
jest.mock("@bitwarden/sdk-internal", () => ({
  OutgoingMessage: {
    new_json_payload: (payload: unknown, destination: unknown, topic: string) => ({
      payload,
      destination,
      topic,
    }),
  },
}));

const KEY = "test-connection-key";
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

type Sent = { payload: any; destination: any; topic: string };

describe("MainAgentFillService (prototype)", () => {
  let socketPath: string;
  let service: MainAgentFillService;
  let messages$: Subject<any>;
  let messagingService: jest.Mocked<MessageSender>;
  let browser: (sent: Sent) => any;
  let registry: AgentFillBrowserRegistry;

  function reply(sent: Sent, body: Record<string, unknown>) {
    const response = { requestId: sent.payload.requestId, ...body };
    messages$.next({
      topic: AgentFillTopic.Response,
      source: { BrowserBackground: { id: { Id: sent.destination.BrowserBackground.id.Id } } },
      parse_payload_as_json: () => response,
    });
  }

  function request(payload: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
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
    });
  }

  beforeEach(async () => {
    socketPath = path.join(tmpdir(), `bw-agent-fill-spec-${process.pid}-${Date.now()}.sock`);
    process.env.BW_AGENT_FILL_SOCKET = socketPath;
    process.env.BW_AGENT_FILL_KEY_SHA256 = createHash("sha256").update(KEY).digest("hex");

    messages$ = new Subject();
    browser = () => undefined;
    registry = new AgentFillBrowserRegistry();
    registry.seen(CLIENT_ID);
    registry.hello(source(CLIENT_ID), hello(true));
    const ipcService = {
      get browserClients() {
        return registry.list().map((c) => c.clientId);
      },
      browserRegistry: registry,
      messages$,
      send: jest.fn(async (sent: Sent) => {
        // Answer asynchronously, like the real channel.
        setTimeout(() => browser(sent), 0);
      }),
    } as unknown as IpcMainService;

    messagingService = mock<MessageSender>();
    messagingService.send.mockImplementation(((command: string, payload: any) => {
      if (command === AGENT_FILL_IPC_CHANNELS.APPROVAL_REQUEST) {
        setTimeout(() => approve(payload), 0);
      }
    }) as any);

    const accountService = mock<AccountService>();
    (accountService as any).activeAccount$ = new BehaviorSubject({ id: USER_ID });

    service = new MainAgentFillService(
      mock<LogService>(),
      messagingService,
      ipcService,
      { win: null } as unknown as WindowMain,
      accountService,
    );
    await service.init();
  });

  afterEach(() => {
    service.stop();
    delete process.env.BW_AGENT_FILL_SOCKET;
    delete process.env.BW_AGENT_FILL_KEY_SHA256;
  });

  let approve: (request: any) => void;

  function answerApproval(request: any, response: unknown) {
    void ipcHandlers.get(AGENT_FILL_IPC_CHANNELS.APPROVAL_RESPONSE)!(
      {},
      { requestId: request.requestId, response },
    );
  }

  it("rejects a wrong connection key", async () => {
    const result = await request({ type: "fill", key: "nope", tool: "fill_login", url: "x" });
    expect(result).toMatchObject({ id: 1, ok: false, reason: "connection_key_invalid" });
  });

  it("answers ping with the connection name", async () => {
    const result = await request({ type: "ping", key: KEY });
    expect(result).toEqual({
      id: 1,
      ok: true,
      result: {
        connectionName: "Claude Desktop",
        browsersConnected: 1,
        browsersAllowingAgentFill: 1,
      },
    });
  });

  it("prepares, approves, and fills a login", async () => {
    const seen: Sent[] = [];
    let approvalRequest: any;
    browser = (sent) => {
      seen.push(sent);
      if (sent.topic === AgentFillTopic.PrepareFill) {
        reply(sent, {
          ok: true,
          tabId: 42,
          domain: "www.delta.com",
          tabUrl: "https://www.delta.com/login",
          browser: "chrome",
          unlocked: true,
        });
      } else {
        reply(sent, { ok: true });
      }
    };
    approve = (req) => {
      approvalRequest = req;
      answerApproval(req, {
        decision: "approved",
        cipherId: "cipher-1",
        itemName: "Delta",
        username: "jane@example.com",
      });
    };

    const result = await request({
      type: "fill",
      key: KEY,
      tool: "fill_login",
      url: "https://www.delta.com/login?x=1",
    });

    expect(result).toEqual({
      id: 1,
      ok: true,
      result: { status: "filled", item: "Delta", username: "jane@example.com" },
    });
    expect(approvalRequest).toMatchObject({
      connectionName: "Claude Desktop",
      domain: "www.delta.com",
      browser: "Chrome",
      cipherType: 1,
    });
    expect(seen.map((s) => s.topic)).toEqual([AgentFillTopic.PrepareFill, AgentFillTopic.FillItem]);
    expect(seen[1].destination).toEqual({ BrowserBackground: { id: { Id: CLIENT_ID } } });
    expect(seen[0].payload).toMatchObject({ userId: USER_ID });
    expect(seen[1].payload).toMatchObject({
      userId: USER_ID,
      tabId: 42,
      expectedDomain: "www.delta.com",
      cipherId: "cipher-1",
      cipherType: 1,
    });
  });

  it("returns the deny reason without filling", async () => {
    const topics: string[] = [];
    browser = (sent) => {
      topics.push(sent.topic);
      reply(sent, {
        ok: true,
        tabId: 1,
        domain: "shop.example.com",
        tabUrl: "https://shop.example.com/",
        browser: "chrome",
        unlocked: true,
      });
    };
    approve = (req) => answerApproval(req, { decision: "denied", reason: "not_requested" });

    const result = await request({
      type: "fill",
      key: KEY,
      tool: "fill_card",
      url: "https://shop.example.com/",
    });

    expect(result).toMatchObject({ ok: false, reason: "denied_not_requested" });
    expect(topics).toEqual([AgentFillTopic.PrepareFill]);
  });

  it("passes through the extension's no-tab failure without asking for approval", async () => {
    browser = (sent) =>
      reply(sent, { ok: false, reason: "no_open_tab", message: "No open tab for this site." });
    approve = jest.fn();

    const result = await request({
      type: "fill",
      key: KEY,
      tool: "fill_login",
      url: "https://nowhere.example/",
    });

    expect(result).toMatchObject({ ok: false, reason: "no_open_tab" });
    expect(approve).not.toHaveBeenCalled();
  });

  it.each([
    ["the setting is off", () => registry.hello(source(CLIENT_ID), hello(false))],
    [
      "only another account allows agent fills",
      () => registry.hello(source(CLIENT_ID), hello(true, "user-2")),
    ],
    [
      "the browser has not sent a Hello yet",
      () => {
        registry.remove(CLIENT_ID);
        registry.seen(CLIENT_ID);
      },
    ],
  ])("fails with no_allowed_browser when %s, without asking any browser", async (_, arrange) => {
    arrange();
    const topics: string[] = [];
    browser = (sent) => topics.push(sent.topic);
    approve = jest.fn();

    const result = await request({
      type: "fill",
      key: KEY,
      tool: "fill_login",
      url: "https://www.delta.com/",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "no_allowed_browser",
      message: "No browser is set to allow agent fills for this account.",
    });
    expect(topics).toEqual([]);
    expect(approve).not.toHaveBeenCalled();
  });

  it("sends PrepareFill only to browsers that allow agent fills for the account", async () => {
    registry.seen(OTHER_CLIENT_ID);
    registry.hello(source(OTHER_CLIENT_ID), hello(false));
    const destinations: number[] = [];
    browser = (sent) => {
      destinations.push(sent.destination.BrowserBackground.id.Id);
      reply(sent, { ok: false, reason: "no_open_tab", message: "No open tab for this site." });
    };

    await request({ type: "fill", key: KEY, tool: "fill_login", url: "https://x.example/" });

    expect(destinations).toEqual([CLIENT_ID]);
  });

  it("stops routing to a browser once its connection is pruned", async () => {
    registry.remove(CLIENT_ID);

    const result = await request({
      type: "fill",
      key: KEY,
      tool: "fill_login",
      url: "https://www.delta.com/",
    });

    expect(result).toMatchObject({ ok: false, reason: "browser_unreachable" });
  });
});
