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

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import type { UserClientEvent } from "@bitwarden/sdk-internal";

import { PopupHeaderComponent } from "../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../platform/popup/layout/popup-page.component";

import { AgentAccessService, type ConnectionMode } from "./agent-access.service";
import { ConnectionEntry, CredentialRequestData } from "./agent-access.types";
import { AgentAccessCredentialRequestComponent } from "./pages/agent-access-credential-request.component";
import { AgentAccessHomeComponent } from "./pages/agent-access-home.component";
import { AgentAccessPairingComponent } from "./pages/agent-access-pairing.component";
import { AgentAccessStatusComponent } from "./pages/agent-access-status.component";

const AgentAccessView = Object.freeze({
  Home: "home",
  Pairing: "pairing",
  CredentialRequest: "credential-request",
  Disconnected: "disconnected",
  Error: "error",
} as const);
type AgentAccessView = (typeof AgentAccessView)[keyof typeof AgentAccessView];

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
    AgentAccessStatusComponent,
  ],
  providers: [AgentAccessService],
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
            (nameChanged)="connectionName.set($event)"
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
  protected readonly connections = signal<ConnectionEntry[]>([]);
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

  // Error state
  protected readonly errorMessage = signal("");

  private readonly service = inject(AgentAccessService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // Reassigned when re-subscribing on mode switch; takeUntilDestroyed handles final cleanup

  private readonly eventSubscription: { unsubscribe(): void } | null = null;

  async ngOnInit(): Promise<void> {
    const [savedConnections, savedListening] = await Promise.all([
      this.service.loadConnections(),
      this.service.getListeningEnabled(),
    ]);

    this.connections.set(savedConnections);
    this.listeningEnabled.set(savedListening);

    if (savedListening && savedConnections.length > 0) {
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
    const updated = await this.service.saveConnection({ ...conn, name: newName });
    this.connections.set(updated);
  }

  async onRemoveConnection(id: string): Promise<void> {
    await this.service.removeConnection(id);
    const updated = await this.service.loadConnections();
    this.connections.set(updated);

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
    this.eventSubscription?.unsubscribe();
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
    this.eventSubscription?.unsubscribe();
    this.eventSubscription = this.service.events$
      .pipe(takeUntilDestroyed(this.destroyRef))
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
            // PSK already authenticates — auto-approve without fingerprint verification
            this.pairingStage.set("handshake");
            void this.service.verifyFingerprint(true, this.connectionName() || undefined);
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
    const remoteId = this.remoteSessionId();
    const fp = this.fingerprint();
    const sessionData = this.service.getSessionData() ?? "";

    const existing = remoteId ? this.connections().find((c) => c.id === remoteId) : undefined;
    const name = this.connectionName() || existing?.name || "Unnamed Connection";
    const entry: ConnectionEntry = {
      id: remoteId,
      name,
      fingerprint: fp,
      lastUsed: Date.now(),
      sessionData,
    };

    const updated = await this.service.saveConnection(entry);
    this.connections.set(updated);

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
}

/** Extract hex from "IdentityFingerprint(hex...)" Debug format, or return as-is. */
function parseIdentityFingerprint(raw: string): string {
  const match = raw.match(/IdentityFingerprint\(([0-9a-f]+)\)/);
  return match ? match[1] : raw;
}
