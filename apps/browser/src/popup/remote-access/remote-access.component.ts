import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnDestroy, signal } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  CalloutModule,
  ToggleGroupModule,
  SpinnerComponent,
} from "@bitwarden/components";

import { PopupFooterComponent } from "../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../platform/popup/layout/popup-page.component";

const RemoteAccessState = Object.freeze({
  Idle: "idle",
  Listening: "listening",
  Handshake: "handshake",
  Fingerprint: "fingerprint",
  Connected: "connected",
  CredentialRequest: "credential-request",
  Approved: "approved",
  Denied: "denied",
  Disconnected: "disconnected",
  Error: "error",
} as const);
type RemoteAccessState = (typeof RemoteAccessState)[keyof typeof RemoteAccessState];

const ConnectionMode = Object.freeze({
  Rendezvous: "rendezvous",
  Psk: "psk",
  Cached: "cached",
} as const);
type ConnectionMode = (typeof ConnectionMode)[keyof typeof ConnectionMode];

interface CredentialRequest {
  domain: string;
  requestId: string;
  sessionId: string;
  username: string;
  uri: string;
}

const MOCK_REQUESTS = [
  { domain: "github.com", username: "dev-user@example.com", uri: "https://github.com/login" },
  {
    domain: "mail.google.com",
    username: "alice.smith@gmail.com",
    uri: "https://accounts.google.com",
  },
  {
    domain: "aws.amazon.com",
    username: "admin@acme-corp.io",
    uri: "https://signin.aws.amazon.com/console",
  },
];

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
    ToggleGroupModule,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <popup-page>
      <popup-header slot="header" [pageTitle]="'remoteAccess' | i18n"></popup-header>

      @switch (state()) {
        @case ("idle") {
          <div class="tw-p-4 tw-space-y-4">
            <p class="tw-text-main tw-mb-0">
              Share credentials securely with a remote device.
            </p>

            <bit-toggle-group
              fullWidth
              [selected]="connectionMode()"
              (selectedChange)="connectionMode.set($event)"
            >
              <bit-toggle [value]="ConnectionMode.Rendezvous">Rendezvous</bit-toggle>
              <bit-toggle [value]="ConnectionMode.Psk">PSK Token</bit-toggle>
              <bit-toggle [value]="ConnectionMode.Cached">Cached</bit-toggle>
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
            <button bitButton buttonType="primary" (click)="startListening()">
              Start Listening
            </button>
          </popup-footer>
        }

        @case ("listening") {
          <div class="tw-p-4 tw-space-y-4">
            <bit-callout type="info">
              Waiting for a remote device to connect...
            </bit-callout>

            @switch (connectionMode()) {
              @case ("rendezvous") {
                <div
                  class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4 tw-text-center"
                >
                  <p class="tw-text-xs tw-text-muted tw-mb-2">Rendezvous Code</p>
                  <p
                    class="tw-text-3xl tw-font-mono tw-tracking-[0.3em] tw-text-main tw-font-bold tw-mb-0"
                  >
                    {{ rendezvousCode() }}
                  </p>
                </div>
              }
              @case ("psk") {
                <div
                  class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4"
                >
                  <p class="tw-text-xs tw-text-muted tw-mb-2">PSK Token</p>
                  <p
                    class="tw-text-xs tw-font-mono tw-text-main tw-break-all tw-mb-0"
                  >
                    {{ pskToken() }}
                  </p>
                </div>
              }
              @case ("cached") {
                <p class="tw-text-muted tw-text-sm tw-mb-0">
                  Listening for cached sessions...
                </p>
              }
            }

            <div class="tw-flex tw-justify-center">
              <bit-spinner size="small"></bit-spinner>
            </div>
          </div>

          <popup-footer slot="footer">
            <button bitButton buttonType="secondary" (click)="reset()">
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

        @case ("fingerprint") {
          <div class="tw-p-4 tw-space-y-4">
            <bit-callout type="warning" title="Verify Connection">
              Confirm this fingerprint matches what is shown on the remote device.
            </bit-callout>

            <div
              class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4 tw-text-center"
            >
              <p class="tw-text-xs tw-text-muted tw-mb-2">Fingerprint</p>
              <p
                class="tw-text-3xl tw-font-mono tw-tracking-[0.3em] tw-text-main tw-font-bold tw-mb-0"
              >
                {{ fingerprint() }}
              </p>
            </div>
          </div>

          <popup-footer slot="footer">
            <button bitButton buttonType="primary" (click)="confirmFingerprint()">
              {{ "confirm" | i18n }}
            </button>
            <button
              bitButton
              buttonType="danger"
              slot="end"
              (click)="rejectFingerprint()"
            >
              Reject
            </button>
          </popup-footer>
        }

        @case ("connected") {
          <div class="tw-p-4 tw-space-y-4">
            <bit-callout type="success">
              Securely connected
            </bit-callout>

            <div class="tw-flex tw-items-center tw-gap-2 tw-text-muted tw-text-sm">
              <bit-spinner size="small"></bit-spinner>
              <span>Waiting for credential requests...</span>
            </div>
          </div>

          <popup-footer slot="footer">
            <button bitButton buttonType="secondary" (click)="disconnect()">
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
                <i class="bwi bwi-user tw-mr-1" aria-hidden="true"></i>
                {{ currentRequest()?.username }}
              </p>
            </div>
          </div>

          <popup-footer slot="footer">
            <button bitButton buttonType="primary" (click)="approveCredential()">
              Approve
            </button>
            <button
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
            <bit-callout type="info">
              Remote device disconnected.
            </bit-callout>
          </div>

          <popup-footer slot="footer">
            <button bitButton buttonType="primary" (click)="reset()">
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
            <button bitButton buttonType="primary" (click)="reset()">
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
  protected readonly ConnectionMode = ConnectionMode;

  protected readonly state = signal<RemoteAccessState>(RemoteAccessState.Idle);
  protected readonly connectionMode = signal<ConnectionMode>(ConnectionMode.Rendezvous);
  protected readonly rendezvousCode = signal("");
  protected readonly pskToken = signal("");
  protected readonly fingerprint = signal("");
  protected readonly currentRequest = signal<CredentialRequest | null>(null);
  protected readonly errorMessage = signal("");

  private mockRequestIndex = 0;
  private pendingTimers: ReturnType<typeof setTimeout>[] = [];

  startListening(): void {
    const mode = this.connectionMode();
    this.state.set(RemoteAccessState.Listening);

    if (mode === ConnectionMode.Rendezvous) {
      this.rendezvousCode.set(this.generateRendezvousCode());
    } else if (mode === ConnectionMode.Psk) {
      this.pskToken.set(this.generatePskToken());
    }

    this.scheduleTimeout(() => this.simulateHandshakeStart(), 2500);
  }

  confirmFingerprint(): void {
    this.state.set(RemoteAccessState.Connected);
    this.scheduleTimeout(() => this.simulateCredentialRequest(), 2000);
  }

  rejectFingerprint(): void {
    this.state.set(RemoteAccessState.Disconnected);
  }

  approveCredential(): void {
    this.state.set(RemoteAccessState.Approved);
    this.scheduleTimeout(() => {
      this.state.set(RemoteAccessState.Connected);
      this.scheduleTimeout(() => this.simulateCredentialRequest(), 3000);
    }, 1500);
  }

  denyCredential(): void {
    this.state.set(RemoteAccessState.Denied);
    this.scheduleTimeout(() => {
      this.state.set(RemoteAccessState.Connected);
      this.scheduleTimeout(() => this.simulateCredentialRequest(), 3000);
    }, 1500);
  }

  disconnect(): void {
    this.clearTimers();
    this.state.set(RemoteAccessState.Disconnected);
  }

  reset(): void {
    this.clearTimers();
    this.state.set(RemoteAccessState.Idle);
    this.rendezvousCode.set("");
    this.pskToken.set("");
    this.fingerprint.set("");
    this.errorMessage.set("");
    this.currentRequest.set(null);
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private simulateHandshakeStart(): void {
    if (this.state() !== RemoteAccessState.Listening) {
      return;
    }
    this.state.set(RemoteAccessState.Handshake);
    this.scheduleTimeout(() => this.simulateHandshakeComplete(), 1500);
  }

  private simulateHandshakeComplete(): void {
    if (this.state() !== RemoteAccessState.Handshake) {
      return;
    }

    if (this.connectionMode() === ConnectionMode.Cached) {
      this.state.set(RemoteAccessState.Connected);
      this.scheduleTimeout(() => this.simulateCredentialRequest(), 2000);
    } else {
      this.fingerprint.set(this.generateFingerprint());
      this.state.set(RemoteAccessState.Fingerprint);
    }
  }

  private simulateCredentialRequest(): void {
    if (this.state() !== RemoteAccessState.Connected) {
      return;
    }
    const mock = MOCK_REQUESTS[this.mockRequestIndex % MOCK_REQUESTS.length];
    this.mockRequestIndex++;
    this.currentRequest.set({
      domain: mock.domain,
      requestId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      username: mock.username,
      uri: mock.uri,
    });
    this.state.set(RemoteAccessState.CredentialRequest);
  }

  private generateRendezvousCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
      "",
    );
  }

  private generatePskToken(): string {
    const hex = (len: number) =>
      Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return `${hex(64)}_${hex(64)}`;
  }

  private generateFingerprint(): string {
    return Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16))
      .join("")
      .toUpperCase();
  }

  private scheduleTimeout(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      this.pendingTimers = this.pendingTimers.filter((t) => t !== id);
      fn();
    }, ms);
    this.pendingTimers.push(id);
  }

  private clearTimers(): void {
    for (const id of this.pendingTimers) {
      clearTimeout(id);
    }
    this.pendingTimers = [];
  }
}
