import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ToastService } from "@bitwarden/components";
import type { UserClientEvent } from "@bitwarden/sdk-internal";

import { PopupHeaderComponent } from "../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../platform/popup/layout/popup-page.component";

import { AgentAccessIdentityService } from "./agent-access-identity.service";
import { AgentAccessService, type ConnectionMode } from "./agent-access.service";
import {
  AuditLogEntry,
  CredentialRequestData,
  parseIdentityFingerprint,
} from "./agent-access.types";
import { AgentAccessAuditLogComponent } from "./pages/agent-access-audit-log.component";
import { AgentAccessCredentialRequestComponent } from "./pages/agent-access-credential-request.component";
import { AgentAccessHomeComponent } from "./pages/agent-access-home.component";
import { AgentAccessPairingComponent } from "./pages/agent-access-pairing.component";
import { AgentAccessStatusComponent } from "./pages/agent-access-status.component";
import { type SessionRecord } from "./session-repository";

const AgentAccessView = Object.freeze({
  Home: "home",
  Pairing: "pairing",
  CredentialRequest: "credential-request",
  AuditLog: "audit-log",
  Disconnected: "disconnected",
  Error: "error",
} as const);
type AgentAccessView = (typeof AgentAccessView)[keyof typeof AgentAccessView];

/** UI-facing session info derived from SessionRecord + hex key. */
interface SessionDisplay {
  id: string; // hex fingerprint (repository key)
  name: string;
  lastConnected: number;
}

@Component({
  selector: "app-agent-access",
  standalone: true,
  imports: [
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    AgentAccessHomeComponent,
    AgentAccessPairingComponent,
    AgentAccessCredentialRequestComponent,
    AgentAccessAuditLogComponent,
    AgentAccessStatusComponent,
  ],
  providers: [AgentAccessService, AgentAccessIdentityService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <popup-page>
      <popup-header
        slot="header"
        [pageTitle]="'agentAccess' | i18n"
        [showBackButton]="view() !== 'home'"
        [backAction]="goHomeAction"
      ></popup-header>

      @switch (view()) {
        @case ("home") {
          <app-agent-access-home
            [connections]="connections()"
            [pendingRequests]="pendingRequests()"
            (addConnection)="startPairing()"
            (renameConnection)="onRenameConnection($event)"
            (removeConnection)="onRemoveConnection($event)"
            (openRequest)="openPendingRequest($event)"
            (viewConnection)="openAuditLog($event)"
          />
        }
        @case ("pairing") {
          <app-agent-access-pairing
            [stage]="pairingStage()"
            [connectionMode]="connectionMode()"
            [rendezvousCode]="rendezvousCode()"
            [pskToken]="pskToken()"
            [fingerprint]="fingerprint()"
            [connectionName]="connectionName()"
            [knownConnectionName]="knownConnectionName()"
            [codeCopied]="codeCopied()"
            [tokenCopied]="tokenCopied()"
            (modeChanged)="switchMode($event)"
            (copyCode)="copyCode()"
            (copyToken)="copyToken()"
            (nameChanged)="onConnectionNameChanged($event)"
            (fingerprintApproved)="onFingerprintApproved()"
            (fingerprintRejected)="onFingerprintRejected()"
          />
        }
        @case ("credential-request") {
          <app-agent-access-credential-request
            [request]="currentRequest()"
            (approved)="onCredentialApproved($event)"
            (denied)="onCredentialDenied()"
          />
        }
        @case ("audit-log") {
          <app-agent-access-audit-log
            [entries]="auditLogEntries()"
            [connectionName]="auditLogConnectionName()"
          />
        }
        @case ("disconnected") {
          <app-agent-access-status status="disconnected" (action)="goHome()" />
        }
        @case ("error") {
          <app-agent-access-status
            status="error"
            [errorMessage]="errorMessage()"
            (action)="goHome()"
          />
        }
      }
    </popup-page>
  `,
})
export class AgentAccessComponent implements OnInit, OnDestroy {
  protected readonly view = signal<AgentAccessView>(AgentAccessView.Home);
  protected readonly connections = signal<SessionDisplay[]>([]);
  protected readonly listeningEnabled = signal(true);

  // Pairing state
  protected readonly pairingStage = signal<
    "token" | "fingerprint" | "known" | "handshake" | "connected"
  >("token");
  protected readonly connectionMode = signal<ConnectionMode>("rendezvous");
  protected readonly rendezvousCode = signal("");
  protected readonly pskToken = signal("");
  protected readonly fingerprint = signal("");
  protected readonly connectionName = signal("");
  protected readonly knownConnectionName = signal("");
  private readonly remoteSessionId = signal("");
  protected readonly codeCopied = signal(false);
  protected readonly tokenCopied = signal(false);

  // Credential request state
  protected readonly currentRequest = signal<CredentialRequestData | null>(null);
  // Pending requests by connection ID — survives navigation back to home
  protected readonly pendingRequests = signal<Map<string, CredentialRequestData>>(new Map());

  // Audit log state
  protected readonly auditLogEntries = signal<AuditLogEntry[]>([]);
  protected readonly auditLogConnectionName = signal("");

  // Error state
  protected readonly errorMessage = signal("");

  private readonly service = inject(AgentAccessService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Emits to tear down the current event subscription before re-subscribing. */
  private readonly unsubscribeEvents$ = new Subject<void>();

  async ngOnInit(): Promise<void> {
    const [savedSessions, savedListening] = await Promise.all([
      this.service.listSessions(),
      this.service.getListeningEnabled(),
    ]);

    this.connections.set(savedSessions.map((s) => this.toDisplay(s)));
    this.listeningEnabled.set(savedListening);

    if (savedListening && savedSessions.length > 0) {
      this.subscribeToEvents();
      this.service.startListeningForAll().catch((err: Error) => {
        this.errorMessage.set(err.message || "Failed to start listening");
        this.view.set(AgentAccessView.Error);
      });
    }
  }

  // --- Home actions ---

  startPairing(): void {
    void this.service.disconnect();
    this.resetPairingState();
    this.view.set(AgentAccessView.Pairing);
    this.beginListening();
  }

  async onRenameConnection(id: string): Promise<void> {
    const conn = this.connections().find((c) => c.id === id);
    if (!conn) {
      return;
    }
    const newName = prompt("Rename connection", conn.name);
    if (!newName || newName === conn.name) {
      return;
    }
    await this.service.renameSession(id, newName);
    await this.refreshConnections();
  }

  async onRemoveConnection(id: string): Promise<void> {
    await this.service.removeSession(id);
    await this.refreshConnections();

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: "Connection removed",
    });
  }

  async onToggleListening(enabled: boolean): Promise<void> {
    this.listeningEnabled.set(enabled);
    await this.service.setListeningEnabled(enabled);

    if (enabled && this.connections().length > 0) {
      this.subscribeToEvents();
      this.service.startListeningForAll().catch((err: Error) => {
        this.errorMessage.set(err.message || "Failed to start listening");
        this.view.set(AgentAccessView.Error);
      });
    } else if (!enabled) {
      void this.service.disconnect();
    }
  }

  // --- Pairing actions ---

  switchMode(mode: ConnectionMode): void {
    this.connectionMode.set(mode);
    void this.service.disconnect();
    this.rendezvousCode.set("");
    this.pskToken.set("");
    this.codeCopied.set(false);
    this.tokenCopied.set(false);
    this.pairingStage.set("token");
    this.beginListening();
  }

  onConnectionNameChanged(name: string): void {
    this.connectionName.set(name);
    this.service.setPendingSessionName(name);
  }

  copyCode(): void {
    this.platformUtilsService.copyToClipboard(this.rendezvousCode());
    this.codeCopied.set(true);
    setTimeout(() => this.codeCopied.set(false), 2000);
  }

  copyToken(): void {
    this.platformUtilsService.copyToClipboard(this.pskToken());
    this.tokenCopied.set(true);
    setTimeout(() => this.tokenCopied.set(false), 2000);
  }

  onFingerprintApproved(): void {
    this.pairingStage.set("handshake");
    void this.service.verifyFingerprint(true, this.connectionName() || undefined);
  }

  onFingerprintRejected(): void {
    void this.service.verifyFingerprint(false);
    this.toastService.showToast({
      variant: "warning",
      title: null,
      message: "Connection rejected",
    });
    this.goHome();
  }

  // --- Credential request actions ---

  async onCredentialApproved(selection: { cipherId: string; fields: Set<string> }): Promise<void> {
    const request = this.currentRequest();
    if (!request) {
      return;
    }

    const credential = await this.service.getCredentialById(selection.cipherId);
    const filtered = credential
      ? {
          credentialId: credential.credentialId,
          username: selection.fields.has("username") ? credential.username : undefined,
          password: selection.fields.has("password") ? credential.password : undefined,
          totp: selection.fields.has("totp") ? credential.totp : undefined,
          uri: credential.uri,
          domain: credential.domain,
        }
      : undefined;
    await this.service.respondToCredential(
      request.requestId,
      request.sessionId,
      true,
      filtered,
      request.query,
    );

    this.clearPendingRequest(request.sessionId);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: `Credentials sent for ${request.domain}`,
    });
    this.goHome();
  }

  async onCredentialDenied(): Promise<void> {
    const request = this.currentRequest();
    if (!request) {
      return;
    }

    await this.service.respondToCredential(
      request.requestId,
      request.sessionId,
      false,
      undefined,
      request.query,
    );
    this.clearPendingRequest(request.sessionId);

    if (request.matches.length > 0) {
      this.toastService.showToast({
        variant: "warning",
        title: null,
        message: `Request denied for ${request.domain}`,
      });
    }
    this.goHome();
  }

  openPendingRequest(connectionId: string): void {
    const request = this.pendingRequests().get(connectionId);
    if (request) {
      this.currentRequest.set(request);
      this.view.set(AgentAccessView.CredentialRequest);
    }
  }

  async openAuditLog(connectionId: string): Promise<void> {
    const conn = this.connections().find((c) => c.id === connectionId);
    if (!conn) {
      return;
    }
    const entries = await this.service.loadAuditLog(connectionId);
    this.auditLogEntries.set(entries);
    this.auditLogConnectionName.set(conn.name);
    this.view.set(AgentAccessView.AuditLog);
  }

  // --- Navigation ---

  protected readonly goHomeAction = async () => {
    this.goHome();
  };

  goHome(): void {
    this.view.set(AgentAccessView.Home);
    this.currentRequest.set(null);
    this.errorMessage.set("");

    // Don't disconnect/reconnect if there are pending requests — the active
    // client holds the event loop needed to respond to them.
    if (this.pendingRequests().size > 0) {
      return;
    }

    // Resume listening if enabled and we have connections
    if (this.listeningEnabled() && this.connections().length > 0) {
      void this.service.disconnect();
      this.subscribeToEvents();
      this.service.startListeningForAll().catch(() => {
        // Silent failure for auto-listen resume
      });
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeEvents$.next();
    this.unsubscribeEvents$.complete();
    void this.service.disconnect();
  }

  // --- Private helpers ---

  private beginListening(): void {
    const mode = this.connectionMode();
    this.subscribeToEvents();

    this.service.startListening(mode).catch((err: Error) => {
      this.errorMessage.set(err.message || "Failed to connect");
      this.view.set(AgentAccessView.Error);
    });
  }

  private subscribeToEvents(): void {
    this.unsubscribeEvents$.next();
    this.service.events$
      .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.unsubscribeEvents$))
      .subscribe((event) => {
        this.handleEvent(event);
      });
  }

  private handleEvent(event: UserClientEvent): void {
    switch (event.type) {
      case "listening":
      case "handshake_complete":
      case "handshake_progress":
      case "credential_approved":
      case "credential_denied":
      case "reconnecting":
      case "reconnected":
        break;

      case "rendezvous_code_generated":
        this.rendezvousCode.set(event.code);
        break;

      case "psk_token_generated":
        this.pskToken.set(event.token);
        break;

      case "handshake_start":
        if (this.view() === AgentAccessView.Pairing) {
          this.pairingStage.set("handshake");
        }
        break;

      case "handshake_fingerprint": {
        this.fingerprint.set(event.fingerprint);
        const identity = parseIdentityFingerprint(event.identity);
        this.remoteSessionId.set(identity);

        if (this.view() === AgentAccessView.Pairing) {
          if (this.connectionMode() === "psk") {
            // PSK: SDK already accepted the connection — just show success
            void this.onConnectionEstablished();
          } else {
            const known = identity ? this.connections().find((c) => c.id === identity) : undefined;
            if (known) {
              this.knownConnectionName.set(known.name);
              if (!this.connectionName()) {
                this.connectionName.set(known.name);
              }
              this.pairingStage.set("known");
            } else {
              this.pairingStage.set("fingerprint");
            }
          }
        }
        break;
      }

      case "fingerprint_verified":
        if (this.view() === AgentAccessView.Pairing) {
          void this.onConnectionEstablished();
        }
        break;

      case "session_refreshed":
        this.remoteSessionId.set(parseIdentityFingerprint(event.fingerprint));
        if (this.view() === AgentAccessView.Pairing) {
          void this.onConnectionEstablished();
        }
        break;

      case "fingerprint_rejected":
        this.toastService.showToast({
          variant: "warning",
          title: null,
          message: "Connection rejected by remote device",
        });
        this.goHome();
        break;

      case "credential_request":
        void this.handleCredentialRequest(event);
        break;

      case "client_disconnected":
        if (this.view() === AgentAccessView.Pairing) {
          this.view.set(AgentAccessView.Disconnected);
        } else {
          const disconnectedId = this.remoteSessionId();
          if (disconnectedId) {
            const disconnectedConn = this.connections().find((c) => c.id === disconnectedId);
            void this.service.appendAuditLog({
              connectionId: disconnectedId,
              connectionName: disconnectedConn?.name ?? "Unknown",
              timestamp: Date.now(),
              action: "disconnected",
            });
          }
          this.toastService.showToast({
            variant: "info",
            title: null,
            message: "Remote device disconnected",
          });
        }
        break;

      case "error":
        this.errorMessage.set(event.message);
        this.view.set(AgentAccessView.Error);
        break;
    }
  }

  private async onConnectionEstablished(): Promise<void> {
    const name = this.connectionName() || "Unnamed Connection";

    // Refresh the connections list from the repository (auto-persisted by WASM)
    await this.refreshConnections();

    // Show brief success animation before navigating home
    this.pairingStage.set("connected");
    this.connectionName.set(name);

    setTimeout(() => {
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: `Securely connected to ${name}`,
      });
      this.goHome();
    }, 1500);
  }

  private async handleCredentialRequest(
    event: Extract<UserClientEvent, { type: "credential_request" }>,
  ): Promise<void> {
    const query = event.query;
    const domain = "domain" in query ? query.domain : "search" in query ? query.search : query.id;
    const requestId = event.request_id;
    const sessionId = event.session_id;

    const matches = await this.service.lookupCredentials(domain);

    const remoteId = parseIdentityFingerprint(sessionId);
    const knownConn = this.connections().find((c) => c.id === remoteId);
    const connectionName = knownConn?.name ?? "Connected device";

    const requestData: CredentialRequestData = {
      domain,
      requestId,
      sessionId,
      connectionName,
      matches,
      query: event.query,
    };

    this.pendingRequests.update((map) => {
      const updated = new Map(map);
      updated.set(remoteId, requestData);
      return updated;
    });

    this.currentRequest.set(requestData);
    this.view.set(AgentAccessView.CredentialRequest);
  }

  private clearPendingRequest(sessionId: string): void {
    const remoteId = parseIdentityFingerprint(sessionId);
    this.pendingRequests.update((map) => {
      const updated = new Map(map);
      updated.delete(remoteId);
      return updated;
    });
  }

  private resetPairingState(): void {
    this.pairingStage.set("token");
    this.connectionMode.set("rendezvous");
    this.rendezvousCode.set("");
    this.pskToken.set("");
    this.fingerprint.set("");
    this.connectionName.set("");
    this.knownConnectionName.set("");
    this.remoteSessionId.set("");
    this.codeCopied.set(false);
    this.tokenCopied.set(false);
  }

  private async refreshConnections(): Promise<void> {
    const sessions = await this.service.listSessions();
    this.connections.set(sessions.map((s) => this.toDisplay(s)));
  }

  private toDisplay(record: SessionRecord): SessionDisplay {
    return {
      id: Utils.fromBufferToHex(new Uint8Array(record.fingerprint)),
      name: record.name ?? "Unnamed Connection",
      lastConnected: record.lastConnected,
    };
  }
}
