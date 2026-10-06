import { createHash, randomUUID, timingSafeEqual } from "crypto";
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
} from "@bitwarden/common/autofill/agent-fill/agent-fill-ipc";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Endpoint, OutgoingMessage, Source } from "@bitwarden/sdk-internal";

import { WindowMain } from "../../main/window.main";
import { IpcMainService } from "../../platform/services/ipc.main.service";
import { isDev } from "../../utils";
import {
  AgentFillApprovalRequest,
  AgentFillApprovalResponse,
  AgentFillDenyReason,
} from "../models/agent-fill-approval";
import { AGENT_FILL_IPC_CHANNELS } from "../models/ipc-channels";

/**
 * PROTOTYPE ONLY. SHA-256 of the throwaway test connection key pasted into the spike connector
 * (prefix 450c5af0). Used only in dev builds when `BW_AGENT_FILL_KEY_SHA256` is not set. The real
 * design issues a key per connection after the user names it.
 */
const DEV_TEST_KEY_SHA256 = "450c5af05de7c3ed9238e59bd927a99516f40a8c0bfa4f46701432f72d2a888c";
const DEFAULT_CONNECTION_NAME = "Claude Desktop";

const PREPARE_FILL_TIMEOUT_MS = 10_000;
const FILL_ITEM_TIMEOUT_MS = 20_000;
const DEFAULT_APPROVAL_TIMEOUT_MS = 240_000;
const MAX_LINE_BYTES = 64 * 1024;

const FillTool = Object.freeze({ Login: "fill_login", Card: "fill_card" } as const);
type FillTool = (typeof FillTool)[keyof typeof FillTool];

/** One JSON line from the connector. */
type ConnectorRequest = {
  id?: string | number;
  type?: "fill" | "ping";
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
 * PROTOTYPE: agent autofill with approval.
 *
 * Listens on a local socket for fill requests from the Bitwarden connector, validates the
 * connection key, asks the connected extension to locate the tab, shows the approval dialog in
 * the renderer, and on approval tells the extension to fill. Only the item name and username (or
 * card last four) go back to the connector.
 */
export class MainAgentFillService {
  private server?: Server;
  private keyHash?: Buffer;
  private connectionName = DEFAULT_CONNECTION_NAME;
  private approvalTimeoutMs = DEFAULT_APPROVAL_TIMEOUT_MS;
  private busy = false;

  private responseSubscription?: Subscription;
  private pendingBrowserResponses = new Map<
    string,
    { clientId: number; resolve: (response: AgentFillResponse) => void }
  >();
  private pendingApprovals = new Map<string, (response: AgentFillApprovalResponse) => void>();

  constructor(
    private logService: LogService,
    private messagingService: MessageSender,
    private ipcService: IpcMainService,
    private windowMain: WindowMain,
    private accountService: AccountService,
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

  /** Must run after {@link IpcMainService.init}. */
  async init() {
    const configuredHash =
      process.env.BW_AGENT_FILL_KEY_SHA256 ?? (isDev() ? DEV_TEST_KEY_SHA256 : undefined);
    if (!configuredHash || !/^[0-9a-f]{64}$/i.test(configuredHash)) {
      this.logService.info("[AgentFill] No connection key configured, socket not started");
      return;
    }
    this.keyHash = Buffer.from(configuredHash, "hex");
    this.connectionName = process.env.BW_AGENT_FILL_CONNECTION_NAME || DEFAULT_CONNECTION_NAME;
    const timeoutSeconds = Number(process.env.BW_AGENT_FILL_APPROVAL_TIMEOUT_SECONDS);
    if (Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) {
      this.approvalTimeoutMs = timeoutSeconds * 1000;
    }

    try {
      this.subscribeToBrowserResponses();
      await this.listen(agentFillSocketPath());
    } catch (e) {
      this.logService.error("[AgentFill] Failed to start", e);
    }
  }

  stop() {
    this.server?.close();
    this.responseSubscription?.unsubscribe();
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
    this.logService.info(
      `[AgentFill] Listening at ${socketPath} for connection "${this.connectionName}"`,
    );
  }

  private onConnection(socket: Socket) {
    // The connector closes its socket when Claude cancels the tool call; drop any open dialog then.
    const closed = new AbortController();
    socket.on("close", () => closed.abort());
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (buffer.length > MAX_LINE_BYTES) {
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

    const id = request.id ?? null;
    try {
      if (!this.keyValid(request.key)) {
        throw new AgentFillError(
          AgentFillFailureReason.ConnectionKeyInvalid,
          "Connection key invalid.",
        );
      }

      if (request.type === "ping") {
        const userId = await firstValueFrom(
          this.accountService.activeAccount$.pipe(getOptionalUserId),
        );
        this.write(socket, {
          id,
          ok: true,
          result: {
            connectionName: this.connectionName,
            browsersConnected: this.ipcService.browserClients.length,
            browsersAllowingAgentFill:
              userId != null ? this.ipcService.browserRegistry.allowedFor(userId).length : 0,
          },
        });
        return;
      }

      const result = await this.fill(request, closed);
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

  private keyValid(key: unknown): boolean {
    if (typeof key !== "string" || key.length === 0 || this.keyHash == null) {
      return false;
    }
    const digest = createHash("sha256").update(key, "utf8").digest();
    return timingSafeEqual(digest, this.keyHash);
  }

  private async fill(request: ConnectorRequest, closed: AbortSignal): Promise<ConnectorResult> {
    const cipherType: AgentFillCipherType | undefined =
      request.tool === FillTool.Login
        ? CipherType.Login
        : request.tool === FillTool.Card
          ? CipherType.Card
          : undefined;
    if (cipherType == null || typeof request.url !== "string") {
      throw new AgentFillError(AgentFillFailureReason.Error, "Unknown tool or missing url.");
    }

    // PROTOTYPE: one approval at a time.
    if (this.busy) {
      throw new AgentFillError(
        AgentFillFailureReason.Busy,
        "Another fill is waiting for approval.",
      );
    }
    this.busy = true;
    try {
      const requestId = randomUUID();
      this.logService.info(`[AgentFill] ${request.tool} request ${requestId}`);

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

      const { clientId, prepared } = await this.prepareFill(request.url, userId);
      if (!prepared.unlocked) {
        throw new AgentFillError(
          AgentFillFailureReason.Locked,
          `Bitwarden is locked in ${displayBrowser(prepared.browser)}.`,
        );
      }

      const approval = await this.requestApproval(
        {
          requestId,
          connectionName: this.connectionName,
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
        throw deniedError(approval.reason);
      }

      const filled = await this.sendToBrowser<FillItemRequest, FillItemResponse>(
        clientId,
        AgentFillTopic.FillItem,
        {
          requestId: randomUUID(),
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

      this.logService.info(`[AgentFill] Request ${requestId} filled`);
      return cipherType === CipherType.Card
        ? { status: "filled", item: approval.itemName, last_four: approval.lastFour ?? null }
        : { status: "filled", item: approval.itemName, username: approval.username ?? null };
    } finally {
      this.busy = false;
    }
  }

  /**
   * Asks every connected extension whose latest Hello allows agent fills for the user to locate
   * the tab, and uses the first that finds one.
   */
  private async prepareFill(
    url: string,
    userId: string,
  ): Promise<{ clientId: number; prepared: PrepareFillSuccess }> {
    const registry = this.ipcService.browserRegistry;
    if (registry.list().length === 0) {
      throw new AgentFillError(
        AgentFillFailureReason.BrowserUnreachable,
        "No Bitwarden browser extension is connected to the desktop app.",
      );
    }
    const clients = registry.allowedFor(userId);
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
            { requestId: randomUUID(), userId, url },
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

  private subscribeToBrowserResponses() {
    this.responseSubscription = this.ipcService.messages$
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
      });
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
