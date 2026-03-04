import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnDestroy,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  CalloutModule,
  IconModule,
  ToggleGroupModule,
  SpinnerComponent,
} from "@bitwarden/components";

import { PopupFooterComponent } from "../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../platform/popup/layout/popup-page.component";

import {
  CredentialLookupResult,
  RemoteAccessService,
  type ConnectionMode,
  type RatEvent,
} from "./remote-access.service";

const RemoteAccessState = Object.freeze({
  Idle: "idle",
  Listening: "listening",
  Handshake: "handshake",
  Connected: "connected",
  CredentialRequest: "credential-request",
  Approved: "approved",
  Denied: "denied",
  Disconnected: "disconnected",
  Error: "error",
} as const);
type RemoteAccessState = (typeof RemoteAccessState)[keyof typeof RemoteAccessState];

const ConnectionModeEnum = Object.freeze({
  Rendezvous: "rendezvous" as ConnectionMode,
  Psk: "psk" as ConnectionMode,
  Cached: "cached" as ConnectionMode,
} as const);

interface CredentialRequest {
  domain: string;
  requestId: string;
  sessionId: string;
  username: string;
  uri: string;
}

@Component({
  selector: "app-remote-access",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    ButtonModule,
    CalloutModule,
    IconModule,
    ToggleGroupModule,
    SpinnerComponent,
  ],
  providers: [RemoteAccessService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <popup-page>
      <popup-header slot="header" [pageTitle]="'remoteAccess' | i18n"></popup-header>

      @switch (state()) {
        @case ("idle") {
          <div class="tw-p-4 tw-space-y-4">
            <p class="tw-text-main tw-mb-0">Share credentials securely with a remote device.</p>

            <bit-toggle-group
              fullWidth
              [selected]="connectionMode()"
              (selectedChange)="connectionMode.set($event)"
            >
              <bit-toggle [value]="ConnectionModeEnum.Rendezvous">Rendezvous</bit-toggle>
              <bit-toggle [value]="ConnectionModeEnum.Psk">PSK Token</bit-toggle>
              <bit-toggle [value]="ConnectionModeEnum.Cached">Cached</bit-toggle>
            </bit-toggle-group>

            @switch (connectionMode()) {
              @case ("rendezvous") {
                <p class="tw-text-muted tw-text-sm tw-mb-0">
                  Generate a 6-character code to share verbally with the remote device.
                </p>
              }
              @case ("psk") {
                <p class="tw-text-muted tw-text-sm tw-mb-0">
                  Generate a pre-shared key token for automated connection.
                </p>
              }
              @case ("cached") {
                <p class="tw-text-muted tw-text-sm tw-mb-0">
                  Listen for previously paired devices to reconnect.
                </p>
              }
            }
          </div>

          <popup-footer slot="footer">
            <button type="button" bitButton buttonType="primary" (click)="startListening()">
              Start Listening
            </button>
          </popup-footer>
        }

        @case ("listening") {
          <div class="tw-p-4 tw-space-y-4">
            <bit-callout type="info"> Waiting for a remote device to connect... </bit-callout>

            @switch (connectionMode()) {
              @case ("rendezvous") {
                <div
                  class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4 tw-text-center"
                >
                  <p class="tw-text-xs tw-text-muted tw-mb-2">Rendezvous Code</p>
                  <p
                    class="tw-text-3xl tw-font-mono tw-tracking-[0.3em] tw-text-main tw-font-bold tw-mb-2"
                  >
                    {{ rendezvousCode() }}
                  </p>
                  <button
                    type="button"
                    bitButton
                    buttonType="secondary"
                    (click)="copyCode()"
                    class="tw-text-xs"
                  >
                    {{ codeCopied() ? "Copied" : "Copy Code" }}
                  </button>
                  @if (codeCopied()) {
                    <p class="tw-text-xs tw-text-success tw-mt-2 tw-mb-0">Copied to clipboard</p>
                  }
                </div>
              }
              @case ("psk") {
                <div
                  class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4 tw-text-center"
                >
                  <p class="tw-text-xs tw-text-muted tw-mb-2">PSK Token</p>
                  <p class="tw-text-xs tw-font-mono tw-text-main tw-break-all tw-mb-2">
                    {{ pskToken() }}
                  </p>
                  <button
                    type="button"
                    bitButton
                    buttonType="secondary"
                    (click)="copyToken()"
                    class="tw-text-xs"
                  >
                    {{ tokenCopied() ? "Copied" : "Copy Token" }}
                  </button>
                  @if (tokenCopied()) {
                    <p class="tw-text-xs tw-text-success tw-mt-2 tw-mb-0">Copied to clipboard</p>
                  }
                </div>
              }
              @case ("cached") {
                <p class="tw-text-muted tw-text-sm tw-mb-0">Listening for cached sessions...</p>
              }
            }

            <div class="tw-flex tw-justify-center">
              <bit-spinner size="small"></bit-spinner>
            </div>
          </div>

          <popup-footer slot="footer">
            <button type="button" bitButton buttonType="secondary" (click)="reset()">
              {{ "cancel" | i18n }}
            </button>
          </popup-footer>
        }

        @case ("handshake") {
          <div
            class="tw-p-4 tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-h-full"
          >
            <bit-spinner size="large"></bit-spinner>
            <p class="tw-text-main tw-mb-0">Performing secure handshake...</p>
          </div>
        }

        @case ("connected") {
          <div class="tw-p-4 tw-space-y-4">
            <bit-callout type="success"> Securely connected </bit-callout>

            @if (fingerprint()) {
              <bit-callout type="warning" title="Verify Connection">
                Confirm this fingerprint matches what is shown on the remote device. If they do not
                match, disconnect immediately.
              </bit-callout>

              <div
                class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4 tw-text-center"
              >
                <p class="tw-text-xs tw-text-muted tw-mb-2">Connection Fingerprint</p>
                <p
                  class="tw-text-3xl tw-font-mono tw-tracking-[0.3em] tw-text-main tw-font-bold tw-mb-0"
                >
                  {{ fingerprint() }}
                </p>
              </div>
            }

            <div class="tw-flex tw-items-center tw-gap-2 tw-text-muted tw-text-sm">
              <bit-spinner size="small"></bit-spinner>
              <span>Waiting for credential requests...</span>
            </div>
          </div>

          <popup-footer slot="footer">
            <button type="button" bitButton buttonType="secondary" (click)="disconnect()">
              Disconnect
            </button>
          </popup-footer>
        }

        @case ("credential-request") {
          <div class="tw-p-4 tw-space-y-4">
            <p class="tw-text-main tw-mb-0">
              The remote device is requesting credentials for this site.
            </p>

            <div
              class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4"
            >
              <p class="tw-text-lg tw-font-bold tw-text-main tw-mb-1">
                {{ currentRequest()?.domain }}
              </p>
              <p class="tw-text-sm tw-text-muted tw-mb-1">
                {{ currentRequest()?.uri }}
              </p>
              <p class="tw-text-sm tw-text-main tw-mb-0">
                {{ currentRequest()?.username }}
              </p>
            </div>
          </div>

          <popup-footer slot="footer">
            <button type="button" bitButton buttonType="primary" (click)="approveCredential()">
              Approve
            </button>
            <button
              type="button"
              bitButton
              buttonType="danger"
              slot="end"
              (click)="denyCredential()"
            >
              Deny
            </button>
          </popup-footer>
        }

        @case ("approved") {
          <div class="tw-p-4">
            <bit-callout type="success">
              Credentials sent for {{ currentRequest()?.domain }}.
            </bit-callout>
          </div>
        }

        @case ("denied") {
          <div class="tw-p-4">
            <bit-callout type="warning">
              Request denied for {{ currentRequest()?.domain }}.
            </bit-callout>
          </div>
        }

        @case ("disconnected") {
          <div class="tw-p-4">
            <bit-callout type="info"> Remote device disconnected. </bit-callout>
          </div>

          <popup-footer slot="footer">
            <button type="button" bitButton buttonType="primary" (click)="reset()">
              Start Over
            </button>
          </popup-footer>
        }

        @case ("error") {
          <div class="tw-p-4">
            <bit-callout type="danger" title="Error">
              {{ errorMessage() }}
            </bit-callout>
          </div>

          <popup-footer slot="footer">
            <button type="button" bitButton buttonType="primary" (click)="reset()">
              Try Again
            </button>
          </popup-footer>
        }
      }
    </popup-page>
  `,
})
export class RemoteAccessComponent implements OnDestroy {
  protected readonly RemoteAccessState = RemoteAccessState;
  protected readonly ConnectionModeEnum = ConnectionModeEnum;

  protected readonly state = signal<RemoteAccessState>(RemoteAccessState.Idle);
  protected readonly connectionMode = signal<ConnectionMode>("rendezvous");
  protected readonly rendezvousCode = signal("");
  protected readonly pskToken = signal("");
  protected readonly fingerprint = signal("");
  protected readonly currentRequest = signal<CredentialRequest | null>(null);
  protected readonly errorMessage = signal("");
  protected readonly codeCopied = signal(false);
  protected readonly tokenCopied = signal(false);

  private service = inject(RemoteAccessService);
  private platformUtilsService = inject(PlatformUtilsService);
  private destroyRef = inject(DestroyRef);
  private pendingCredential: CredentialLookupResult | null = null;
  private eventSubscription: { unsubscribe(): void } | null = null;

  startListening(): void {
    const mode = this.connectionMode();
    this.state.set(RemoteAccessState.Listening);

    // Unsubscribe any previous subscription before creating a new one
    this.eventSubscription?.unsubscribe();
    this.eventSubscription = this.service.events$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.handleEvent(event);
      });

    // Start listening (runs until disconnect)
    this.service.startListening(mode).catch((err: Error) => {
      this.state.set(RemoteAccessState.Error);
      this.errorMessage.set(err.message || "Failed to connect");
    });
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

  approveCredential(): void {
    const request = this.currentRequest();
    if (!request) {
      return;
    }
    this.state.set(RemoteAccessState.Approved);
    void this.service.respondToCredential(
      request.requestId,
      request.sessionId,
      true,
      this.pendingCredential ?? undefined,
    );
  }

  denyCredential(): void {
    const request = this.currentRequest();
    if (!request) {
      return;
    }
    this.state.set(RemoteAccessState.Denied);
    void this.service.respondToCredential(request.requestId, request.sessionId, false);
  }

  disconnect(): void {
    void this.service.disconnect();
    this.state.set(RemoteAccessState.Disconnected);
  }

  reset(): void {
    this.eventSubscription?.unsubscribe();
    this.eventSubscription = null;
    void this.service.disconnect();
    this.state.set(RemoteAccessState.Idle);
    this.rendezvousCode.set("");
    this.pskToken.set("");
    this.fingerprint.set("");
    this.codeCopied.set(false);
    this.tokenCopied.set(false);
    this.errorMessage.set("");
    this.currentRequest.set(null);
    this.pendingCredential = null;
  }

  ngOnDestroy(): void {
    this.eventSubscription?.unsubscribe();
    void this.service.disconnect();
  }

  private handleEvent(event: RatEvent): void {
    switch (event.type) {
      case "listening":
        this.state.set(RemoteAccessState.Listening);
        break;

      case "rendezvous_code_generated":
        this.rendezvousCode.set(event["code"] as string);
        break;

      case "psk_token_generated":
        this.pskToken.set(event["token"] as string);
        break;

      case "handshake_start":
        this.state.set(RemoteAccessState.Handshake);
        break;

      case "handshake_complete":
        break;

      case "handshake_fingerprint":
        this.fingerprint.set(event["fingerprint"] as string);
        if (this.connectionMode() === "rendezvous") {
          // Rendezvous mode requires fingerprint verification before caching
          void this.service.verifyFingerprint(true);
        } else {
          // PSK/cached connections are already trusted — go straight to Connected
          this.state.set(RemoteAccessState.Connected);
        }
        break;

      case "fingerprint_verified":
      case "session_refreshed":
        this.state.set(RemoteAccessState.Connected);
        break;

      case "fingerprint_rejected":
        this.state.set(RemoteAccessState.Disconnected);
        break;

      case "credential_request":
        void this.handleCredentialRequest(event);
        break;

      case "credential_approved":
        this.state.set(RemoteAccessState.Approved);
        setTimeout(() => {
          if (this.state() === RemoteAccessState.Approved) {
            this.state.set(RemoteAccessState.Connected);
          }
        }, 1500);
        break;

      case "credential_denied":
        this.state.set(RemoteAccessState.Denied);
        setTimeout(() => {
          if (this.state() === RemoteAccessState.Denied) {
            this.state.set(RemoteAccessState.Connected);
          }
        }, 1500);
        break;

      case "client_disconnected":
        this.state.set(RemoteAccessState.Disconnected);
        break;

      case "error":
        this.errorMessage.set(event["message"] as string);
        this.state.set(RemoteAccessState.Error);
        break;
    }
  }

  private async handleCredentialRequest(event: RatEvent): Promise<void> {
    const domain = event["domain"] as string;
    const requestId = event["request_id"] as string;
    const sessionId = event["session_id"] as string;

    // Look up matching credential in vault
    const credential = await this.service.lookupCredential(domain);
    this.pendingCredential = credential;

    this.currentRequest.set({
      domain,
      requestId,
      sessionId,
      username: credential?.username ?? "(no match found)",
      uri: credential?.uri ?? `https://${domain}`,
    });
    this.state.set(RemoteAccessState.CredentialRequest);
  }
}
