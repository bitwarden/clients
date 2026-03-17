import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnDestroy, signal } from "@angular/core";

import { ButtonModule, CalloutModule } from "@bitwarden/components";

interface LogEntry {
  time: string;
  message: string;
  level: "info" | "error" | "warn" | "event" | "data";
}

@Component({
  selector: "app-remote-access-test",
  standalone: true,
  imports: [CommonModule, ButtonModule, CalloutModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="max-width: 900px; margin: 40px auto; padding: 0 20px;">
      <h1 class="tw-text-xl tw-font-bold tw-text-main tw-mb-4">Remote Access SDK Test</h1>

      <bit-callout [type]="statusType()">{{ statusMessage() }}</bit-callout>

      <div class="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4 tw-mt-4">
        <!-- Controls -->
        <div class="tw-space-y-4">
          <div class="tw-space-y-2">
            <h3 class="tw-font-bold tw-text-main">1. Initialize</h3>
            <input
              class="tw-w-full tw-p-2 tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-bg-background tw-text-main tw-text-sm tw-font-mono"
              [value]="proxyUrl()"
              (input)="proxyUrl.set($any($event.target).value)"
              placeholder="ws://localhost:8080"
            />
            <button
              type="button"
              bitButton
              buttonType="primary"
              [disabled]="sdkLoaded()"
              (click)="initSdk()"
            >
              Load WASM + Generate Identity
            </button>
          </div>

          <div class="tw-space-y-2">
            <h3 class="tw-font-bold tw-text-main">2. Connect</h3>
            <div class="tw-flex tw-gap-2 tw-flex-wrap">
              <button
                type="button"
                bitButton
                buttonType="secondary"
                [disabled]="!sdkLoaded() || connected()"
                (click)="startMode('rendezvous')"
              >
                Rendezvous
              </button>
              <button
                type="button"
                bitButton
                buttonType="secondary"
                [disabled]="!sdkLoaded() || connected()"
                (click)="startMode('psk')"
              >
                PSK
              </button>
              <button
                type="button"
                bitButton
                buttonType="secondary"
                [disabled]="!sdkLoaded() || connected()"
                (click)="startMode('cached')"
              >
                Cached
              </button>
              <button
                type="button"
                bitButton
                buttonType="danger"
                [disabled]="!connected()"
                (click)="disconnect()"
              >
                Disconnect
              </button>
            </div>
          </div>

          @if (rendezvousCode()) {
            <div
              class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4 tw-text-center"
            >
              <div class="tw-text-xs tw-text-muted tw-mb-1">Rendezvous Code</div>
              <div class="tw-text-3xl tw-font-mono tw-font-bold tw-tracking-[0.3em] tw-text-main">
                {{ rendezvousCode() }}
              </div>
            </div>
          }

          @if (pskToken()) {
            <div
              class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4 tw-text-center"
            >
              <div class="tw-text-xs tw-text-muted tw-mb-1">PSK Token</div>
              <div class="tw-text-xs tw-font-mono tw-text-main tw-break-all">
                {{ pskToken() }}
              </div>
            </div>
          }

          @if (pendingFingerprint()) {
            <div
              class="tw-bg-background tw-border tw-border-solid tw-border-warning-600 tw-rounded tw-p-4 tw-text-center"
            >
              <div class="tw-text-xs tw-text-muted tw-mb-1">Verify Fingerprint</div>
              <div class="tw-text-lg tw-font-mono tw-font-bold tw-text-main tw-mb-2">
                {{ pendingFingerprint() }}
              </div>
              <div class="tw-flex tw-gap-2 tw-justify-center">
                <button
                  type="button"
                  bitButton
                  buttonType="primary"
                  (click)="respondFingerprint(true)"
                >
                  Approve
                </button>
                <button
                  type="button"
                  bitButton
                  buttonType="danger"
                  (click)="respondFingerprint(false)"
                >
                  Reject
                </button>
              </div>
            </div>
          }
        </div>

        <!-- Log -->
        <div class="tw-space-y-2">
          <div class="tw-flex tw-items-center tw-justify-between">
            <h3 class="tw-font-bold tw-text-main tw-mb-0">Log</h3>
            <button type="button" bitButton buttonType="secondary" (click)="clearLog()">
              Clear
            </button>
          </div>
          <div
            class="tw-bg-background tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-3 tw-overflow-y-auto tw-font-mono tw-text-xs"
            style="height: 500px"
          >
            @for (entry of logEntries(); track $index) {
              <div [class]="logEntryClass(entry.level)">
                <span class="tw-opacity-50">{{ entry.time }}</span>
                {{ entry.message }}
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class RemoteAccessTestComponent implements OnDestroy {
  protected readonly proxyUrl = signal("wss://rat1.lesspassword.dev");
  protected readonly statusMessage = signal("Not initialized");
  protected readonly statusType = signal<"info" | "success" | "danger" | "warning">("info");
  protected readonly sdkLoaded = signal(false);
  protected readonly connected = signal(false);
  protected readonly rendezvousCode = signal("");
  protected readonly pskToken = signal("");
  protected readonly pendingFingerprint = signal("");
  protected readonly logEntries = signal<LogEntry[]>([]);

  private readonly sdk: any = null;
  private readonly identity: Uint8Array | null = null;
  private readonly client: any = null;
  private readonly ws: WebSocket | null = null;
  private readonly onMessageCallback: ((msg: unknown) => void) | null = null;
  private readonly authenticated = false;

  private static readonly MAX_LOG_ENTRIES = 500;
  private static readonly LOG_LEVEL_CLASSES: Record<LogEntry["level"], string> = {
    error: "tw-py-0.5 tw-text-danger",
    warn: "tw-py-0.5 tw-text-warning",
    event: "tw-py-0.5 tw-text-success",
    data: "tw-py-0.5 tw-text-primary-600",
    info: "tw-py-0.5 tw-text-muted",
  };

  async initSdk(): Promise<void> {
    try {
      this.log("Loading WASM module...", "info");
      this.setStatus("Loading WASM...", "info");

      const sdk: any = await import("@bitwarden/sdk-internal");
      this.sdk = sdk;
      this.log("WASM module loaded", "info");

      this.log("Generating identity keypair...", "info");
      this.identity = sdk.RatUserClient.generate_identity();
      this.log(
        `Identity: ${this.identity!.length} bytes [${this.hexPreview(this.identity!)}]`,
        "data",
      );

      this.log("Testing sign_proxy_challenge...", "info");
      const fakeChallenge = JSON.stringify({
        AuthChallenge: Array.from(new Uint8Array(32)),
      });
      const response = sdk.RatUserClient.sign_proxy_challenge(this.identity, fakeChallenge);
      const parsed = JSON.parse(response);
      this.log(`sign_proxy_challenge OK, keys: ${Object.keys(parsed).join(", ")}`, "data");

      this.log("Testing RatUserClient constructor...", "info");
      const testClient = new sdk.RatUserClient(null, this.identity);
      const sessionData = testClient.get_session_data();
      const identityData = testClient.get_identity_data();
      this.log(`get_session_data: ${sessionData.length} chars`, "data");
      this.log(`get_identity_data: ${identityData.length} bytes`, "data");
      testClient.free();

      this.sdkLoaded.set(true);
      this.setStatus("SDK loaded, identity generated", "success");
      this.log("Ready to connect", "info");
    } catch (e) {
      this.logError(e);
      this.setStatus(`Init failed: ${(e as Error).message}`, "danger");
    }
  }

  async startMode(mode: "rendezvous" | "psk" | "cached"): Promise<void> {
    try {
      this.setStatus(`Connecting (${mode})...`, "info");
      this.rendezvousCode.set("");
      this.pskToken.set("");
      this.pendingFingerprint.set("");

      // Create inline proxy client (uses browser WebSocket directly)
      const proxyClient = this.createProxyClient();

      this.client = new this.sdk.RatUserClient(null, this.identity);
      this.log("RatUserClient created", "info");

      await this.client.connect(proxyClient);
      this.log("Connected to proxy", "info");
      this.connected.set(true);
      this.setStatus(`Connected (${mode})`, "success");

      const eventCallback = (event: any) => {
        this.log(JSON.stringify(event), "event");
        this.handleEvent(event);
      };

      this.log(`Starting ${mode} mode...`, "info");
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

      this.log("Event loop ended", "info");
      this.connected.set(false);
      this.setStatus("Disconnected", "info");
    } catch (e) {
      this.logError(e);
      this.connected.set(false);
      this.setStatus(`Failed: ${(e as Error).message}`, "danger");
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.client = null;
      this.authenticated = false;
      this.connected.set(false);
      this.setStatus("Disconnected", "info");
      this.log("Disconnected", "info");
    } catch (e) {
      this.logError(e);
    }
  }

  respondFingerprint(approved: boolean): void {
    if (!this.client) {
      return;
    }
    this.log(`Fingerprint ${approved ? "approved" : "rejected"}`, "info");
    this.client.send_response({ type: "verify_fingerprint", approved });
    this.pendingFingerprint.set("");
  }

  clearLog(): void {
    this.logEntries.set([]);
  }

  ngOnDestroy(): void {
    void this.disconnect();
  }

  protected logEntryClass(level: LogEntry["level"]): string {
    return RemoteAccessTestComponent.LOG_LEVEL_CLASSES[level] ?? "tw-py-0.5 tw-text-muted";
  }

  // Inline proxy client — implements the RatProxyClient interface using browser WebSocket
  private createProxyClient(): any {
    const self = this;
    return {
      async connect(onMessage: (msg: unknown) => void): Promise<void> {
        self.onMessageCallback = onMessage;
        const signFn = (idCose: number[], challengeJson: string) =>
          self.sdk.RatUserClient.sign_proxy_challenge(new Uint8Array(idCose), challengeJson);

        return new Promise<void>((resolve, reject) => {
          self.log(`Connecting to ${self.proxyUrl()}...`, "info");
          self.ws = new WebSocket(self.proxyUrl());

          self.ws.onmessage = (event: MessageEvent) => {
            const data = typeof event.data === "string" ? event.data : "";
            let msg: any;
            try {
              msg = JSON.parse(data);
            } catch {
              self.log(`Unparseable message: ${data.slice(0, 200)}`, "warn");
              return;
            }

            if (msg.AuthChallenge != null && !self.authenticated) {
              try {
                self.log(`Auth challenge received (${msg.AuthChallenge.length} bytes)`, "info");
                const challengeJson = JSON.stringify(msg);
                const responseJson = signFn(Array.from(self.identity!), challengeJson);
                self.ws?.send(responseJson);
                self.authenticated = true;
                self.log("Auth response sent, authenticated", "info");
                resolve();
              } catch (e) {
                self.log(`Auth failed: ${(e as Error).message}`, "error");
                reject(e);
              }
              return;
            }

            // Transform proxy wire format to the format WASM expects
            const transformed = self.transformProxyMessage(msg);
            if (transformed) {
              self.log(`Proxy: ${JSON.stringify(transformed).slice(0, 200)}`, "event");
              onMessage(transformed);
            } else {
              self.log(`Unhandled proxy msg: ${JSON.stringify(msg).slice(0, 200)}`, "warn");
            }
          };

          self.ws.onerror = () => {
            self.log("WebSocket error", "error");
            if (!self.authenticated) {
              reject(new Error("WebSocket error"));
            }
          };

          self.ws.onclose = (ev: CloseEvent) => {
            self.log(`WebSocket closed: ${ev.code} ${ev.reason}`, "info");
            if (!self.authenticated) {
              reject(new Error(`Closed before auth: ${ev.code}`));
            }
            self.ws = null;
          };
        });
      },

      async request_rendezvous(): Promise<void> {
        self.ws?.send(JSON.stringify("GetRendevouz"));
      },

      async request_identity(code: string): Promise<void> {
        self.ws?.send(JSON.stringify({ GetIdentity: code }));
      },

      async send_to(fingerprint: string, data: Uint8Array): Promise<void> {
        const bytes: number[] = [];
        for (let i = 0; i < fingerprint.length; i += 2) {
          bytes.push(parseInt(fingerprint.substring(i, i + 2), 16));
        }
        self.ws?.send(JSON.stringify({ Send: { destination: bytes, payload: Array.from(data) } }));
      },

      async disconnect(): Promise<void> {
        self.ws?.close();
        self.ws = null;
        self.authenticated = false;
      },
    };
  }

  /**
   * Transform raw proxy wire messages ({Send: ...}, {RendevouzInfo: ...})
   * into the {type: "...", ...} format that the WASM parser expects.
   */
  private transformProxyMessage(msg: any): any | null {
    if (msg.RendevouzInfo != null) {
      const info = msg.RendevouzInfo;
      return {
        type: "rendezvous_info",
        code: typeof info === "object" ? info.code : info,
      };
    }
    if (msg.IdentityInfo != null) {
      return {
        type: "identity_info",
        fingerprint: this.serializeFingerprint(msg.IdentityInfo.fingerprint),
        identity: msg.IdentityInfo.identity,
      };
    }
    if (msg.Send != null) {
      return {
        type: "send",
        source: this.serializeFingerprint(msg.Send.source),
        destination: this.serializeFingerprint(msg.Send.destination),
        payload: msg.Send.payload,
      };
    }
    return null;
  }

  private serializeFingerprint(fp: unknown): string {
    if (typeof fp === "string") {
      return fp;
    }
    if (Array.isArray(fp)) {
      return fp.map((b: number) => b.toString(16).padStart(2, "0")).join("");
    }
    return "";
  }

  private handleEvent(event: any): void {
    switch (event.type) {
      case "rendezvous_code_generated":
        this.rendezvousCode.set(event.code);
        break;
      case "psk_token_generated":
        this.pskToken.set(event.token);
        break;
      case "handshake_fingerprint":
        this.pendingFingerprint.set(event.fingerprint);
        this.setStatus(`Verify fingerprint: ${event.fingerprint}`, "warning");
        break;
      case "fingerprint_verified":
        this.pendingFingerprint.set("");
        this.setStatus("Connected — fingerprint verified", "success");
        break;
      case "fingerprint_rejected":
        this.pendingFingerprint.set("");
        this.setStatus("Fingerprint rejected", "danger");
        break;
      case "credential_request":
        this.setStatus(`Credential request: ${event.query?.domain || "?"}`, "warning");
        this.log(`Auto-responding with mock credential for ${event.query?.domain}`, "data");
        this.client?.send_response({
          type: "respond_credential",
          request_id: event.request_id,
          session_id: event.session_id,
          query: event.query,
          approved: true,
          credential: {
            username: "testuser@bitwarden.com",
            password: "SuperSecret123!",
            totp: "JBSWY3DPEHPK3PXP",
            uri: `https://${event.query?.domain || "example.com"}`,
          },
        });
        break;
      case "error":
        this.setStatus(`Error: ${event.message}`, "danger");
        break;
      case "client_disconnected":
        this.connected.set(false);
        this.setStatus("Client disconnected", "info");
        break;
    }
  }

  private setStatus(msg: string, type: "info" | "success" | "danger" | "warning"): void {
    this.statusMessage.set(msg);
    this.statusType.set(type);
  }

  private log(msg: string, level: LogEntry["level"]): void {
    const time = new Date().toISOString().slice(11, 23);
    this.logEntries.update((entries) => {
      const updated = [...entries, { time, message: msg, level }];
      return updated.length > RemoteAccessTestComponent.MAX_LOG_ENTRIES
        ? updated.slice(-RemoteAccessTestComponent.MAX_LOG_ENTRIES)
        : updated;
    });
  }

  private logError(e: unknown): void {
    const err = e as Error;
    this.log(`ERROR: ${err.message}`, "error");
    if (err.stack) {
      this.log(err.stack.split("\n").slice(1, 3).join("\n"), "error");
    }
  }

  private hexPreview(bytes: Uint8Array): string {
    return Array.from(bytes.slice(0, 16))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
  }
}
