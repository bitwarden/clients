import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";

const DEFAULT_PROXY_URL = "wss://rat1.lesspassword.dev";

interface LogEntry {
  time: string;
  level: "info" | "error" | "event";
  message: string;
}

/**
 * In-memory Repository implementation for the WASM UserClient.
 * Implements the same interface as ChromeSessionRepository but
 * stores everything in a plain object (no persistence needed for testing).
 */
class InMemorySessionRepository {
  private sessions: Record<string, unknown> = {};

  async get(id: string): Promise<unknown | null> {
    return this.sessions[id] ?? null;
  }

  async list(): Promise<unknown[]> {
    return Object.values(this.sessions);
  }

  async set(id: string, value: unknown): Promise<void> {
    this.sessions[id] = value;
  }

  async setBulk(values: [string, unknown][]): Promise<void> {
    for (const [id, value] of values) {
      this.sessions[id] = value;
    }
  }

  async remove(id: string): Promise<void> {
    delete this.sessions[id];
  }

  async removeBulk(keys: string[]): Promise<void> {
    for (const key of keys) {
      delete this.sessions[key];
    }
  }

  async removeAll(): Promise<void> {
    this.sessions = {};
  }
}

/**
 * Minimal proxy client for the web vault test page.
 * Same logic as BrowserProxyClient but without browser extension dependencies.
 */
class TestProxyClient {
  private ws: WebSocket | null = null;
  private onMessageCallback: ((msg: unknown) => void) | null = null;
  private authenticated = false;
  private signChallengeFn: ((identityCose: number[], challengeJson: string) => string) | null =
    null;

  constructor(
    private proxyUrl: string,
    private identityCose: Uint8Array,
  ) {}

  async connect(onMessage: (msg: unknown) => void): Promise<void> {
    this.onMessageCallback = onMessage;

    const sdk: any = await import("@bitwarden/sdk-internal");
    this.signChallengeFn = (identityCose: number[], challengeJson: string) =>
      sdk.UserClient.sign_proxy_challenge(identityCose, challengeJson) as string;

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(this.proxyUrl);

      this.ws.onmessage = (event: MessageEvent) => {
        const data = typeof event.data === "string" ? event.data : "";
        const msg = JSON.parse(data);
        this.handleMessage(msg, resolve, reject);
      };

      this.ws.onerror = () => {
        if (!this.authenticated) {
          reject(new Error("WebSocket connection error"));
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        if (!this.authenticated) {
          reject(new Error(`WebSocket closed before auth: ${event.code} ${event.reason}`));
        }
        this.ws = null;
      };
    });
  }

  async request_rendezvous(): Promise<void> {
    this.send(JSON.stringify("GetRendezvous"));
  }

  async request_identity(code: string): Promise<void> {
    this.send(JSON.stringify({ GetIdentity: code }));
  }

  async send_to(fingerprint: string, data: Uint8Array): Promise<void> {
    this.send(
      JSON.stringify({
        Send: {
          destination: this.hexToFingerprint(fingerprint),
          payload: Array.from(data),
        },
      }),
    );
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authenticated = false;
  }

  private handleMessage(
    msg: any,
    resolveConnect: () => void,
    rejectConnect: (err: Error) => void,
  ): void {
    if (msg.AuthChallenge != null && !this.authenticated) {
      try {
        const challengeJson = JSON.stringify(msg);
        const responseJson = this.signChallengeFn!(Array.from(this.identityCose), challengeJson);
        this.ws?.send(responseJson);
        this.authenticated = true;
        resolveConnect();
      } catch (e) {
        rejectConnect(new Error(`Auth challenge failed: ${e}`));
      }
      return;
    }

    if (!this.onMessageCallback) {
      return;
    }

    if (msg.RendezvousInfo != null) {
      this.onMessageCallback({
        type: "rendezvous_info",
        code: typeof msg.RendezvousInfo === "object" ? msg.RendezvousInfo.code : msg.RendezvousInfo,
      });
    } else if (msg.IdentityInfo != null) {
      this.onMessageCallback({
        type: "identity_info",
        fingerprint: this.serializeFingerprint(msg.IdentityInfo.fingerprint),
        identity: msg.IdentityInfo.identity,
      });
    } else if (msg.Send != null) {
      this.onMessageCallback({
        type: "send",
        source: this.serializeFingerprint(msg.Send.source),
        destination: this.serializeFingerprint(msg.Send.destination),
        payload: msg.Send.payload,
      });
    }
  }

  private send(json: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    this.ws.send(json);
  }

  private hexToFingerprint(hex: string): unknown {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return bytes;
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
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: "app-agent-access-test",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-p-6 tw-max-w-3xl tw-mx-auto">
      <h1 class="tw-text-2xl tw-font-bold tw-mb-4">Agent Access WASM Test</h1>

      <div class="tw-space-y-4">
        <!-- Step 1: Load WASM -->
        <section class="tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4">
          <h2 class="tw-text-lg tw-font-semibold tw-mb-2">1. WASM SDK</h2>
          <button
            type="button"
            class="tw-px-4 tw-py-2 tw-rounded tw-bg-primary-600 tw-text-contrast"
            [disabled]="sdkLoaded"
            (click)="loadSdk()"
          >
            {{ sdkLoaded ? "SDK Loaded" : "Load SDK" }}
          </button>
        </section>

        <!-- Step 2: Create identity + UserClient -->
        <section class="tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4">
          <h2 class="tw-text-lg tw-font-semibold tw-mb-2">2. UserClient</h2>
          <button
            type="button"
            class="tw-px-4 tw-py-2 tw-rounded tw-bg-primary-600 tw-text-contrast"
            [disabled]="!sdkLoaded || clientCreated"
            (click)="createClient()"
          >
            {{ clientCreated ? "Client Created" : "Create UserClient" }}
          </button>
        </section>

        <!-- Step 3: Connect to proxy -->
        <section class="tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4">
          <h2 class="tw-text-lg tw-font-semibold tw-mb-2">3. Proxy Connection</h2>
          <div class="tw-flex tw-gap-2 tw-items-center tw-mb-2">
            <label class="tw-text-sm">URL:</label>
            <input
              class="tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-px-2 tw-py-1 tw-flex-1 tw-text-sm tw-font-mono"
              [(ngModel)]="proxyUrl"
              [disabled]="connected"
            />
          </div>
          <button
            type="button"
            class="tw-px-4 tw-py-2 tw-rounded tw-bg-primary-600 tw-text-contrast"
            [disabled]="!clientCreated || connected"
            (click)="connectProxy()"
          >
            {{ connected ? "Connected" : "Connect" }}
          </button>
        </section>

        <!-- Step 4: Get pair codes -->
        <section class="tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4">
          <h2 class="tw-text-lg tw-font-semibold tw-mb-2">4. Pair Codes</h2>
          <div class="tw-flex tw-gap-2 tw-items-center tw-mb-2">
            <label class="tw-text-sm">Name:</label>
            <input
              class="tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-px-2 tw-py-1 tw-text-sm"
              [(ngModel)]="connectionName"
              placeholder="Test Connection"
            />
          </div>
          <div class="tw-flex tw-gap-2">
            <button
              type="button"
              class="tw-px-4 tw-py-2 tw-rounded tw-bg-primary-600 tw-text-contrast"
              [disabled]="!connected"
              (click)="getPskToken()"
            >
              Get PSK Token
            </button>
            <button
              type="button"
              class="tw-px-4 tw-py-2 tw-rounded tw-bg-primary-600 tw-text-contrast"
              [disabled]="!connected"
              (click)="getRendezvousToken()"
            >
              Get Rendezvous Token
            </button>
          </div>
          <div
            *ngIf="pairCode"
            class="tw-mt-2 tw-p-2 tw-bg-secondary-100 tw-rounded tw-font-mono tw-text-sm tw-break-all"
          >
            {{ pairCode }}
          </div>
        </section>

        <!-- Step 5: Disconnect -->
        <section class="tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4">
          <button
            type="button"
            class="tw-px-4 tw-py-2 tw-rounded tw-bg-danger-600 tw-text-contrast"
            [disabled]="!connected"
            (click)="disconnectProxy()"
          >
            Disconnect
          </button>
        </section>

        <!-- Log output -->
        <section class="tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-4">
          <div class="tw-flex tw-justify-between tw-items-center tw-mb-2">
            <h2 class="tw-text-lg tw-font-semibold">Log</h2>
            <button
              type="button"
              class="tw-text-sm tw-text-primary-600 tw-underline"
              (click)="log = []"
            >
              Clear
            </button>
          </div>
          <div
            class="tw-bg-secondary-100 tw-rounded tw-p-2 tw-max-h-64 tw-overflow-y-auto tw-font-mono tw-text-xs tw-space-y-0.5"
          >
            <div
              *ngFor="let entry of log"
              [class]="
                entry.level === 'error'
                  ? 'tw-text-danger-600'
                  : entry.level === 'event'
                    ? 'tw-text-success-600'
                    : 'tw-text-secondary-700'
              "
            >
              <span class="tw-text-muted">{{ entry.time }}</span> {{ entry.message }}
            </div>
            <div *ngIf="log.length === 0" class="tw-text-muted tw-italic">No log entries yet.</div>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class AgentAccessTestComponent implements OnDestroy {
  readonly sdkLoaded = false;
  readonly clientCreated = false;
  readonly connected = false;
  readonly proxyUrl = DEFAULT_PROXY_URL;
  readonly connectionName = "Web Test";
  readonly pairCode = "";
  readonly log: LogEntry[] = [];

  private readonly sdk: any = null;
  private readonly client: any = null;
  private readonly proxyClient: TestProxyClient | null = null;
  private readonly identityCose: Uint8Array | null = null;

  async loadSdk(): Promise<void> {
    try {
      this.addLog("info", "Loading WASM SDK...");
      this.sdk = await import("@bitwarden/sdk-internal");
      this.sdkLoaded = true;
      this.addLog("info", "WASM SDK loaded successfully");
    } catch (e) {
      this.addLog("error", `Failed to load SDK: ${e}`);
    }
  }

  async createClient(): Promise<void> {
    try {
      this.addLog("info", "Generating ephemeral identity...");
      const generateFn = (this.sdk as any).generate_agent_identity;
      this.identityCose = new Uint8Array(generateFn());
      this.addLog("info", `Identity generated (${this.identityCose!.length} bytes)`);

      const repo = new InMemorySessionRepository();
      const UserClient = (this.sdk as any).UserClient;
      this.client = new UserClient(repo, this.identityCose);

      this.client.set_audit_callback((event: any) => {
        this.addLog("event", `Audit: ${JSON.stringify(event)}`);
      });

      this.clientCreated = true;
      this.addLog("info", "UserClient created");
    } catch (e) {
      this.addLog("error", `Failed to create client: ${e}`);
    }
  }

  async connectProxy(): Promise<void> {
    try {
      this.addLog("info", `Connecting to proxy: ${this.proxyUrl}`);
      this.proxyClient = new TestProxyClient(this.proxyUrl, this.identityCose!);

      const eventCallback = (event: any) => {
        this.addLog("event", `Event: ${JSON.stringify(event)}`);
      };

      await this.client.connect(this.proxyClient, eventCallback);
      this.connected = true;
      this.addLog("info", "Connected to proxy and event loop started");
    } catch (e) {
      this.addLog("error", `Failed to connect: ${e}`);
    }
  }

  async getPskToken(): Promise<void> {
    try {
      this.addLog("info", "Requesting PSK token...");
      const token = await this.client.get_psk_token(this.connectionName || null);
      this.pairCode = token;
      this.addLog("info", `PSK token: ${token}`);
    } catch (e) {
      this.addLog("error", `Failed to get PSK token: ${e}`);
    }
  }

  async getRendezvousToken(): Promise<void> {
    try {
      this.addLog("info", "Requesting rendezvous token...");
      const token = await this.client.get_rendezvous_token(this.connectionName || null);
      this.pairCode = token;
      this.addLog("info", `Rendezvous token: ${token}`);
    } catch (e) {
      this.addLog("error", `Failed to get rendezvous token: ${e}`);
    }
  }

  async disconnectProxy(): Promise<void> {
    try {
      if (this.proxyClient) {
        await this.proxyClient.disconnect();
        this.proxyClient = null;
      }
      this.client = null;
      this.connected = false;
      this.clientCreated = false;
      this.pairCode = "";
      this.addLog("info", "Disconnected");
    } catch (e) {
      this.addLog("error", `Disconnect error: ${e}`);
    }
  }

  ngOnDestroy(): void {
    void this.disconnectProxy();
  }

  private addLog(level: LogEntry["level"], message: string): void {
    const now = new Date();
    const time =
      now.toLocaleTimeString("en-US", { hour12: false }) +
      "." +
      String(now.getMilliseconds()).padStart(3, "0");
    this.log.push({ time, level, message });
  }
}
