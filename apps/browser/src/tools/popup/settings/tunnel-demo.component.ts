import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom, Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ButtonModule,
  CardComponent,
  DialogService,
  FormFieldModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { TunnelClientService, type TunnelClientEvent } from "./tunnel-client.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  standalone: true,
  selector: "tunnel-demo",
  templateUrl: "tunnel-demo.component.html",
  imports: [
    CommonModule,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
    FormFieldModule,
    ButtonModule,
    ReactiveFormsModule,
    TypographyModule,
    JslibModule,
  ],
})
export class TunnelDemoComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  protected formGroup = this.formBuilder.group({
    proxyUrl: ["ws://localhost:8080", Validators.required],
    username: ["", Validators.required],
  });

  protected isConnected = false;
  protected isListening = false;
  protected pairingCode = "";
  protected pairingPassword = "";
  protected connectionStatus = "Not connected";
  protected activityLog: Array<{ timestamp: Date; message: string; type: string }> = [];

  // Track pending approval callbacks
  private pendingConnectionApproval?: {
    clientId: string;
    remoteUsername: string;
    respond: (approved: boolean) => void;
  };

  private pendingCredentialRequest?: {
    domain: string;
    remoteUsername: string;
    respond: (approved: boolean, credential?: any) => void;
  };

  constructor(
    private dialogService: DialogService,
    private cipherService: CipherService,
    private accountService: AccountService,
    private formBuilder: FormBuilder,
    private tunnelClient: TunnelClientService,
  ) {}

  ngOnInit(): void {
    // Subscribe to tunnel client events
    this.tunnelClient.events$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => this.handleTunnelEvent(event));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.tunnelClient.close();
  }

  /**
   * Start pairing - connect to proxy and generate pairing code
   */
  async startPairing(): Promise<void> {
    if (this.formGroup.invalid) {
      return;
    }

    const proxyUrl = this.formGroup.value.proxyUrl?.trim();
    const username = this.formGroup.value.username?.trim();

    if (!proxyUrl || !username) {
      return;
    }

    try {
      this.connectionStatus = "Connecting...";
      this.isListening = true;
      this.activityLog = [];
      this.addActivityLog("Connecting to proxy server...", "info");

      await this.tunnelClient.listen({
        proxyUrl,
        username,
      });
    } catch (error) {
      this.isListening = false;
      this.connectionStatus = "Connection failed";
      this.addActivityLog(`Connection failed: ${error.message || error}`, "error");

      await this.dialogService.openSimpleDialog({
        title: "Connection Error",
        content: `Failed to connect to proxy: ${error.message || error}`,
        type: "danger",
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
      });
    }
  }

  /**
   * Disconnect from proxy
   */
  disconnect(): void {
    this.tunnelClient.close();
    this.isConnected = false;
    this.isListening = false;
    this.connectionStatus = "Disconnected";
    this.pairingCode = "";
    this.addActivityLog("Disconnected from proxy", "info");
  }

  /**
   * Copy pairing code to clipboard
   */
  async copyPairingCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.pairingCode);
      await this.dialogService.openSimpleDialog({
        title: "Copied",
        content: "Pairing code copied to clipboard",
        type: "success",
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
      });
    } catch {
      await this.dialogService.openSimpleDialog({
        title: "Copy Failed",
        content: "Failed to copy pairing code to clipboard",
        type: "danger",
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
      });
    }
  }

  /**
   * Handle tunnel client events
   */
  private async handleTunnelEvent(event: TunnelClientEvent | null): Promise<void> {
    if (!event) {
      return;
    }

    switch (event.type) {
      case "listening":
        this.isConnected = true;
        this.connectionStatus = `Connected as ${event.username}`;
        this.addActivityLog(`Connected to proxy as ${event.username}`, "success");
        break;

      case "pairing_code_generated":
        this.pairingCode = event.pairingCode;
        this.pairingPassword = event.password;
        this.addActivityLog(`Pairing code generated: ${event.password}`, "success");
        break;

      case "connection-request":
        this.pendingConnectionApproval = {
          clientId: event.clientId,
          remoteUsername: event.remoteUsername,
          respond: event.respond,
        };
        this.addActivityLog(
          `Connection request from ${event.remoteUsername} (${event.clientId})`,
          "warning",
        );
        await this.showConnectionApprovalDialog();
        break;

      case "connection-approved":
        this.addActivityLog(
          `Connection approved for ${event.remoteUsername} (${event.clientId})`,
          "success",
        );
        break;

      case "connection-denied":
        this.addActivityLog(
          `Connection denied for ${event.remoteUsername} (${event.clientId})`,
          "warning",
        );
        break;

      case "auth-complete":
        this.addActivityLog(
          `Authentication complete with ${event.remoteUsername} (${event.phase})`,
          "success",
        );
        break;

      case "handshake-start":
        this.addActivityLog(`Starting Noise handshake with ${event.remoteUsername}`, "info");
        break;

      case "handshake-progress":
        this.addActivityLog(`Handshake: ${event.message}`, "info");
        break;

      case "handshake-complete":
        this.addActivityLog(`Secure channel established with ${event.remoteUsername}`, "success");
        break;

      case "credential-request":
        this.pendingCredentialRequest = {
          domain: event.domain,
          remoteUsername: event.remoteUsername,
          respond: event.respond,
        };
        this.addActivityLog(
          `Credential request for ${event.domain} from ${event.remoteUsername}`,
          "warning",
        );
        await this.showCredentialRequestDialog();
        break;

      case "credential-approved":
        this.addActivityLog(`Credential sent for ${event.domain}`, "success");
        break;

      case "credential-denied":
        this.addActivityLog(`Credential request denied for ${event.domain}`, "warning");
        break;

      case "error":
        this.addActivityLog(`Error (${event.context}): ${event.error.message}`, "error");
        break;

      case "disconnected":
        this.isConnected = false;
        this.isListening = false;
        this.connectionStatus = "Disconnected";
        this.addActivityLog("Disconnected from proxy", "info");
        break;
    }
  }

  /**
   * Show dialog to approve/deny connection request
   */
  private async showConnectionApprovalDialog(): Promise<void> {
    if (!this.pendingConnectionApproval) {
      return;
    }

    const { remoteUsername, clientId, respond } = this.pendingConnectionApproval;

    const result = await this.dialogService.openSimpleDialog({
      title: "Connection Request",
      content: `Remote device requesting connection:\n\nUsername: ${remoteUsername}\nClient ID: ${clientId}\n\nDo you want to approve this connection?`,
      type: "warning",
      acceptButtonText: { key: "approve" },
      cancelButtonText: { key: "deny" },
    });

    respond(result);
    this.pendingConnectionApproval = undefined;
  }

  /**
   * Show dialog to approve/deny credential request
   */
  private async showCredentialRequestDialog(): Promise<void> {
    if (!this.pendingCredentialRequest) {
      return;
    }

    const { domain, remoteUsername, respond } = this.pendingCredentialRequest;

    // Verify user identity before sending credentials
    const verificationResult = await UserVerificationDialogComponent.open(this.dialogService, {
      verificationType: "client",
      title: "verificationRequired",
      bodyText: "verifyIdentityToSendCredentials",
      calloutOptions: {
        text: `Credential request for ${domain} from ${remoteUsername}`,
        type: "warning",
      },
    });

    // Check if user cancelled or verification failed
    if (verificationResult.userAction === "cancel" || !verificationResult.verificationSuccess) {
      respond(false);
      this.pendingCredentialRequest = undefined;
      return;
    }

    // Look up credential from vault
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const allCiphers = await this.cipherService.getAllDecrypted(userId);

    // Find matching cipher for domain
    const matchingCipher = allCiphers.find(
      (cipher: CipherView) =>
        cipher.type === CipherType.Login &&
        cipher.login?.uris?.some((uri) => uri.uri?.includes(domain)),
    );

    if (!matchingCipher || !matchingCipher.login) {
      await this.dialogService.openSimpleDialog({
        title: "No Credential Found",
        content: `No credential found for domain: ${domain}`,
        type: "warning",
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
      });
      respond(false);
      this.pendingCredentialRequest = undefined;
      return;
    }

    // Send credential
    const credential = {
      username: matchingCipher.login.username || "",
      password: matchingCipher.login.password || "",
      domain,
    };

    respond(true, credential);
    this.pendingCredentialRequest = undefined;
  }

  /**
   * Add entry to activity log
   */
  private addActivityLog(message: string, type: string): void {
    this.activityLog.push({
      timestamp: new Date(),
      message,
      type,
    });

    // Keep only last 50 entries
    if (this.activityLog.length > 50) {
      this.activityLog.shift();
    }
  }
}
