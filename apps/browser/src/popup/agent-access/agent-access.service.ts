import { inject, Injectable, NgZone, OnDestroy } from "@angular/core";
import { firstValueFrom, map, Observable, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import type { UserClientEvent } from "@bitwarden/sdk-internal";

import { ConnectionEntry, CredentialMatch } from "./agent-access.types";
import { BrowserProxyClient } from "./proxy-client";

/** Storage keys for agent access state in chrome.storage.local */
const CONNECTIONS_KEY = "rat_connections";
const IDENTITY_KEY = "rat_identity";
const LISTENING_ENABLED_KEY = "rat_listening_enabled";

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
  private ngZone = inject(NgZone);

  // --- Connection storage ---

  async loadConnections(): Promise<ConnectionEntry[]> {
    const data = await this.storageService.get<ConnectionEntry[] | string>(CONNECTIONS_KEY);
    if (!data) {
      return [];
    }
    // Migrate from old JSON-stringified format
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data) as ConnectionEntry[];
        if (Array.isArray(parsed)) {
          await this.storageService.save(CONNECTIONS_KEY, parsed);
          return parsed;
        }
      } catch {
        // Corrupted data, reset
      }
      await this.storageService.remove(CONNECTIONS_KEY);
      return [];
    }
    if (!Array.isArray(data)) {
      await this.storageService.remove(CONNECTIONS_KEY);
      return [];
    }
    return data;
  }

  async saveConnection(entry: ConnectionEntry): Promise<ConnectionEntry[]> {
    const connections = await this.loadConnections();
    const existingIndex = connections.findIndex((c) => c.id === entry.id);
    if (existingIndex >= 0) {
      connections[existingIndex] = entry;
    } else {
      connections.push(entry);
    }
    await this.storageService.save(CONNECTIONS_KEY, connections);
    return connections;
  }

  async removeConnection(id: string): Promise<void> {
    const connections = await this.loadConnections();
    const filtered = connections.filter((c) => c.id !== id);
    await this.storageService.save(CONNECTIONS_KEY, filtered);
  }

  // --- Listening toggle ---

  async getListeningEnabled(): Promise<boolean> {
    const value = await this.storageService.get<boolean>(LISTENING_ENABLED_KEY);
    return value ?? true;
  }

  async setListeningEnabled(enabled: boolean): Promise<void> {
    await this.storageService.save(LISTENING_ENABLED_KEY, enabled);
  }

  // --- Core connection ---

  /**
   * Initialize the RAT client: load persisted identity/session from storage,
   * connect to proxy, and prepare to listen.
   */
  async startListening(mode: ConnectionMode, sessionData?: string): Promise<void> {
    // Load SDK module
    const sdk = await import("@bitwarden/sdk-internal");

    // Load persisted state
    const identityB64 = await this.storageService.get<string>(IDENTITY_KEY);
    let identityData = identityB64 ? this.base64ToBytes(identityB64) : undefined;

    // Ensure we have identity bytes BEFORE creating the proxy client,
    // because connect() needs them for the auth challenge-response.
    const UserClient = (sdk as any).UserClient;
    if (!identityData || identityData.length === 0) {
      identityData = new Uint8Array(UserClient.generate_identity());
    }
    this.identityCose = identityData;

    // Create proxy client with the real identity
    const proxyUrl = this.getProxyUrl();
    this.proxyClient = new BrowserProxyClient(proxyUrl, this.identityCose);

    // Create WASM UserClient — uses the same identity we gave the proxy client
    this.client = await UserClient.listen(this.proxyClient, sessionData ?? undefined, identityData);

    // Persist identity immediately
    await this.persistState();

    // Event callback — runs in the WASM event loop, need to re-enter NgZone
    const eventCallback = (event: UserClientEvent) => {
      this.ngZone.run(() => {
        this.eventsSubject.next(event);
      });
    };

    // Start the event loop (this promise resolves when client disconnects)
    try {
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
    } finally {
      // Persist state after event loop ends
      await this.persistState();
    }
  }

  /**
   * Start listening using cached session data from all saved connections.
   * Currently the WASM SDK only supports one active client, so we use
   * the most recently used connection's session data.
   */
  async startListeningForAll(): Promise<void> {
    const connections = await this.loadConnections();
    if (connections.length === 0) {
      return;
    }

    // Use the most recently used connection's session data
    const sorted = [...connections].sort((a, b) => b.lastUsed - a.lastUsed);
    const sessionData = sorted[0].sessionData;

    await this.startListening("cached", sessionData);
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
    await this.persistState();
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
    await this.persistState();
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

  /** Get the current session data from the active client. */
  getSessionData(): string | null {
    if (!this.client) {
      return null;
    }
    try {
      return this.client.get_session_data() as string;
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

  private async persistState(): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      const identityData = this.client.get_identity_data();
      await this.storageService.save(
        IDENTITY_KEY,
        this.bytesToBase64(new Uint8Array(identityData)),
      );
    } catch {
      // Persist failures are non-fatal
    }
  }

  private getProxyUrl(): string {
    // TODO: Read from environment service / server config
    return DEFAULT_PROXY_URL;
  }

  private base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
}
