import { FlightRecorderClient, LogLevel as SdkLogLevel } from "@bitwarden/sdk-internal";

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
 * Two things gate a record: the WASM buffer, which loads asynchronously, and the
 * feature flag, which arrives with the server config. Until both settle, records
 * are held in a bounded in-memory queue and replayed in order once they do.
 * Timestamps are captured when the event is recorded, not when it is written, so
 * replayed records keep their original ordering.
 *
 * The flag is decided once per process; see {@link setEnabled}.
 */
export class FlightRecorderLogRecorder implements LogRecorder {
  private client: FlightRecorderClient | null = null;
  private queue: QueuedRecord[] = [];
  /** `null` until the flag is known; queue-and-wait rather than record or drop. */
  private enabled: boolean | null = null;

  /**
   * @param sdkReady Resolves once the SDK WASM is loaded. If it rejects, or the
   *   client cannot be constructed, the recorder shuts down.
   * @param target The target recorded alongside each event, mirroring the Rust
   *   module path on SDK-origin events.
   */
  constructor(
    sdkReady: Promise<void>,
    private readonly target = "typescript",
  ) {
    void sdkReady
      .then(() => new FlightRecorderClient())
      .then(
        (client) => {
          this.client = client;
          this.flush();
        },
        () => {
          // Not a flag decision, so it bypasses the one-shot guard in setEnabled.
          this.enabled = false;
          this.queue = [];
        },
      );
  }

  /**
   * Decides whether to record, replaying or dropping whatever queued up first.
   * The first call wins; later ones are ignored, so the flag holds for the life of
   * the process and flipping it takes a restart.
   */
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
