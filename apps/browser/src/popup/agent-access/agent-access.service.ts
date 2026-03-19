import { inject, Injectable, NgZone, OnDestroy } from "@angular/core";
import { filter, firstValueFrom, Observable, of, Subject, timeout } from "rxjs";

import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import type { UserClientEvent } from "@bitwarden/sdk-internal";

import {
  AGENT_ACCESS_COMMAND,
  AGENT_ACCESS_EVENT,
  AGENT_ACCESS_RESULT,
} from "../../agent-access/agent-access.messages";

import { AuditLogEntry, CredentialMatch } from "./agent-access.types";
import { ChromeSessionRepository, type SessionRecord } from "./session-repository";

/** Timeout for background commands (ms). */
const COMMAND_TIMEOUT = 30_000;

/** Storage keys — must match background listener. */
const LISTENING_ENABLED_KEY = "agent_access_listening_enabled";
const AUDIT_LOG_KEY = "agent_access_audit_log";

export interface CredentialLookupResult {
  credentialId?: string;
  username?: string;
  password?: string;
  totp?: string;
  uri?: string;
  domain?: string;
}

/**
 * Hybrid service — read-only state reads directly from storage (fast, reliable).
 * WASM operations (connect, tokens, responses) go through messaging to background.
 * Events are forwarded from background via AGENT_ACCESS_EVENT.
 */
@Injectable()
export class AgentAccessService implements OnDestroy {
  private readonly eventsSubject = new Subject<UserClientEvent>();
  readonly events$: Observable<UserClientEvent> = this.eventsSubject.asObservable();

  private readonly messageSender = inject(MessageSender);
  private readonly messageListener = inject(MessageListener);
  private readonly storageService = inject(AbstractStorageService);
  private readonly ngZone = inject(NgZone);

  private sessionRepository: ChromeSessionRepository | null = null;

  constructor() {
    // Subscribe to event broadcasts from the background listener
    this.messageListener.messages$(AGENT_ACCESS_EVENT).subscribe((msg) => {
      this.ngZone.run(() => {
        this.eventsSubject.next(msg.event as UserClientEvent);
      });
    });
  }

  // --- Session listing (direct storage reads) ---

  async listSessions(): Promise<SessionRecord[]> {
    return this.getOrCreateRepository().list();
  }

  async removeSession(id: string): Promise<void> {
    await this.getOrCreateRepository().remove(id);
  }

  async renameSession(id: string, name: string): Promise<void> {
    const repo = this.getOrCreateRepository();
    const record = await repo.get(id);
    if (record) {
      record.name = name;
      await repo.set(id, record);
    }
  }

  // --- Listening toggle (direct storage) ---

  async getListeningEnabled(): Promise<boolean> {
    const value = await this.storageService.get<boolean>(LISTENING_ENABLED_KEY);
    return value ?? true;
  }

  async setListeningEnabled(enabled: boolean): Promise<void> {
    await this.storageService.save(LISTENING_ENABLED_KEY, enabled);
  }

  // --- Audit log (direct storage) ---

  async loadAuditLog(connectionId?: string): Promise<AuditLogEntry[]> {
    const data = await this.storageService.get<AuditLogEntry[]>(AUDIT_LOG_KEY);
    const entries = Array.isArray(data) ? data : [];
    if (connectionId) {
      return entries.filter((e) => e.connectionId === connectionId);
    }
    return entries;
  }

  async appendAuditLog(entry: AuditLogEntry): Promise<void> {
    await this.sendCommand("appendAuditLog", { entry });
  }

  // --- WASM operations (messaging to background) ---

  async startListening(): Promise<void> {
    await this.sendCommand("startListening");
  }

  async startListeningForAll(): Promise<void> {
    await this.sendCommand("startListeningForAll");
  }

  async getPskToken(name?: string): Promise<string> {
    return (await this.sendCommand<string>("getPskToken", { name })) ?? "";
  }

  async getRendezvousToken(name?: string): Promise<string> {
    return (await this.sendCommand<string>("getRendezvousToken", { name })) ?? "";
  }

  async verifyFingerprint(requestId: string, approved: boolean, name?: string): Promise<void> {
    await this.sendCommand("verifyFingerprint", { sdkRequestId: requestId, approved, name });
  }

  async respondToCredential(
    requestId: string,
    approved: boolean,
    credential?: CredentialLookupResult,
  ): Promise<void> {
    await this.sendCommand("respondToCredential", {
      sdkRequestId: requestId,
      approved,
      credential,
    });
  }

  async lookupCredentials(domain: string): Promise<CredentialMatch[]> {
    return (await this.sendCommand<CredentialMatch[]>("lookupCredentials", { domain })) ?? [];
  }

  async getCredentialById(cipherId: string): Promise<CredentialLookupResult | null> {
    return (
      (await this.sendCommand<CredentialLookupResult | null>("getCredentialById", {
        cipherId,
      })) ?? null
    );
  }

  async disconnect(): Promise<void> {
    await this.sendCommand("disconnect");
  }

  /** Get background state — pending requests come from background, rest from storage. */
  async getState(): Promise<{
    listening: boolean;
    connected: boolean;
    sessions: SessionRecord[];
    pendingRequests: Array<{ domain: string; identity: string; requestId: string; query: any }>;
  }> {
    // Read storage state directly (fast, no messaging)
    const [listening, sessions] = await Promise.all([
      this.getListeningEnabled(),
      this.listSessions(),
    ]);

    // Try to get pending requests from background (best-effort)
    let pendingRequests: Array<{
      domain: string;
      identity: string;
      requestId: string;
      query: any;
    }> = [];
    try {
      const bgState = await this.sendCommand<{
        connected: boolean;
        pendingRequests: Array<{
          domain: string;
          identity: string;
          requestId: string;
          query: any;
        }>;
      }>("getState");
      pendingRequests = bgState?.pendingRequests ?? [];
    } catch {
      // Background may not be ready — that's fine, pending requests will arrive via events
    }

    return {
      listening,
      connected: sessions.length > 0,
      sessions,
      pendingRequests,
    };
  }

  ngOnDestroy(): void {
    this.eventsSubject.complete();
  }

  // --- Private ---

  private getOrCreateRepository(): ChromeSessionRepository {
    if (!this.sessionRepository) {
      this.sessionRepository = new ChromeSessionRepository(this.storageService);
    }
    return this.sessionRepository;
  }

  private async sendCommand<T = void>(
    type: string,
    params: Record<string, any> = {},
  ): Promise<T | undefined> {
    const requestId = Utils.newGuid();

    const resultPromise = firstValueFrom(
      this.messageListener.messages$(AGENT_ACCESS_RESULT).pipe(
        filter((m) => m.requestId === requestId),
        timeout({
          first: COMMAND_TIMEOUT,
          with: () => {
            return of({
              requestId,
              result: undefined,
              error: `Agent access command "${type}" timed out`,
            });
          },
        }),
      ),
    );

    this.messageSender.send(AGENT_ACCESS_COMMAND, { requestId, type, ...params });

    const response = await resultPromise;
    if (response.error) {
      throw new Error(response.error);
    }
    return response.result as T | undefined;
  }
}
