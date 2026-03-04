import { inject, Injectable, NgZone, OnDestroy } from "@angular/core";
import { firstValueFrom, map, Observable, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { BrowserRatProxyClient } from "./rat-proxy-client";

/** Storage keys for RAT state in chrome.storage.local */
const RAT_SESSION_KEY = "rat_session_cache";
const RAT_IDENTITY_KEY = "rat_identity";

/** Default proxy URL — should eventually come from environment config */
const DEFAULT_PROXY_URL = "ws://localhost:8080";

export type ConnectionMode = "rendezvous" | "psk" | "cached";

export interface RatEvent {
  type: string;
  [key: string]: unknown;
}

export interface CredentialLookupResult {
  username?: string;
  password?: string;
  totp?: string;
  uri?: string;
}

@Injectable()
export class RemoteAccessService implements OnDestroy {
  private client: any = null; // RatUserClient from SDK
  private proxyClient: BrowserRatProxyClient | null = null;
  private identityCose: Uint8Array | null = null;

  private readonly eventsSubject = new Subject<RatEvent>();
  readonly events$: Observable<RatEvent> = this.eventsSubject.asObservable();

  private storageService = inject(AbstractStorageService);
  private cipherService = inject(CipherService);
  private accountService = inject(AccountService);
  private environmentService = inject(EnvironmentService);
  private ngZone = inject(NgZone);

  /**
   * Initialize the RAT client: load persisted identity/session from storage,
   * connect to proxy, and prepare to listen.
   */
  async startListening(mode: ConnectionMode): Promise<void> {
    // Load SDK module
    const sdk = await import("@bitwarden/sdk-internal");

    // Load persisted state
    const sessionData = await this.storageService.get<string>(RAT_SESSION_KEY);
    const identityB64 = await this.storageService.get<string>(RAT_IDENTITY_KEY);
    let identityData = identityB64 ? this.base64ToBytes(identityB64) : undefined;

    // Ensure we have identity bytes BEFORE creating the proxy client,
    // because connect() needs them for the auth challenge-response.
    const RatUserClient = (sdk as any).RatUserClient;
    if (!identityData || identityData.length === 0) {
      identityData = new Uint8Array(RatUserClient.generate_identity());
    }
    this.identityCose = identityData;

    // Create proxy client with the real identity
    const proxyUrl = this.getProxyUrl();
    this.proxyClient = new BrowserRatProxyClient(proxyUrl, this.identityCose);

    // Create WASM UserClient — uses the same identity we gave the proxy client
    this.client = await RatUserClient.listen(
      this.proxyClient,
      sessionData ?? undefined,
      identityData,
    );

    // Persist identity immediately
    await this.persistState();

    // Event callback — runs in the WASM event loop, need to re-enter NgZone
    const eventCallback = (event: RatEvent) => {
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
  ): Promise<void> {
    if (!this.client) {
      return;
    }
    this.client.send_response({
      type: "respond_credential",
      request_id: requestId,
      session_id: sessionId,
      approved,
      credential: approved ? credential : undefined,
    });
    await this.persistState();
  }

  /** Look up a vault credential by domain. */
  async lookupCredential(domain: string): Promise<CredentialLookupResult | null> {
    try {
      const activeAccount = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      if (!activeAccount) {
        return null;
      }

      const url = domain.startsWith("http") ? domain : `https://${domain}`;
      const ciphers = await this.cipherService.getAllDecryptedForUrl(url, activeAccount);

      if (ciphers.length === 0) {
        return null;
      }

      // Use the best match (first result after sorting)
      const cipher = ciphers[0];
      const login = cipher.login;
      if (!login) {
        return null;
      }

      return {
        username: login.username ?? undefined,
        password: login.password ?? undefined,
        totp: login.totp ?? undefined,
        uri: login.uris?.[0]?.uri ?? undefined,
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

    // Clear the session cache so next connection goes through full
    // handshake with fingerprint verification. Without session management
    // UI, stale cache silently skips verification for returning devices.
    await this.storageService.remove(RAT_SESSION_KEY);
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
      const sessionData = this.client.get_session_data();
      const identityData = this.client.get_identity_data();
      await this.storageService.save(RAT_SESSION_KEY, sessionData);
      await this.storageService.save(
        RAT_IDENTITY_KEY,
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
