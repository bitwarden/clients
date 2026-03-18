import { inject, Injectable, NgZone, OnDestroy } from "@angular/core";
import { firstValueFrom, map, Observable, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import type { UserClientEvent } from "@bitwarden/sdk-internal";

import { AgentAccessIdentityService } from "./agent-access-identity.service";
import { AuditLogEntry, CredentialMatch, parseIdentityFingerprint } from "./agent-access.types";
import { BrowserProxyClient } from "./proxy-client";
import { ChromeSessionRepository, type SessionRecord } from "./session-repository";

/** Storage keys for agent access state in chrome.storage.local */
const LISTENING_ENABLED_KEY = "agent_access_listening_enabled";
const AUDIT_LOG_KEY = "agent_access_audit_log";
const AUDIT_LOG_MAX_ENTRIES = 200;

/** Default proxy URL — should eventually come from environment config */
const DEFAULT_PROXY_URL = "wss://rat1.lesspassword.dev";

export type ConnectionMode = "rendezvous" | "psk" | "cached";

export interface CredentialLookupResult {
  credentialId?: string;
  username?: string;
  password?: string;
  totp?: string;
  uri?: string;
  domain?: string;
}

@Injectable()
export class AgentAccessService implements OnDestroy {
  private client: any = null; // UserClient from WASM SDK
  private proxyClient: BrowserProxyClient | null = null;
  private identityCose: Uint8Array | null = null;

  private readonly eventsSubject = new Subject<UserClientEvent>();
  readonly events$: Observable<UserClientEvent> = this.eventsSubject.asObservable();

  private storageService = inject(AbstractStorageService);
  private cipherService = inject(CipherService);
  private accountService = inject(AccountService);
  private environmentService = inject(EnvironmentService);
  private identityService = inject(AgentAccessIdentityService);
  private ngZone = inject(NgZone);

  private sessionRepository: ChromeSessionRepository | null = null;

  // --- Session listing (delegates to repository) ---

  async listSessions(): Promise<SessionRecord[]> {
    const repo = this.getOrCreateRepository();
    return repo.list();
  }

  async removeSession(id: string): Promise<void> {
    const repo = this.getOrCreateRepository();
    await repo.remove(id);
  }

  async renameSession(id: string, name: string): Promise<void> {
    const repo = this.getOrCreateRepository();
    const record = await repo.get(id);
    if (record) {
      record.name = name;
      await repo.set(id, record);
    }
  }

  // --- Listening toggle ---

  async getListeningEnabled(): Promise<boolean> {
    const value = await this.storageService.get<boolean>(LISTENING_ENABLED_KEY);
    return value ?? true;
  }

  async setListeningEnabled(enabled: boolean): Promise<void> {
    await this.storageService.save(LISTENING_ENABLED_KEY, enabled);
  }

  // --- Audit log ---

  async loadAuditLog(connectionId?: string): Promise<AuditLogEntry[]> {
    const data = await this.storageService.get<AuditLogEntry[]>(AUDIT_LOG_KEY);
    const entries = Array.isArray(data) ? data : [];
    if (connectionId) {
      return entries.filter((e) => e.connectionId === connectionId);
    }
    return entries;
  }

  async appendAuditLog(entry: AuditLogEntry): Promise<void> {
    const data = await this.storageService.get<AuditLogEntry[]>(AUDIT_LOG_KEY);
    const entries = Array.isArray(data) ? data : [];
    entries.push(entry);
    // Cap at max entries, drop oldest
    const trimmed =
      entries.length > AUDIT_LOG_MAX_ENTRIES
        ? entries.slice(entries.length - AUDIT_LOG_MAX_ENTRIES)
        : entries;
    await this.storageService.save(AUDIT_LOG_KEY, trimmed);
  }

  // --- Core connection ---

  /**
   * Initialize the RAT client: load identity from vault, create session
   * repository, connect to proxy, and start listening.
   *
   * The session repository auto-persists all session state — no manual
   * persistState() calls needed.
   */
  async startListening(mode: ConnectionMode): Promise<void> {
    // Load SDK module
    const sdk = await import("@bitwarden/sdk-internal");

    // Get active user
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    if (!activeUserId) {
      throw new Error("No active account");
    }

    // Get identity from vault (generates on first use)
    this.identityCose = new Uint8Array(await this.identityService.getIdentity(activeUserId));

    // Create session repository for auto-persistence
    const repo = this.getOrCreateRepository();

    // Run migration from old format (one-time)
    await repo.migrateFromOldFormat();

    // Create proxy client with identity for auth challenge
    const proxyUrl = this.getProxyUrl();
    this.proxyClient = new BrowserProxyClient(proxyUrl, this.identityCose);

    // Create WASM UserClient with repository + identity
    const UserClient = (sdk as any).UserClient;
    this.client = new UserClient(repo, this.identityCose);
    this.client.set_audit_callback(this.createAuditCallback());
    await this.client.connect(this.proxyClient);

    // Event callback — runs in the WASM event loop, need to re-enter NgZone
    const eventCallback = (event: UserClientEvent) => {
      this.ngZone.run(() => {
        this.eventsSubject.next(event);
      });
    };

    // Start the event loop (this promise resolves when client disconnects)
    switch (mode) {
      case "rendezvous":
        await this.client.enable_rendezvous(eventCallback);
        break;
      case "psk":
        await this.client.enable_psk(eventCallback);
        break;
      case "cached":
        await this.client.listen_cached_only(eventCallback);
        break;
    }
  }

  /**
   * Start listening using cached sessions.
   * The session repository already holds all persisted sessions,
   * so no need to pass session data explicitly.
   */
  async startListeningForAll(): Promise<void> {
    const sessions = await this.listSessions();
    if (sessions.length === 0) {
      return;
    }
    await this.startListening("cached");
  }

  /** Approve or reject fingerprint verification. */
  async verifyFingerprint(approved: boolean, name?: string): Promise<void> {
    if (!this.client) {
      return;
    }
    const response: Record<string, unknown> = {
      type: "verify_fingerprint",
      approved,
    };
    if (name) {
      response["name"] = name;
    }
    this.client.send_response(response);
  }

  /** Respond to a credential request. */
  async respondToCredential(
    requestId: string,
    sessionId: string,
    approved: boolean,
    credential?: CredentialLookupResult,
    query?: { domain: string } | { id: string } | { search: string },
  ): Promise<void> {
    if (!this.client) {
      return;
    }
    this.client.send_response({
      type: "respond_credential",
      request_id: requestId,
      session_id: sessionId,
      query,
      approved,
      credential: approved ? credential : undefined,
      credential_id: approved ? credential?.credentialId : undefined,
    });
  }

  /** Look up all vault credentials matching a domain. */
  async lookupCredentials(domain: string): Promise<CredentialMatch[]> {
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

  /** Get a single credential by cipher ID for sending to the agent. */
  async getCredentialById(cipherId: string): Promise<CredentialLookupResult | null> {
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

  /** Disconnect and clean up. */
  async disconnect(): Promise<void> {
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

  ngOnDestroy(): void {
    void this.disconnect();
    this.eventsSubject.complete();
  }

  /**
   * Create a JS callback for the WASM AuditLog trait.
   * Converts WASM audit events to AuditLogEntry and persists them.
   */
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
        // Fill in connection name from stored sessions (fire-and-forget)
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

  private getProxyUrl(): string {
    // TODO: Read from environment service / server config
    return DEFAULT_PROXY_URL;
  }
}
