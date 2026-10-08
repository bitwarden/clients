import { randomUUID } from "crypto";
import { existsSync, promises as fs } from "fs";
import { createServer, Server, Socket } from "net";
import { homedir } from "os";
import * as path from "path";

import { app, ipcMain } from "electron";
import { filter, firstValueFrom, Subscription } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import {
  AgentFillCipherType,
  AgentFillFailure,
  AgentFillFailureReason,
  AgentFillResponse,
  AgentFillTopic,
  FillItemRequest,
  FillItemResponse,
  PrepareFillRequest,
  PrepareFillResponse,
  PrepareFillSuccess,
  RequestClosedMessage,
} from "@bitwarden/common/autofill/agent-fill/agent-fill-ipc";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Endpoint, OutgoingMessage, Source } from "@bitwarden/sdk-internal";

import { NativeMessagingMain } from "../../main/native-messaging.main";
import { WindowMain } from "../../main/window.main";
import {
  AgentFillApprovalRequest,
  AgentFillApprovalResponse,
  AgentFillDenyReason,
} from "../models/agent-fill-approval";
import { AgentFillConnectionView } from "../models/agent-fill-connection";
import { AGENT_FILL_IPC_CHANNELS } from "../models/ipc-channels";

import { AgentFillBrowserRegistry } from "./agent-fill-browser-registry";
import { AgentFillConnectionsService } from "./agent-fill-connections.service";

const PREPARE_FILL_TIMEOUT_MS = 10_000;
const FILL_ITEM_TIMEOUT_MS = 20_000;
/** A request left unanswered this long expires. */
const DEFAULT_APPROVAL_TIMEOUT_MS = 300_000;
const MAX_LINE_BYTES = 64 * 1024;

const FillTool = Object.freeze({ Login: "fill_login", Card: "fill_card" } as const);
type FillTool = (typeof FillTool)[keyof typeof FillTool];

/** One JSON line from the connector. */
type ConnectorRequest = {
  id?: string | number;
  type?: "fill";
  key?: string;
  tool?: FillTool;
  url?: string;
};

type ConnectorResult = Record<string, unknown>;

class AgentFillError extends Error {
  constructor(
    readonly reason: AgentFillFailureReason,
    message: string,
  ) {
    super(message);
  }
}

/**
 * The socket the connector uses. Overridable with `BW_AGENT_FILL_SOCKET`; the connector has the
 * same default. Kept outside the installed app's data directories so it never touches them.
 */
export function agentFillSocketPath(): string {
  if (process.env.BW_AGENT_FILL_SOCKET) {
    return process.env.BW_AGENT_FILL_SOCKET;
  }
  return process.platform === "win32"
    ? "\\\\.\\pipe\\bitwarden-agent-fill"
    : path.join(homedir(), ".bitwarden-agent-fill.sock");
}

/**
 * The agent fill hub. Listens on a local socket for fill requests from the Bitwarden connector,
 * finds the calling connection by its key, asks the connected extension to locate the tab, shows
 * the approval dialog in the renderer, and on approval tells the extension to fill. Only the item
 * name and username (or card last four) go back to the connector.
 *
 * All agent fill state lives here: Platform's {@link IpcService} and {@link NativeMessagingMain}
 * only provide generic message and disconnect events.
 */
export class MainAgentFillService {
  private server?: Server;
  private approvalTimeoutMs = DEFAULT_APPROVAL_TIMEOUT_MS;
  private busy = false;

  private readonly browserRegistry = new AgentFillBrowserRegistry();
  private subscriptions: Subscription[] = [];
  private pendingBrowserResponses = new Map<
    string,
    { clientId: number; resolve: (response: AgentFillResponse) => void }
  >();
  private pendingApprovals = new Map<string, (response: AgentFillApprovalResponse) => void>();

  constructor(
    private logService: LogService,
    private messagingService: MessageSender,
    private ipcService: IpcService,
    private nativeMessaging: NativeMessagingMain,
    private windowMain: WindowMain,
    private accountService: AccountService,
    private connectionsService: AgentFillConnectionsService,
  ) {
    ipcMain.handle(
      AGENT_FILL_IPC_CHANNELS.APPROVAL_RESPONSE,
      async (
        _event,
        { requestId, response }: { requestId: string; response: AgentFillApprovalResponse },
      ) => {
        this.pendingApprovals.get(requestId)?.(response);
        this.pendingApprovals.delete(requestId);
      },
    );
  }

  /** Must run after {@link IpcService.init}. */
  async init() {
    const timeoutSeconds = Number(process.env.BW_AGENT_FILL_APPROVAL_TIMEOUT_SECONDS);
    if (Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) {
      this.approvalTimeoutMs = timeoutSeconds * 1000;
    }

    try {
      this.subscribeToBrowsers();
      await this.listen(agentFillSocketPath());
    } catch (e) {
      this.logService.error("[AgentFill] Failed to start", e);
    }
  }

  stop() {
    this.server?.close();
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];
  }

  private async listen(socketPath: string) {
    if (process.platform !== "win32" && existsSync(socketPath)) {
      // A stale socket from a previous run blocks listen().
      await fs.unlink(socketPath);
    }

    this.server = createServer((socket) => this.onConnection(socket));
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(socketPath, () => resolve());
    });
    if (process.platform !== "win32") {
      await fs.chmod(socketPath, 0o600);
    }
    this.server.on("error", (e) => this.logService.error("[AgentFill] Socket error", e));
    this.logService.info(`[AgentFill] Listening at ${socketPath}`);
  }

  private onConnection(socket: Socket) {
    // The connector closes its socket when Claude cancels the tool call; drop any open dialog then.
    const closed = new AbortController();
    socket.on("close", () => closed.abort());
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > MAX_LINE_BYTES) {
        socket.destroy();
        return;
      }
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line.length > 0) {
          void this.onLine(socket, line, closed.signal);
        }
      }
    });
    socket.on("error", (e) => this.logService.warning("[AgentFill] Connector socket error", e));
  }

  private async onLine(socket: Socket, line: string, closed: AbortSignal) {
    let request: ConnectorRequest;
    try {
      request = JSON.parse(line);
    } catch {
      this.write(socket, { ok: false, reason: AgentFillFailureReason.Error, message: "Bad JSON." });
      return;
    }

    const id = request?.id ?? null;
    try {
      const connection = await this.connectionsService.findByKey(request?.key);
      if (connection == null) {
        throw new AgentFillError(
          AgentFillFailureReason.ConnectionKeyInvalid,
          "Connection key invalid.",
        );
      }
      if (connection.paused) {
        throw new AgentFillError(
          AgentFillFailureReason.ConnectionPaused,
          "The user paused this connection in the Bitwarden desktop app.",
        );
      }

      const result = await this.fill(connection, request, closed);
      this.write(socket, { id, ok: true, result });
    } catch (e) {
      const error =
        e instanceof AgentFillError
          ? e
          : new AgentFillError(AgentFillFailureReason.Error, "Bitwarden hit an error.");
      if (!(e instanceof AgentFillError)) {
        this.logService.error("[AgentFill] Fill failed", e);
      }
      this.logService.info(`[AgentFill] Request ${id} failed: ${error.reason}`);
      this.write(socket, { id, ok: false, reason: error.reason, message: error.message });
    }
  }

  private async fill(
    connection: AgentFillConnectionView,
    request: ConnectorRequest,
    closed: AbortSignal,
  ): Promise<ConnectorResult> {
    const cipherType: AgentFillCipherType | undefined =
      request.type === "fill" && request.tool === FillTool.Login
        ? CipherType.Login
        : request.type === "fill" && request.tool === FillTool.Card
          ? CipherType.Card
          : undefined;
    if (cipherType == null || typeof request.url !== "string") {
      throw new AgentFillError(AgentFillFailureReason.Error, "Unknown tool or missing url.");
    }

    // One approval at a time.
    if (this.busy) {
      throw new AgentFillError(
        AgentFillFailureReason.Busy,
        "Another fill is waiting for approval.",
      );
    }
    this.busy = true;

    const approvalId = randomUUID();
    // Browsers that may now show this request as pending in their popup.
    let asked: number[] = [];
    try {
      this.logService.info(`[AgentFill] ${request.tool} request ${approvalId}`);

      // The request's user is the desktop app's active account.
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(getOptionalUserId),
      );
      if (userId == null) {
        throw new AgentFillError(
          AgentFillFailureReason.Locked,
          "No account is signed in to the Bitwarden desktop app.",
        );
      }

      asked = this.browserRegistry.allowedFor(userId);
      const { clientId, prepared } = await this.prepareFill(
        approvalId,
        connection,
        request.url,
        userId,
      );
      if (!prepared.unlocked) {
        throw new AgentFillError(
          AgentFillFailureReason.Locked,
          `Bitwarden is locked in ${displayBrowser(prepared.browser)}.`,
        );
      }

      const approval = await this.requestApproval(
        {
          requestId: approvalId,
          connectionName: connection.name,
          domain: prepared.domain,
          tabUrl: prepared.tabUrl,
          browser: displayBrowser(prepared.browser),
          cipherType,
        },
        closed,
      );

      if (approval.decision === "failed") {
        throw new AgentFillError(approval.reason, approval.message);
      }
      if (approval.decision === "denied") {
        if (approval.reason === AgentFillDenyReason.NotRequested) {
          // The user did not ask for this: stop the connection before telling the agent.
          await this.connectionsService.setPaused(connection.id, true);
          this.logService.info(`[AgentFill] Connection ${connection.id} paused by the user`);
        }
        throw deniedError(approval.reason);
      }

      const filled = await this.sendToBrowser<FillItemRequest, FillItemResponse>(
        clientId,
        AgentFillTopic.FillItem,
        {
          requestId: randomUUID(),
          approvalId,
          userId,
          tabId: prepared.tabId,
          expectedDomain: prepared.domain,
          cipherId: approval.cipherId,
          cipherType,
        },
        FILL_ITEM_TIMEOUT_MS,
      );
      if (isFailure(filled)) {
        throw new AgentFillError(filled.reason, filled.message);
      }

      this.logService.info(`[AgentFill] Request ${approvalId} filled`);
      return cipherType === CipherType.Card
        ? { status: "filled", item: approval.itemName, last_four: approval.lastFour ?? null }
        : { status: "filled", item: approval.itemName, username: approval.username ?? null };
    } finally {
      // However the request ended, no browser should keep showing it as pending.
      await Promise.all(asked.map((clientId) => this.sendRequestClosed(clientId, approvalId)));
      this.busy = false;
    }
  }

  /**
   * Asks every connected extension whose latest Hello allows agent fills for the user to locate
   * the tab, and uses the first that finds one.
   */
  private async prepareFill(
    approvalId: string,
    connection: AgentFillConnectionView,
    url: string,
    userId: string,
  ): Promise<{ clientId: number; prepared: PrepareFillSuccess }> {
    if (this.browserRegistry.list().length === 0) {
      throw new AgentFillError(
        AgentFillFailureReason.BrowserUnreachable,
        "No Bitwarden browser extension is connected to the desktop app.",
      );
    }
    const clients = this.browserRegistry.allowedFor(userId);
    if (clients.length === 0) {
      throw new AgentFillError(
        AgentFillFailureReason.NoAllowedBrowser,
        "No browser is set to allow agent fills for this account.",
      );
    }

    const responses = await Promise.all(
      clients.map(async (clientId) => {
        try {
          const response = await this.sendToBrowser<PrepareFillRequest, PrepareFillResponse>(
            clientId,
            AgentFillTopic.PrepareFill,
            { requestId: randomUUID(), approvalId, userId, url, connectionName: connection.name },
            PREPARE_FILL_TIMEOUT_MS,
          );
          return { clientId, response };
        } catch (e) {
          this.logService.warning(`[AgentFill] Browser client ${clientId} did not answer`, e);
          return { clientId, response: null };
        }
      }),
    );

    for (const { clientId, response } of responses) {
      if (response != null && !isFailure(response)) {
        return { clientId, prepared: response };
      }
    }
    const failure = responses.map((r) => r.response).find((r) => r != null);
    if (failure != null && isFailure(failure)) {
      throw new AgentFillError(failure.reason, failure.message);
    }
    throw new AgentFillError(
      AgentFillFailureReason.BrowserUnreachable,
      "The browser extension did not answer.",
    );
  }

  private requestApproval(
    request: AgentFillApprovalRequest,
    closed: AbortSignal,
  ): Promise<AgentFillApprovalResponse> {
    if (closed.aborted) {
      return Promise.resolve({
        decision: "failed",
        reason: AgentFillFailureReason.Expired,
        message: "The agent stopped waiting for approval.",
      });
    }

    this.bringWindowToFront();
    return new Promise((resolve) => {
      const expire = (message: string) => {
        if (this.pendingApprovals.delete(request.requestId)) {
          this.messagingService.send(AGENT_FILL_IPC_CHANNELS.APPROVAL_CANCEL, {
            requestId: request.requestId,
          });
          resolve({ decision: "failed", reason: AgentFillFailureReason.Expired, message });
        }
      };
      const timer = setTimeout(
        () => expire("The approval request expired."),
        this.approvalTimeoutMs,
      );
      const onClosed = () => expire("The agent stopped waiting for approval.");
      closed.addEventListener("abort", onClosed, { once: true });

      this.pendingApprovals.set(request.requestId, (response) => {
        clearTimeout(timer);
        closed.removeEventListener("abort", onClosed);
        resolve(response);
      });
      this.messagingService.send(AGENT_FILL_IPC_CHANNELS.APPROVAL_REQUEST, request);
    });
  }

  private bringWindowToFront() {
    const win = this.windowMain.win;
    if (win == null) {
      return;
    }
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
    if (process.platform === "darwin") {
      app.focus({ steal: true });
    }
  }

  private subscribeToBrowsers() {
    this.subscriptions.push(
      this.ipcService.messages$
        .pipe(filter((message) => message.topic === AgentFillTopic.Hello))
        .subscribe((message) => {
          try {
            const clientId = this.browserRegistry.hello(
              message.source,
              message.parse_payload_as_json(),
            );
            if (clientId != null) {
              this.logService.info(`[AgentFill] Hello from browser client ${clientId}`);
            }
          } catch (e) {
            this.logService.warning("[AgentFill] Ignoring a malformed Hello", e);
          }
        }),
      this.ipcService.messages$
        .pipe(filter((message) => message.topic === AgentFillTopic.Response))
        .subscribe((message) => {
          const clientId = browserClientId(message.source);
          let response: AgentFillResponse;
          try {
            response = message.parse_payload_as_json();
          } catch {
            return;
          }
          const pending = this.pendingBrowserResponses.get(response?.requestId);
          if (pending == null || pending.clientId !== clientId) {
            return;
          }
          this.pendingBrowserResponses.delete(response.requestId);
          pending.resolve(response);
        }),
      this.nativeMessaging.disconnected$.subscribe((clientId) => {
        if (this.browserRegistry.remove(clientId)) {
          this.logService.info(`[AgentFill] Browser client ${clientId} disconnected`);
        }
      }),
    );
  }

  private async sendRequestClosed(clientId: number, approvalId: string) {
    try {
      await this.ipcService.send(
        OutgoingMessage.new_json_payload(
          { approvalId } satisfies RequestClosedMessage,
          { BrowserBackground: { id: { Id: clientId } } } satisfies Endpoint,
          AgentFillTopic.RequestClosed,
        ),
      );
    } catch (e) {
      this.logService.warning(
        `[AgentFill] Could not close request on browser client ${clientId}`,
        e,
      );
    }
  }

  private async sendToBrowser<TRequest extends { requestId: string }, TResponse>(
    clientId: number,
    topic: AgentFillTopic,
    request: TRequest,
    timeoutMs: number,
  ): Promise<TResponse> {
    const destination: Endpoint = { BrowserBackground: { id: { Id: clientId } } };
    const response = new Promise<AgentFillResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingBrowserResponses.delete(request.requestId);
        reject(
          new AgentFillError(
            AgentFillFailureReason.BrowserUnreachable,
            "The browser extension did not answer in time.",
          ),
        );
      }, timeoutMs);
      this.pendingBrowserResponses.set(request.requestId, {
        clientId,
        resolve: (r) => {
          clearTimeout(timer);
          resolve(r);
        },
      });
    });

    try {
      await this.ipcService.send(OutgoingMessage.new_json_payload(request, destination, topic));
    } catch (e) {
      this.logService.warning(`[AgentFill] Send to browser client ${clientId} failed`, e);
      this.pendingBrowserResponses.delete(request.requestId);
      throw new AgentFillError(
        AgentFillFailureReason.BrowserUnreachable,
        "Could not reach the browser extension.",
      );
    }
    return (await response) as TResponse;
  }

  private write(socket: Socket, payload: Record<string, unknown>) {
    if (!socket.destroyed) {
      socket.write(JSON.stringify(payload) + "\n");
    }
  }
}

function isFailure(response: AgentFillResponse): response is AgentFillFailure {
  return response.ok === false;
}

function browserClientId(source: Source): number | null {
  if (typeof source === "object" && "BrowserBackground" in source) {
    const id = source.BrowserBackground.id;
    return typeof id === "object" && "Id" in id ? id.Id : null;
  }
  return null;
}

function displayBrowser(browser: string): string {
  return browser.length > 0 ? browser[0].toUpperCase() + browser.slice(1) : browser;
}

function deniedError(reason: AgentFillDenyReason | undefined): AgentFillError {
  switch (reason) {
    case AgentFillDenyReason.WrongAccount:
      return new AgentFillError(
        AgentFillFailureReason.DeniedWrongAccount,
        "The user denied the request: wrong account.",
      );
    case AgentFillDenyReason.NotRequested:
      return new AgentFillError(
        AgentFillFailureReason.DeniedNotRequested,
        "The user denied the request: they did not ask for this.",
      );
    default:
      return new AgentFillError(AgentFillFailureReason.Denied, "The user denied the request.");
  }
}
