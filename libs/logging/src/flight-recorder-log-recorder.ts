import { type FlightRecorderClient, LogLevel as SdkLogLevel } from "@bitwarden/sdk-internal";

import { LogLevel } from "./log-level";
import { LogRecorder } from "./log-recorder";
import { safeStringify } from "./safe-stringify";

/** Cap on records buffered before the SDK is ready. Later records are dropped. */
const MAX_QUEUE = 1000;

/**
 * The SDK carries a `Trace` level the clients have no equivalent for.
 *
 * Read at call time: `libs/common` re-exports the `@bitwarden/logging` barrel, so touching
 * the SDK enum during module evaluation breaks every spec that stubs
 * `@bitwarden/sdk-internal` with a partial mock.
 */
function toSdkLevel(level: LogLevel): SdkLogLevel {
  switch (level) {
    case LogLevel.Debug:
      return SdkLogLevel.Debug;
    case LogLevel.Info:
      return SdkLogLevel.Info;
    case LogLevel.Warning:
      return SdkLogLevel.Warn;
    case LogLevel.Error:
      return SdkLogLevel.Error;
  }
}

interface QueuedRecord {
  timestamp: number;
  level: SdkLogLevel;
  message: string;
}

/**
 * A {@link LogRecorder} that forwards log events into the SDK Flight Recorder buffer.
 *
 * Records are queued until the SDK has loaded and {@link setEnabled} has been
 * called, then written in order. Each record keeps the timestamp from when it was
 * logged.
 */
export class FlightRecorderLogRecorder implements LogRecorder {
  private client: FlightRecorderClient | null = null;
  private queue: QueuedRecord[] = [];
  /** `null` until {@link setEnabled} is called. */
  private enabled: boolean | null = null;

  /**
   * @param clientReady Resolves with the client once the SDK WASM is loaded. If it
   *   rejects, the recorder is disabled.
   * @param target The target recorded alongside each event, mirroring the Rust
   *   module path on SDK-origin events.
   */
  constructor(
    clientReady: Promise<FlightRecorderClient>,
    private readonly target = "typescript",
  ) {
    void clientReady.then(
      (client) => {
        this.client = client;
        this.flush();
      },
      () => {
        this.enabled = false;
        this.queue = [];
      },
    );
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled != null) {
      return;
    }

    this.enabled = enabled;

    if (enabled) {
      this.flush();
    } else {
      this.queue = [];
    }
  }

  record(level: LogLevel, message?: any, ...optionalParams: any[]): void {
    if (this.enabled === false) {
      return;
    }

    try {
      const timestamp = Date.now();
      const sdkLevel = toSdkLevel(level);
      const text = this.format(message, optionalParams);

      if (this.client != null && this.enabled) {
        this.client.write(timestamp, sdkLevel, this.target, text);
      } else if (this.queue.length < MAX_QUEUE) {
        this.queue.push({ timestamp, level: sdkLevel, message: text });
      }
    } catch {
      // Ignore error
    }
  }

  private flush(): void {
    if (this.client == null || !this.enabled) {
      return;
    }

    const queued = this.queue;
    this.queue = [];

    for (const record of queued) {
      try {
        this.client.write(record.timestamp, record.level, this.target, record.message);
      } catch {
        // Ignore error
      }
    }
  }

  private format(message: any, params: any[]): string {
    return [message, ...params]
      .map(safeStringify)
      .filter((part) => part.length > 0)
      .join(" ");
  }
}
