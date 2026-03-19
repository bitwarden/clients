import { Observable, concatMap, filter, firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import {
  MessageListener,
  MessageSender,
  isExternalMessage,
} from "@bitwarden/common/platform/messaging";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import * as sdk from "@bitwarden/sdk-internal";
import type { UserClientEvent } from "@bitwarden/sdk-internal";

import {
  AGENT_ACCESS_COMMAND,
  AGENT_ACCESS_EVENT,
  AGENT_ACCESS_RESULT,
} from "../../agent-access/agent-access.messages";
import { BrowserApi } from "../../platform/browser/browser-api";

import { AgentAccessIdentity } from "./agent-access-identity";
import { BrowserProxyClient } from "./proxy-client";
import { ChromeSessionRepository, type SessionRecord } from "./session-repository";

/** Storage keys for agent access state in chrome.storage.local */
const LISTENING_ENABLED_KEY = "agent_access_listening_enabled";
const AUDIT_LOG_KEY = "agent_access_audit_log";
const AUDIT_LOG_MAX_ENTRIES = 200;

/** Default proxy URL — should eventually come from environment config */
const DEFAULT_PROXY_URL = "wss://rat1.lesspassword.dev";

export interface CredentialLookupResult {
  credentialId?: string;
  username?: string;
  password?: string;
  totp?: string;
  uri?: string;
  domain?: string;
}

interface AuditLogEntry {
  connectionId: string;
  connectionName: string;
  timestamp: number;
  action: "credential_approved" | "credential_denied" | "connected" | "disconnected";
  domain?: string;
  fields?: string[];
}

/** Extract hex from "IdentityFingerprint(hex...)" Debug format, or return as-is. */
function parseIdentityFingerprint(raw: string): string {
  const match = raw.match(/IdentityFingerprint\(([0-9a-f]+)\)/);
  return match ? match[1] : raw;
}

/**
 * Background listener that owns the WASM UserClient, WebSocket proxy connection,
 * and session repository. Popup communicates via MessageSender/MessageListener.
 *
 * Pattern follows SyncServiceListener: listens on AGENT_ACCESS_COMMAND,
 * dispatches by `type`, responds with AGENT_ACCESS_RESULT.
 */
export class AgentAccessListener {
  private client: any = null; // UserClient from WASM SDK
  private proxyClient: BrowserProxyClient | null = null;
  private identityCose: Uint8Array | null = null;
  private sessionRepository: ChromeSessionRepository | null = null;
  private identityService: AgentAccessIdentity;

  /** Pending credential requests keyed by SDK request_id, for badge count + popup query. */
  private pendingRequests = new Map<
    string,
    { domain: string; identity: string; requestId: string; query: any }
  >();

  constructor(
    private readonly messageListener: MessageListener,
    private readonly messageSender: MessageSender,
    private readonly storageService: AbstractStorageService,
    private readonly cipherService: CipherService,
    private readonly accountService: AccountService,
    private readonly logService: LogService,
  ) {
    this.identityService = new AgentAccessIdentity(cipherService);
  }

  /**
   * Returns an observable that listens for agent-access commands from the popup.
   * Subscribe in MainBackground.bootstrap().
   */
  listener$(): Observable<void> {
    return this.messageListener.messages$(AGENT_ACCESS_COMMAND).pipe(
      filter((message) => isExternalMessage(message)),
      concatMap(async ({ requestId, type, ...params }) => {
        await this.handleCommand(requestId, type, params);
      }),
    );
  }

  /**
   * Auto-reconnect on background startup if listening is enabled and sessions exist.
   */
  async init(): Promise<void> {
    try {
      const enabled = await this.getListeningEnabled();
      if (!enabled) {
        return;
      }
      const sessions = await this.listSessions();
      if (sessions.length === 0) {
        return;
      }
      await this.startListening();
      this.logService.info("[AgentAccess] Auto-reconnected on background init");
    } catch (err) {
      this.logService.warning("[AgentAccess] Auto-reconnect failed on init", err);
    }
  }

  // --- Command dispatch ---

  private async handleCommand(
    requestId: string,
    type: string,
    params: Record<string, any>,
  ): Promise<void> {
    try {
      let result: any;
      switch (type) {
        case "startListening":
          await this.startListening();
          break;
        case "startListeningForAll":
          await this.startListeningForAll();
          break;
        case "disconnect":
          await this.disconnect();
          break;
        case "getPskToken":
          result = await this.getPskToken(params["name"]);
          break;
        case "getRendezvousToken":
          result = await this.getRendezvousToken(params["name"]);
          break;
        case "verifyFingerprint":
          await this.verifyFingerprint(params["sdkRequestId"], params["approved"], params["name"]);
          break;
        case "respondToCredential":
          await this.respondToCredential(
            params["sdkRequestId"],
            params["approved"],
            params["credential"],
          );
          break;
        case "lookupCredentials":
          result = await this.lookupCredentials(params["domain"]);
          break;
        case "getCredentialById":
          result = await this.getCredentialById(params["cipherId"]);
          break;
        case "listSessions":
          result = await this.listSessions();
          break;
        case "removeSession":
          await this.removeSession(params["id"]);
          break;
        case "renameSession":
          await this.renameSession(params["id"], params["name"]);
          break;
        case "getListeningEnabled":
          result = await this.getListeningEnabled();
          break;
        case "setListeningEnabled":
          await this.setListeningEnabled(params["enabled"]);
          break;
        case "loadAuditLog":
          result = await this.loadAuditLog(params["connectionId"]);
          break;
        case "appendAuditLog":
          await this.appendAuditLog(params["entry"]);
          break;
        case "getState":
          result = await this.getState();
          break;
        default:
          throw new Error(`Unknown agent-access command: ${type}`);
      }
      this.messageSender.send(AGENT_ACCESS_RESULT, { requestId, result });
    } catch (err: any) {
      this.logService.warning(`[AgentAccess] Command "${type}" failed`, err);
      this.messageSender.send(AGENT_ACCESS_RESULT, {
        requestId,
        error: err?.message ?? "Unknown error",
      });
    }
  }

  // --- State query (for popup init) ---

  private async getState(): Promise<{
    listening: boolean;
    connected: boolean;
    sessions: SessionRecord[];
    pendingRequests: Array<{ domain: string; identity: string; requestId: string; query: any }>;
  }> {
    return {
      listening: await this.getListeningEnabled(),
      connected: this.client != null,
      sessions: await this.listSessions(),
      pendingRequests: Array.from(this.pendingRequests.values()),
    };
  }

  // --- Session listing (delegates to repository) ---

  private async listSessions(): Promise<SessionRecord[]> {
    const repo = this.getOrCreateRepository();
    return repo.list();
  }

  private async removeSession(id: string): Promise<void> {
    const repo = this.getOrCreateRepository();
    await repo.remove(id);
  }

  private async renameSession(id: string, name: string): Promise<void> {
    const repo = this.getOrCreateRepository();
    const record = await repo.get(id);
    if (record) {
      record.name = name;
      await repo.set(id, record);
    }
  }

  // --- Listening toggle ---

  private async getListeningEnabled(): Promise<boolean> {
    const value = await this.storageService.get<boolean>(LISTENING_ENABLED_KEY);
    return value ?? true;
  }

  private async setListeningEnabled(enabled: boolean): Promise<void> {
    await this.storageService.save(LISTENING_ENABLED_KEY, enabled);
  }

  // --- Audit log ---

  private async loadAuditLog(connectionId?: string): Promise<AuditLogEntry[]> {
    const data = await this.storageService.get<AuditLogEntry[]>(AUDIT_LOG_KEY);
    const entries = Array.isArray(data) ? data : [];
    if (connectionId) {
      return entries.filter((e) => e.connectionId === connectionId);
    }
    return entries;
  }

  private async appendAuditLog(entry: AuditLogEntry): Promise<void> {
    const data = await this.storageService.get<AuditLogEntry[]>(AUDIT_LOG_KEY);
    const entries = Array.isArray(data) ? data : [];
    entries.push(entry);
    const trimmed =
      entries.length > AUDIT_LOG_MAX_ENTRIES
        ? entries.slice(entries.length - AUDIT_LOG_MAX_ENTRIES)
        : entries;
    await this.storageService.save(AUDIT_LOG_KEY, trimmed);
  }

  // --- Core connection ---

  private async startListening(): Promise<void> {
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    if (!activeUserId) {
      throw new Error("No active account");
    }

    this.identityCose = new Uint8Array(await this.identityService.getIdentity(activeUserId));

    const repo = this.getOrCreateRepository();
    await repo.migrateFromOldFormat();

    this.proxyClient = new BrowserProxyClient(DEFAULT_PROXY_URL, this.identityCose);

    this.client = new (sdk as any).UserClient(repo, this.identityCose);
    this.client.set_audit_callback(this.createAuditCallback());

    const eventCallback = (event: UserClientEvent) => {
      this.messageSender.send(AGENT_ACCESS_EVENT, { event });

      // Track pending credential requests and update badge
      if (event.type === "credential_request") {
        const reqEvent = event as any;
        const query = reqEvent.query;
        const domain =
          "domain" in query ? query.domain : "search" in query ? query.search : query.id;
        this.pendingRequests.set(reqEvent.request_id, {
          domain,
          identity: reqEvent.identity ?? "",
          requestId: reqEvent.request_id,
          query,
        });
        void this.updateBadge();
      }
    };

    await this.client.connect(this.proxyClient, eventCallback);
  }

  private async startListeningForAll(): Promise<void> {
    const sessions = await this.listSessions();
    if (sessions.length === 0) {
      return;
    }
    await this.startListening();
  }

  private async getPskToken(name?: string): Promise<string> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }
    return await this.client.get_psk_token(name ?? null);
  }

  private async getRendezvousToken(name?: string): Promise<string> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }
    return await this.client.get_rendezvous_token(name ?? null);
  }

  private async verifyFingerprint(
    requestId: string,
    approved: boolean,
    name?: string,
  ): Promise<void> {
    if (!this.client) {
      return;
    }
    const response: Record<string, unknown> = {
      type: "verify_fingerprint",
      request_id: requestId,
      approved,
    };
    if (name) {
      response["name"] = name;
    }
    this.client.send_response(response);
  }

  private async respondToCredential(
    requestId: string,
    approved: boolean,
    credential?: CredentialLookupResult,
  ): Promise<void> {
    if (!this.client) {
      return;
    }
    this.client.send_response({
      type: "respond_credential",
      request_id: requestId,
      approved,
      credential: approved ? credential : undefined,
      credential_id: approved ? credential?.credentialId : undefined,
    });

    this.pendingRequests.delete(requestId);
    void this.updateBadge();
  }

  private async lookupCredentials(
    domain: string,
  ): Promise<Array<{ cipherId: string; name: string; username: string; uri: string }>> {
    try {
      const activeAccount = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      if (!activeAccount) {
        return [];
      }

      const url = domain.startsWith("http") ? domain : `https://${domain}`;
      const ciphers = await this.cipherService.getAllDecryptedForUrl(url, activeAccount);

      return ciphers
        .filter((c) => c.login)
        .map((c) => ({
          cipherId: c.id!,
          name: c.name,
          username: c.login!.username ?? "",
          uri: c.login!.uris?.[0]?.uri ?? url,
        }));
    } catch {
      return [];
    }
  }

  private async getCredentialById(cipherId: string): Promise<CredentialLookupResult | null> {
    try {
      const activeAccount = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      if (!activeAccount) {
        return null;
      }

      const cipher = await this.cipherService.get(cipherId, activeAccount);
      if (!cipher) {
        return null;
      }

      const decrypted = await cipher.decrypt(
        await this.cipherService.getKeyForCipherKeyDecryption(cipher, activeAccount),
      );
      const login = decrypted.login;
      if (!login) {
        return null;
      }

      const uri = login.uris?.[0]?.uri ?? undefined;
      let domain: string | undefined;
      if (uri) {
        try {
          domain = new URL(uri.startsWith("http") ? uri : `https://${uri}`).hostname;
        } catch {
          domain = uri;
        }
      }

      return {
        credentialId: cipherId,
        username: login.username ?? undefined,
        password: login.password ?? undefined,
        totp: login.totp ?? undefined,
        uri,
        domain,
      };
    } catch {
      return null;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.proxyClient) {
      try {
        await this.proxyClient.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.proxyClient = null;
    }
    this.client = null;
  }

  // --- Private helpers ---

  private createAuditCallback(): (event: any) => void {
    return (event: any) => {
      const remoteIdentity = event.remoteIdentity as string | undefined;
      if (!remoteIdentity) {
        return;
      }
      const connectionId = parseIdentityFingerprint(remoteIdentity);

      let entry: AuditLogEntry | null = null;
      switch (event.type) {
        case "connection_established":
        case "session_refreshed":
          entry = {
            connectionId,
            connectionName: (event.remoteName as string) ?? "Unknown",
            timestamp: Date.now(),
            action: "connected",
          };
          break;
        case "credential_approved":
          entry = {
            connectionId,
            connectionName: "",
            timestamp: Date.now(),
            action: "credential_approved",
            domain: event.domain as string | undefined,
            fields: event.fields as string[] | undefined,
          };
          break;
        case "credential_denied": {
          const query = event.query as { domain?: string } | undefined;
          entry = {
            connectionId,
            connectionName: "",
            timestamp: Date.now(),
            action: "credential_denied",
            domain: query?.domain,
          };
          break;
        }
      }

      if (entry) {
        void this.enrichAndAppendAuditEntry(entry);
      }
    };
  }

  private async enrichAndAppendAuditEntry(entry: AuditLogEntry): Promise<void> {
    if (!entry.connectionName) {
      const sessions = await this.listSessions();
      const session = sessions.find(
        (s) => Utils.fromBufferToHex(new Uint8Array(s.fingerprint)) === entry.connectionId,
      );
      entry.connectionName = session?.name ?? "Unknown";
    }
    await this.appendAuditLog(entry);
  }

  private getOrCreateRepository(): ChromeSessionRepository {
    if (!this.sessionRepository) {
      this.sessionRepository = new ChromeSessionRepository(this.storageService);
    }
    return this.sessionRepository;
  }

  /** Update the extension icon badge to show the number of pending credential requests. */
  private async updateBadge(): Promise<void> {
    try {
      const action = BrowserApi.getBrowserAction();
      const count = this.pendingRequests.size;
      await action.setBadgeText({ text: count > 0 ? String(count) : "" });
      if (count > 0) {
        await action.setBadgeBackgroundColor({ color: "#cf6639" });
      }
    } catch (err) {
      this.logService.warning("[AgentAccess] Failed to update badge", err);
    }
  }
}
